package auth

import (
	"context"
	"testing"

	internalconfig "github.com/router-for-me/CLIProxyAPI/v7/internal/config"
	cliproxyexecutor "github.com/router-for-me/CLIProxyAPI/v7/sdk/cliproxy/executor"
)

// groupTestGinContext is a minimal gin-context stand-in exposing only the
// Get(key) accessor that downstreamAPIKeyFromContext relies on.
type groupTestGinContext struct {
	values map[string]any
}

func (c groupTestGinContext) Get(key string) (any, bool) {
	v, ok := c.values[key]
	return v, ok
}

func ctxWithAPIKey(apiKey string) context.Context {
	gin := groupTestGinContext{values: map[string]any{"userApiKey": apiKey}}
	return context.WithValue(context.Background(), "gin", gin)
}

func TestAuthAllowedForGroups(t *testing.T) {
	t.Parallel()

	grouped := &Auth{ID: "a", Attributes: map[string]string{GroupAttributeKey: "pool-1"}}
	ungrouped := &Auth{ID: "b"}
	allowed := map[string]struct{}{"pool-1": {}}

	// Unrestricted callers accept every candidate, grouped or not.
	if !authAllowedForGroups(grouped, nil, false) {
		t.Fatalf("unrestricted caller should accept grouped auth")
	}
	if !authAllowedForGroups(ungrouped, nil, false) {
		t.Fatalf("unrestricted caller should accept ungrouped auth")
	}

	// Restricted callers accept matching groups only.
	if !authAllowedForGroups(grouped, allowed, true) {
		t.Fatalf("restricted caller should accept matching group")
	}
	if authAllowedForGroups(ungrouped, allowed, true) {
		t.Fatalf("restricted caller must not reach ungrouped auth")
	}
	other := &Auth{ID: "c", Attributes: map[string]string{GroupAttributeKey: "pool-2"}}
	if authAllowedForGroups(other, allowed, true) {
		t.Fatalf("restricted caller must not reach non-matching group")
	}
}

func TestDownstreamAPIKeyFromContext(t *testing.T) {
	t.Parallel()

	if got := downstreamAPIKeyFromContext(context.Background()); got != "" {
		t.Fatalf("no gin context should yield empty key, got %q", got)
	}
	if got := downstreamAPIKeyFromContext(ctxWithAPIKey("  sk-a  ")); got != "sk-a" {
		t.Fatalf("expected trimmed key 'sk-a', got %q", got)
	}
}

func TestAllowedGroupsForContext(t *testing.T) {
	t.Parallel()

	manager := NewManager(nil, &RoundRobinSelector{}, nil)
	manager.SetConfig(&internalconfig.Config{
		APIKeyGroups: map[string][]string{
			"sk-restricted": {"pool-1", "pool-2"},
		},
	})

	// Key not present in the map -> unrestricted.
	if _, restricted := manager.allowedGroupsForContext(ctxWithAPIKey("sk-open")); restricted {
		t.Fatalf("unmapped key should be unrestricted")
	}
	// No gin context -> unrestricted.
	if _, restricted := manager.allowedGroupsForContext(context.Background()); restricted {
		t.Fatalf("missing context should be unrestricted")
	}
	// Mapped key -> restricted to its declared groups.
	groups, restricted := manager.allowedGroupsForContext(ctxWithAPIKey("sk-restricted"))
	if !restricted {
		t.Fatalf("mapped key should be restricted")
	}
	if _, ok := groups["pool-1"]; !ok {
		t.Fatalf("expected pool-1 in allowed set, got %#v", groups)
	}
	if _, ok := groups["pool-2"]; !ok {
		t.Fatalf("expected pool-2 in allowed set, got %#v", groups)
	}
}

