package config

import "testing"

func TestSanitizeGroups_NormalizesAndDeduplicatesModels(t *testing.T) {
	cfg := &Config{
		Groups: []Group{
			{Name: " DeepSeek-Pool ", ProviderType: " OpenAI-Compatibility ", Models: []string{" Chat ", "chat", "Coder"}},
		},
	}
	if err := cfg.SanitizeGroups(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg.Groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(cfg.Groups))
	}
	g := cfg.Groups[0]
	if g.Name != "deepseek-pool" {
		t.Fatalf("expected normalized name deepseek-pool, got %q", g.Name)
	}
	if g.ProviderType != GroupProviderOpenAICompatibility {
		t.Fatalf("expected provider type %q, got %q", GroupProviderOpenAICompatibility, g.ProviderType)
	}
	if len(g.Models) != 2 || g.Models[0] != "chat" || g.Models[1] != "coder" {
		t.Fatalf("expected deduped lowercase models [chat coder], got %#v", g.Models)
	}
}

func TestSanitizeGroups_RejectsDuplicateNames(t *testing.T) {
	cfg := &Config{
		Groups: []Group{
			{Name: "pool", ProviderType: GroupProviderClaude},
			{Name: "POOL", ProviderType: GroupProviderClaude},
		},
	}
	if err := cfg.SanitizeGroups(); err == nil {
		t.Fatal("expected duplicate name error, got nil")
	}
}

func TestSanitizeGroups_RejectsUnknownProviderType(t *testing.T) {
	cfg := &Config{
		Groups: []Group{
			{Name: "pool", ProviderType: "bedrock"},
		},
	}
	if err := cfg.SanitizeGroups(); err == nil {
		t.Fatal("expected invalid provider-type error, got nil")
	}
}

func TestSanitizeGroups_RejectsEmptyName(t *testing.T) {
	cfg := &Config{
		Groups: []Group{
			{Name: "   ", ProviderType: GroupProviderClaude},
		},
	}
	if err := cfg.SanitizeGroups(); err == nil {
		t.Fatal("expected empty name error, got nil")
	}
}

func TestSanitizeAPIKeyGroups_NormalizesAndDrops(t *testing.T) {
	cfg := &Config{
		APIKeyGroups: map[string][]string{
			" sk-a ": {" Pool-1 ", "pool-1", ""},
			"sk-b":   {"  ", ""},
		},
	}
	cfg.SanitizeAPIKeyGroups()
	got, ok := cfg.APIKeyGroups["sk-a"]
	if !ok {
		t.Fatalf("expected key 'sk-a' (trimmed), got %#v", cfg.APIKeyGroups)
	}
	if len(got) != 1 || got[0] != "pool-1" {
		t.Fatalf("expected deduped [pool-1], got %#v", got)
	}
	if _, exists := cfg.APIKeyGroups["sk-b"]; exists {
		t.Fatal("expected sk-b dropped (no valid groups)")
	}
}

func TestSanitizeOAuthGroups_NormalizesGroupValues(t *testing.T) {
	cfg := &Config{
		OAuthGroups: map[string]string{
			"claude-a.json": " Claude-Pool ",
			"empty.json":    "   ",
		},
	}
	cfg.SanitizeOAuthGroups()
	if cfg.OAuthGroups["claude-a.json"] != "claude-pool" {
		t.Fatalf("expected normalized group claude-pool, got %q", cfg.OAuthGroups["claude-a.json"])
	}
	if _, exists := cfg.OAuthGroups["empty.json"]; exists {
		t.Fatal("expected empty.json dropped")
	}
}

func TestValidateGroupReferences_RejectsUnknownGroup(t *testing.T) {
	cfg := &Config{
		Groups:    []Group{{Name: "claude-pool", ProviderType: GroupProviderClaude}},
		ClaudeKey: []ClaudeKey{{APIKey: "k", Group: "missing-pool"}},
	}
	if err := cfg.ValidateGroupReferences(); err == nil {
		t.Fatal("expected unknown group error, got nil")
	}
}

func TestValidateGroupReferences_RejectsProviderTypeMismatch(t *testing.T) {
	cfg := &Config{
		Groups:    []Group{{Name: "gemini-pool", ProviderType: GroupProviderGemini}},
		ClaudeKey: []ClaudeKey{{APIKey: "k", Group: "gemini-pool"}},
	}
	if err := cfg.ValidateGroupReferences(); err == nil {
		t.Fatal("expected provider-type mismatch error, got nil")
	}
}

func TestValidateGroupReferences_AcceptsMatchingReferences(t *testing.T) {
	cfg := &Config{
		Groups: []Group{
			{Name: "claude-pool", ProviderType: GroupProviderClaude},
			{Name: "deepseek-pool", ProviderType: GroupProviderOpenAICompatibility},
		},
		ClaudeKey:           []ClaudeKey{{APIKey: "k", Group: "claude-pool"}},
		OpenAICompatibility: []OpenAICompatibility{{Name: "deepseek", Group: "deepseek-pool"}},
		OAuthGroups:         map[string]string{"claude-a.json": "claude-pool"},
		APIKeyGroups:        map[string][]string{"sk-a": {"claude-pool", "deepseek-pool"}},
	}
	if err := cfg.ValidateGroupReferences(); err != nil {
		t.Fatalf("expected valid references, got error: %v", err)
	}
}

func TestValidateGroupReferences_RejectsUnknownAPIKeyGroup(t *testing.T) {
	cfg := &Config{
		Groups:       []Group{{Name: "claude-pool", ProviderType: GroupProviderClaude}},
		APIKeyGroups: map[string][]string{"sk-a": {"claude-pool", "ghost-pool"}},
	}
	if err := cfg.ValidateGroupReferences(); err == nil {
		t.Fatal("expected unknown api-key group error, got nil")
	}
}

func TestValidateGroupReferences_EmptyGroupIsUnrestricted(t *testing.T) {
	cfg := &Config{
		Groups:    []Group{{Name: "claude-pool", ProviderType: GroupProviderClaude}},
		ClaudeKey: []ClaudeKey{{APIKey: "k"}}, // no group -> legacy unrestricted
	}
	if err := cfg.ValidateGroupReferences(); err != nil {
		t.Fatalf("expected no error for ungrouped credential, got: %v", err)
	}
}
