package config

import (
	"fmt"
	"sort"
	"strings"
)

// Provider type identifiers used by groups to enforce that every credential in a
// group speaks the same upstream protocol. These values intentionally mirror the
// credential families exposed through the management API.
const (
	// GroupProviderClaude covers Claude API-key credentials and Claude OAuth accounts.
	GroupProviderClaude = "claude"
	// GroupProviderGemini covers Gemini API-key credentials and Gemini OAuth accounts.
	GroupProviderGemini = "gemini"
	// GroupProviderCodex covers Codex API-key credentials and Codex OAuth accounts.
	GroupProviderCodex = "codex"
	// GroupProviderVertex covers Vertex-compatible API-key credentials.
	GroupProviderVertex = "vertex"
	// GroupProviderOpenAICompatibility covers OpenAI-compatible third-party providers
	// (DeepSeek, Moonshot, SiliconFlow, ...). Multiple providers of this family can
	// coexist in one group because they share the same probing and routing behavior.
	GroupProviderOpenAICompatibility = "openai-compatibility"
)

// validGroupProviderTypes is the set of provider types a group may declare.
var validGroupProviderTypes = map[string]struct{}{
	GroupProviderClaude:              {},
	GroupProviderGemini:              {},
	GroupProviderCodex:               {},
	GroupProviderVertex:              {},
	GroupProviderOpenAICompatibility: {},
}

// Group defines a routing group. Every upstream credential assigned to a group must
// match the group's ProviderType, which keeps the group homogeneous so load
// balancing and model probing stay coherent. A downstream API key may be bound to
// multiple groups; the models it can reach are the union across those groups.
type Group struct {
	// Name is the unique group identifier referenced by credentials and API keys.
	Name string `yaml:"name" json:"name"`

	// ProviderType constrains which credential family may join this group.
	// It must be one of the GroupProvider* constants.
	ProviderType string `yaml:"provider-type" json:"provider-type"`

	// Models optionally declares the model IDs this group serves. It acts as a
	// fallback model set when live probing is unavailable (e.g. before the first
	// probe) and as a manual override for credentials that cannot be probed.
	Models []string `yaml:"models,omitempty" json:"models,omitempty"`
}

// NormalizeGroupProviderType lowercases and trims a provider type and reports whether
// the result is a recognized value.
func NormalizeGroupProviderType(providerType string) (string, bool) {
	normalized := strings.ToLower(strings.TrimSpace(providerType))
	if normalized == "" {
		return "", false
	}
	_, ok := validGroupProviderTypes[normalized]
	return normalized, ok
}

// NormalizeGroupName trims and lowercases a group name for consistent matching.
func NormalizeGroupName(name string) string {
	return strings.ToLower(strings.TrimSpace(name))
}

// SanitizeGroups normalizes group definitions and validates them. It returns an
// error when a group is invalid so the caller can refuse to load the config rather
// than route requests against a malformed group set. Duplicate names and unknown
// provider types are rejected.
func (cfg *Config) SanitizeGroups() error {
	if cfg == nil || len(cfg.Groups) == 0 {
		cfg.Groups = nil
		return nil
	}
	seen := make(map[string]struct{}, len(cfg.Groups))
	out := make([]Group, 0, len(cfg.Groups))
	for i := range cfg.Groups {
		entry := cfg.Groups[i]
		name := NormalizeGroupName(entry.Name)
		if name == "" {
			return fmt.Errorf("groups[%d]: name is required", i)
		}
		if _, exists := seen[name]; exists {
			return fmt.Errorf("groups[%d]: duplicate group name %q", i, name)
		}
		providerType, ok := NormalizeGroupProviderType(entry.ProviderType)
		if !ok {
			return fmt.Errorf("groups[%d] (%s): invalid provider-type %q", i, name, entry.ProviderType)
		}
		seen[name] = struct{}{}
		entry.Name = name
		entry.ProviderType = providerType
		entry.Models = NormalizeExcludedModels(entry.Models)
		out = append(out, entry)
	}
	cfg.Groups = out
	return nil
}

// GroupByName returns the group definition matching name (case-insensitive), or nil.
func (cfg *Config) GroupByName(name string) *Group {
	if cfg == nil {
		return nil
	}
	target := NormalizeGroupName(name)
	if target == "" {
		return nil
	}
	for i := range cfg.Groups {
		if cfg.Groups[i].Name == target {
			return &cfg.Groups[i]
		}
	}
	return nil
}

