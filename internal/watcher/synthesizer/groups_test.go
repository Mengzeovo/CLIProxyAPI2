package synthesizer

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/router-for-me/CLIProxyAPI/v7/internal/config"
	coreauth "github.com/router-for-me/CLIProxyAPI/v7/sdk/cliproxy/auth"
)

func groupAttr(a *coreauth.Auth) string {
	if a == nil || a.Attributes == nil {
		return ""
	}
	return a.Attributes[coreauth.GroupAttributeKey]
}

// TestConfigSynthesizer_InjectsGroupAttribute confirms every API-key credential
// type carries its configured group onto the synthesized auth, normalized.
func TestConfigSynthesizer_InjectsGroupAttribute(t *testing.T) {
	ctx := &SynthesisContext{
		Config: &config.Config{
			GeminiKey: []config.GeminiKey{{APIKey: "g-key", Group: " Pool-A "}},
			ClaudeKey: []config.ClaudeKey{{APIKey: "c-key", Group: "Pool-A"}},
			CodexKey:  []config.CodexKey{{APIKey: "x-key", Group: "pool-a"}},
			OpenAICompatibility: []config.OpenAICompatibility{{
				Name:          "oai",
				BaseURL:       "https://example.test",
				APIKeyEntries: []config.OpenAICompatibilityAPIKey{{APIKey: "o-key"}},
				Group:         "Pool-A",
			}},
			VertexCompatAPIKey: []config.VertexCompatKey{{APIKey: "v-key", BaseURL: "https://vertex.test", Group: "Pool-A"}},
		},
		Now:         time.Now(),
		IDGenerator: NewStableIDGenerator(),
	}

	auths, err := NewConfigSynthesizer().Synthesize(ctx)
	if err != nil {
		t.Fatalf("Synthesize error = %v", err)
	}
	if len(auths) != 5 {
		t.Fatalf("expected 5 auths, got %d", len(auths))
	}
	for _, a := range auths {
		if got := groupAttr(a); got != "pool-a" {
			t.Fatalf("auth %s (%s) group = %q, want normalized %q", a.ID, a.Provider, got, "pool-a")
		}
	}
}

// TestConfigSynthesizer_NoGroupLeavesAttributeAbsent confirms ungrouped
// credentials carry no group attribute, so they stay reachable only by
// unrestricted downstream keys.
func TestConfigSynthesizer_NoGroupLeavesAttributeAbsent(t *testing.T) {
	ctx := &SynthesisContext{
		Config:      &config.Config{ClaudeKey: []config.ClaudeKey{{APIKey: "c-key"}}},
		Now:         time.Now(),
		IDGenerator: NewStableIDGenerator(),
	}
	auths, err := NewConfigSynthesizer().Synthesize(ctx)
	if err != nil {
		t.Fatalf("Synthesize error = %v", err)
	}
	if len(auths) != 1 {
		t.Fatalf("expected 1 auth, got %d", len(auths))
	}
	if _, ok := auths[0].Attributes[coreauth.GroupAttributeKey]; ok {
		t.Fatalf("ungrouped credential should not carry a group attribute, got %q", groupAttr(auths[0]))
	}
}

// TestResolveOAuthGroup confirms the oauth-groups mapping is matched by auth ID,
// full path, and bare file name.
func TestResolveOAuthGroup(t *testing.T) {
	full := filepath.Join("auths", "acct.json")
	cases := []struct {
		name string
		cfg  *config.Config
		want string
	}{
		{"by id", &config.Config{OAuthGroups: map[string]string{"acct-id": "pool-1"}}, "pool-1"},
		{"by full path", &config.Config{OAuthGroups: map[string]string{full: "pool-2"}}, "pool-2"},
		{"by base name", &config.Config{OAuthGroups: map[string]string{"acct.json": "pool-3"}}, "pool-3"},
		{"no match", &config.Config{OAuthGroups: map[string]string{"other": "pool-x"}}, ""},
		{"empty map", &config.Config{}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolveOAuthGroup(tc.cfg, "acct-id", full); got != tc.want {
				t.Fatalf("resolveOAuthGroup = %q, want %q", got, tc.want)
			}
		})
	}
}
