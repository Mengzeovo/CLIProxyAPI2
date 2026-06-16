package synthesizer

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/router-for-me/CLIProxyAPI/v7/internal/config"
	"github.com/router-for-me/CLIProxyAPI/v7/internal/watcher/diff"
	coreauth "github.com/router-for-me/CLIProxyAPI/v7/sdk/cliproxy/auth"
)

// StableIDGenerator generates stable, deterministic IDs for auth entries.
// It uses SHA256 hashing with collision handling via counters.
// It is not safe for concurrent use.
type StableIDGenerator struct {
	counters map[string]int
}

// NewStableIDGenerator creates a new StableIDGenerator instance.
func NewStableIDGenerator() *StableIDGenerator {
	return &StableIDGenerator{counters: make(map[string]int)}
}

// Next generates a stable ID based on the kind and parts.
// Returns the full ID (kind:hash) and the short hash portion.
func (g *StableIDGenerator) Next(kind string, parts ...string) (string, string) {
	if g == nil {
		return kind + ":000000000000", "000000000000"
	}
	hasher := sha256.New()
	hasher.Write([]byte(kind))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		hasher.Write([]byte{0})
		hasher.Write([]byte(trimmed))
	}
	digest := hex.EncodeToString(hasher.Sum(nil))
	if len(digest) < 12 {
		digest = fmt.Sprintf("%012s", digest)
	}
	short := digest[:12]
	key := kind + ":" + short
	index := g.counters[key]
	g.counters[key] = index + 1
	if index > 0 {
		short = fmt.Sprintf("%s-%d", short, index)
	}
	return fmt.Sprintf("%s:%s", kind, short), short
}

// ApplyAuthExcludedModelsMeta applies excluded models metadata to an auth entry.
// It computes a hash of excluded models and sets the auth_kind attribute.
// For OAuth entries, perKey (from the JSON file's excluded-models field) is merged
// with the global oauth-excluded-models config for the provider.
func ApplyAuthExcludedModelsMeta(auth *coreauth.Auth, cfg *config.Config, perKey []string, authKind string) {
	if auth == nil || cfg == nil {
		return
	}
	authKindKey := strings.ToLower(strings.TrimSpace(authKind))
	seen := make(map[string]struct{})
	add := func(list []string) {
		for _, entry := range list {
			if trimmed := strings.TrimSpace(entry); trimmed != "" {
				key := strings.ToLower(trimmed)
				if _, exists := seen[key]; exists {
					continue
				}
				seen[key] = struct{}{}
			}
		}
	}
	if authKindKey == "apikey" {
		add(perKey)
	} else {
		// For OAuth: merge per-account excluded models with global provider-level exclusions
		add(perKey)
		if cfg.OAuthExcludedModels != nil {
			providerKey := strings.ToLower(strings.TrimSpace(auth.Provider))
			add(cfg.OAuthExcludedModels[providerKey])
		}
	}
	combined := make([]string, 0, len(seen))
	for k := range seen {
		combined = append(combined, k)
	}
	sort.Strings(combined)
	hash := diff.ComputeExcludedModelsHash(combined)
	if auth.Attributes == nil {
		auth.Attributes = make(map[string]string)
	}
	if hash != "" {
		auth.Attributes["excluded_models_hash"] = hash
	}
	// Store the combined excluded models list so that routing can read it at runtime
	if len(combined) > 0 {
		auth.Attributes["excluded_models"] = strings.Join(combined, ",")
	}
	if authKind != "" {
		auth.Attributes["auth_kind"] = authKind
	}
}

// addConfigHeadersToAttrs adds header configuration to auth attributes.
// Headers are prefixed with "header:" in the attributes map.
func addConfigHeadersToAttrs(headers map[string]string, attrs map[string]string) {
	if len(headers) == 0 || attrs == nil {
		return
	}
	for hk, hv := range headers {
		key := strings.TrimSpace(hk)
		val := strings.TrimSpace(hv)
		if key == "" || val == "" {
			continue
		}
		attrs["header:"+key] = val
	}
}

// setGroupAttr records the routing group an auth belongs to under the shared
// group attribute key. The value is normalized to match the form used by group
// validation and selection-time filtering. Empty groups are ignored so
// ungrouped credentials carry no group attribute at all.
func setGroupAttr(attrs map[string]string, group string) {
	if attrs == nil {
		return
	}
	if normalized := config.NormalizeGroupName(group); normalized != "" {
		attrs[coreauth.GroupAttributeKey] = normalized
	}
}

// resolveOAuthGroup looks up the routing group for an OAuth file-backed auth from
// the oauth-groups config mapping. The mapping may key on the auth ID (relative
// path under auth-dir), the full path, or the bare file name, so all three are
// tried. It returns "" when no mapping matches.
func resolveOAuthGroup(cfg *config.Config, authID, fullPath string) string {
	if cfg == nil || len(cfg.OAuthGroups) == 0 {
		return ""
	}
	candidates := []string{
		authID,
		fullPath,
		filepath.Base(fullPath),
	}
	for _, key := range candidates {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		if group, ok := cfg.OAuthGroups[key]; ok {
			return group
		}
	}
	return ""
}