// NormalizeGroupRefs cleans a list of group references: trims, lowercases, drops
// empties, and de-duplicates while preserving order.
func NormalizeGroupRefs(groups []string) []string {
	if len(groups) == 0 {
		return nil
	}
	seen := make(map[string]struct{}, len(groups))
	out := make([]string, 0, len(groups))
	for _, raw := range groups {
		name := NormalizeGroupName(raw)
		if name == "" {
			continue
		}
		if _, exists := seen[name]; exists {
			continue
		}
		seen[name] = struct{}{}
		out = append(out, name)
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// SanitizeOAuthGroups normalizes the OAuth-account-to-group mapping. Keys are auth
// file names or IDs; values are group names. Entries whose group does not exist are
// dropped with no error (the account simply falls back to the unrestricted pool).
func (cfg *Config) SanitizeOAuthGroups() {
	if cfg == nil || len(cfg.OAuthGroups) == 0 {
		cfg.OAuthGroups = nil
		return
	}
	out := make(map[string]string, len(cfg.OAuthGroups))
	for rawKey, rawGroup := range cfg.OAuthGroups {
		key := strings.TrimSpace(rawKey)
		group := NormalizeGroupName(rawGroup)
		if key == "" || group == "" {
			continue
		}
		out[key] = group
	}
	if len(out) == 0 {
		cfg.OAuthGroups = nil
		return
	}
	cfg.OAuthGroups = out
}

// SanitizeAPIKeyGroups normalizes the downstream-key-to-groups mapping. Keys are
// downstream API keys; values are the groups they may reach. Empty group lists are
// dropped.
func (cfg *Config) SanitizeAPIKeyGroups() {
	if cfg == nil || len(cfg.APIKeyGroups) == 0 {
		cfg.APIKeyGroups = nil
		return
	}
	out := make(map[string][]string, len(cfg.APIKeyGroups))
	for rawKey, groups := range cfg.APIKeyGroups {
		key := strings.TrimSpace(rawKey)
		if key == "" {
			continue
		}
		normalized := NormalizeGroupRefs(groups)
		if len(normalized) == 0 {
			continue
		}
		out[key] = normalized
	}
	if len(out) == 0 {
		cfg.APIKeyGroups = nil
		return
	}
	cfg.APIKeyGroups = out
}

// ValidateGroupReferences ensures every group referenced by credentials, OAuth
// accounts, and downstream API keys exists, and that each credential's declared
// group matches the group's provider type. It must run after SanitizeGroups and the
// per-credential sanitizers. Unknown references are reported as errors so
// misconfiguration surfaces at load time instead of silently dropping routes.
func (cfg *Config) ValidateGroupReferences() error {
	if cfg == nil {
		return nil
	}
	// Build a quick lookup of group name -> provider type.
	groupProviders := make(map[string]string, len(cfg.Groups))
	for i := range cfg.Groups {
		groupProviders[cfg.Groups[i].Name] = cfg.Groups[i].ProviderType
	}

	checkCredential := func(label, group, providerType string) error {
		group = NormalizeGroupName(group)
		if group == "" {
			return nil
		}
		want, ok := groupProviders[group]
		if !ok {
			return fmt.Errorf("%s references unknown group %q", label, group)
		}
		if providerType != "" && want != providerType {
			return fmt.Errorf("%s is provider-type %q but group %q is %q", label, providerType, group, want)
		}
		return nil
	}

	for i := range cfg.ClaudeKey {
		if err := checkCredential(fmt.Sprintf("claude-api-key[%d]", i), cfg.ClaudeKey[i].Group, GroupProviderClaude); err != nil {
			return err
		}
	}
	for i := range cfg.CodexKey {
		if err := checkCredential(fmt.Sprintf("codex-api-key[%d]", i), cfg.CodexKey[i].Group, GroupProviderCodex); err != nil {
			return err
		}
	}
	for i := range cfg.GeminiKey {
		if err := checkCredential(fmt.Sprintf("gemini-api-key[%d]", i), cfg.GeminiKey[i].Group, GroupProviderGemini); err != nil {
			return err
		}
	}
	for i := range cfg.VertexCompatAPIKey {
		if err := checkCredential(fmt.Sprintf("vertex-api-key[%d]", i), cfg.VertexCompatAPIKey[i].Group, GroupProviderVertex); err != nil {
			return err
		}
	}
	for i := range cfg.OpenAICompatibility {
		if err := checkCredential(fmt.Sprintf("openai-compatibility[%d]", i), cfg.OpenAICompatibility[i].Group, GroupProviderOpenAICompatibility); err != nil {
			return err
		}
	}

	// OAuth account mappings: provider type is not known from the mapping alone, so
	// only existence is validated here.
	oauthKeys := make([]string, 0, len(cfg.OAuthGroups))
	for key := range cfg.OAuthGroups {
		oauthKeys = append(oauthKeys, key)
	}
	sort.Strings(oauthKeys)
	for _, key := range oauthKeys {
		if err := checkCredential(fmt.Sprintf("oauth-groups[%q]", key), cfg.OAuthGroups[key], ""); err != nil {
			return err
		}
	}

	// Downstream API key bindings must reference existing groups.
	apiKeyRefs := make([]string, 0, len(cfg.APIKeyGroups))
	for key := range cfg.APIKeyGroups {
		apiKeyRefs = append(apiKeyRefs, key)
	}
	sort.Strings(apiKeyRefs)
	for _, key := range apiKeyRefs {
		for _, group := range cfg.APIKeyGroups[key] {
			if _, ok := groupProviders[group]; !ok {
				return fmt.Errorf("api-key-groups references unknown group %q", group)
			}
		}
	}

	return nil
}
