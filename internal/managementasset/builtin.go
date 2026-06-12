package managementasset

import (
	_ "embed"
	"os"
	"strings"
)

// builtinManagementHTML is replaced by the frontend build sync script.
//
//go:embed builtin/management.html
var builtinManagementHTML []byte

// BuiltinHTML returns the embedded management panel asset.
func BuiltinHTML() []byte {
	return builtinManagementHTML
}

// HasStaticOverride reports whether MANAGEMENT_STATIC_PATH is configured.
func HasStaticOverride() bool {
	return strings.TrimSpace(os.Getenv("MANAGEMENT_STATIC_PATH")) != ""
}
