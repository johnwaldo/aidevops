<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->

# Task Brief - t1919: Fix resolve_api_key subshell export bug

## Context
- **Session Origin**: Interactive review of GH#17755
- **Issue**: [GH#17755](https://github.com/marcusquinn/aidevops/issues/17755)
- **File**: `.agents/scripts/model-availability-helper.sh`

## What
Fix `resolve_api_key()` so API key resolution works when called via `$()` command substitution. Currently, `export` inside the subshell never reaches the parent shell, causing headless worker dispatch to fail in clean environments.

## Why
`probe_provider()` calls `resolve_api_key` in a `$()` subshell (L796). The `export` at L314 (gopass) and `source` at L327 (credentials.sh) only affect the subshell's environment. When `_get_key_value()` (L340) subsequently checks `${!var_name}` in the parent shell, the variable is empty — returning exit 3 ("Key var found but empty"). This blocks all headless dispatch when keys aren't pre-loaded in the environment.

## How
1. EDIT: `.agents/scripts/model-availability-helper.sh:285-337` — change `resolve_api_key()` to echo the resolved key value directly instead of relying on `export` side-effects. Update the security comment at L283 to document that the function now outputs the key value (callers must capture in local vars, never log).
2. EDIT: `.agents/scripts/model-availability-helper.sh:794-806` — simplify `probe_provider()` to use a single call: `api_key=$(resolve_api_key "$provider")`. Remove the separate `_get_key_value` call.
3. EDIT: `.agents/scripts/model-availability-helper.sh:340-361` — review `_get_key_value()` for removal or update to match new semantics.
4. EDIT: `.agents/scripts/model-availability-helper.sh:1359-1364` — update `cmd_probe()` call site to match new `resolve_api_key` return semantics.

**Reference pattern**: Follow standard shell idiom — functions echo values, callers capture via `$()`. Model on existing helper functions that already use this pattern.

**Security consideration**: `resolve_api_key` currently echoes the var name (not the value) with a security comment at L283. The fix changes this — callers must ensure the value is captured in a `local` variable and never logged/printed.

## Acceptance Criteria
- [ ] `resolve_api_key` echoes the key value directly (not the var name).
- [ ] `probe_provider` works in a clean subshell environment (no pre-loaded keys).
- [ ] `_get_key_value` is updated or removed.
- [ ] All call sites updated to match new return semantics.
- [ ] No key values appear in any log output.
- [ ] Verification: `env -i HOME="$HOME" PATH="$PATH" bash --norc --noprofile -c 'source ~/.aidevops/agents/scripts/model-availability-helper.sh; api_key=$(resolve_api_key "ANTHROPIC_API_KEY"); echo "length: ${#api_key}"'` — should show non-zero length.
- [ ] Verification: `model-availability-helper.sh probe --target anthropic` succeeds in a clean environment.