func TestPickNextLegacy_GroupRestrictionFiltersCandidates(t *testing.T) {
	model := "claude-sonnet-4-6"
	registerSchedulerModels(t, "claude", model, "auth-pool-1", "auth-pool-2", "auth-ungrouped")

	manager := NewManager(nil, &RoundRobinSelector{}, nil)
	manager.executors["claude"] = schedulerTestExecutor{}
	manager.SetConfig(&internalconfig.Config{
		APIKeyGroups: map[string][]string{"sk-team-a": {"pool-1"}},
	})

	register := func(id, group string) {
		attrs := map[string]string{}
		if group != "" {
			attrs[GroupAttributeKey] = group
		}
		if _, err := manager.Register(context.Background(), &Auth{ID: id, Provider: "claude", Attributes: attrs}); err != nil {
			t.Fatalf("Register(%s) error = %v", id, err)
		}
	}
	register("auth-pool-1", "pool-1")
	register("auth-pool-2", "pool-2")
	register("auth-ungrouped", "")

	// A restricted key bound to pool-1 may only ever receive auth-pool-1.
	ctx := ctxWithAPIKey("sk-team-a")
	for i := 0; i < 5; i++ {
		got, _, err := manager.pickNextLegacy(ctx, "claude", model, cliproxyexecutor.Options{}, map[string]struct{}{})
		if err != nil {
			t.Fatalf("pick #%d error = %v", i, err)
		}
		if got == nil || got.ID != "auth-pool-1" {
			t.Fatalf("pick #%d = %v, want auth-pool-1", i, got)
		}
	}

	// An unrestricted key may receive any of the three credentials.
	openCtx := ctxWithAPIKey("sk-open")
	seen := map[string]bool{}
	for i := 0; i < 12; i++ {
		got, _, err := manager.pickNextLegacy(openCtx, "claude", model, cliproxyexecutor.Options{}, map[string]struct{}{})
		if err != nil {
			t.Fatalf("open pick #%d error = %v", i, err)
		}
		seen[got.ID] = true
	}
	for _, id := range []string{"auth-pool-1", "auth-pool-2", "auth-ungrouped"} {
		if !seen[id] {
			t.Fatalf("unrestricted key never saw %s; seen=%v", id, seen)
		}
	}
}

func TestPickNextLegacy_GroupRestrictionNoMatchErrors(t *testing.T) {
	model := "claude-sonnet-4-6"
	registerSchedulerModels(t, "claude", model, "auth-pool-2")

	manager := NewManager(nil, &RoundRobinSelector{}, nil)
	manager.executors["claude"] = schedulerTestExecutor{}
	manager.SetConfig(&internalconfig.Config{
		APIKeyGroups: map[string][]string{"sk-team-a": {"pool-1"}},
	})
	if _, err := manager.Register(context.Background(), &Auth{ID: "auth-pool-2", Provider: "claude", Attributes: map[string]string{GroupAttributeKey: "pool-2"}}); err != nil {
		t.Fatalf("Register error = %v", err)
	}

	// pool-1 key with only a pool-2 credential available -> no auth.
	_, _, err := manager.pickNextLegacy(ctxWithAPIKey("sk-team-a"), "claude", model, cliproxyexecutor.Options{}, map[string]struct{}{})
	if err == nil {
		t.Fatalf("expected auth_not_found error, got nil")
	}
}

func TestPickNext_HomeMode_GroupRestrictedFailsClosed(t *testing.T) {
	// When home mode is active, group isolation cannot be enforced by the local
	// dispatcher. pickNext and pickNextMixed must fail closed rather than
	// silently serving the unrestricted credential pool to a restricted caller.
	manager := NewManager(nil, &RoundRobinSelector{}, nil)
	manager.SetConfig(&internalconfig.Config{
		Home:         internalconfig.HomeConfig{Enabled: true},
		APIKeyGroups: map[string][]string{"sk-restricted": {"pool-1"}},
	})

	ctx := ctxWithAPIKey("sk-restricted")
	_, _, err := manager.pickNext(ctx, "claude", "claude-sonnet-4-6", cliproxyexecutor.Options{}, map[string]struct{}{})
	if err == nil {
		t.Fatal("pickNext: expected error for group-restricted key in home mode, got nil")
	}
	errTyped, ok := err.(*Error)
	if !ok || errTyped.Code != "group_routing_unsupported" {
		t.Fatalf("pickNext: expected group_routing_unsupported error, got %v", err)
	}

	_, _, _, err = manager.pickNextMixed(ctx, []string{"claude"}, "claude-sonnet-4-6", cliproxyexecutor.Options{}, map[string]struct{}{})
	if err == nil {
		t.Fatal("pickNextMixed: expected error for group-restricted key in home mode, got nil")
	}
	errTyped, ok = err.(*Error)
	if !ok || errTyped.Code != "group_routing_unsupported" {
		t.Fatalf("pickNextMixed: expected group_routing_unsupported error, got %v", err)
	}
}
