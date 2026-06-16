package auth

import (
	"context"
	"strings"

	internalconfig "github.com/router-for-me/CLIProxyAPI/v7/internal/config"
)

// GroupAttributeKey is the Auth.Attributes key holding the routing group a
// credential belongs to. It is populated by the synthesizers from the config
// `group` field (API-key credentials) or the `oauth-groups` mapping (OAuth
// file-backed credentials). An empty/absent value means the credential is
// ungrouped and only reachable by unrestricted downstream API keys.
const GroupAttributeKey = "group"

// downstreamAPIKeyFromContext extracts the authenticated downstream API key that
// the access middleware stored as "userApiKey" on the gin context. It returns ""
// when no gin context or principal is present (e.g. internal calls, or access
// control disabled), which the caller treats as "unrestricted".
func downstreamAPIKeyFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	ginCtx, ok := ctx.Value("gin").(interface {
		Get(string) (any, bool)
	})
	if !ok || ginCtx == nil {
		return ""
	}
	raw, ok := ginCtx.Get("userApiKey")
	if !ok {
		return ""
	}
	return strings.TrimSpace(contextStringValue(raw))
}

// allowedGroupsForContext resolves the set of routing groups the calling
// downstream API key may use. The second return value reports whether group
// restriction applies at all: when false the caller is unrestricted (legacy
// behavior) and every candidate credential is eligible regardless of group.
//
// A key is unrestricted when it has no entry in api-key-groups (or the entry is
// empty). This preserves backward compatibility for every existing deployment
// that has not opted into grouping.
func (m *Manager) allowedGroupsForContext(ctx context.Context) (map[string]struct{}, bool) {
	if m == nil {
		return nil, false
	}
	apiKey := downstreamAPIKeyFromContext(ctx)
	if apiKey == "" {
		return nil, false
	}
	cfg, _ := m.runtimeConfig.Load().(*internalconfig.Config)
	if cfg == nil || len(cfg.APIKeyGroups) == 0 {
		return nil, false
	}
	groups, ok := cfg.APIKeyGroups[apiKey]
	if !ok || len(groups) == 0 {
		return nil, false
	}
	set := make(map[string]struct{}, len(groups))
	for _, g := range groups {
		if g = internalconfig.NormalizeGroupName(g); g != "" {
			set[g] = struct{}{}
		}
	}
	if len(set) == 0 {
		return nil, false
	}
	return set, true
}

// authAllowedForGroups reports whether a candidate auth is eligible for a caller
// with the given allowed-group set. Unrestricted callers (restricted=false)
// accept every candidate. Restricted callers accept only candidates whose group
// attribute is present in the set; ungrouped candidates are never reachable by a
// restricted caller.
func authAllowedForGroups(auth *Auth, allowed map[string]struct{}, restricted bool) bool {
	if !restricted {
		return true
	}
	if auth == nil {
		return false
	}
	group := ""
	if auth.Attributes != nil {
		group = internalconfig.NormalizeGroupName(auth.Attributes[GroupAttributeKey])
	}
	if group == "" {
		return false
	}
	_, ok := allowed[group]
	return ok
}
