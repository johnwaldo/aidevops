---
mode: subagent
---

<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->
# t2954: fix _resolve_pulse_runtime_binary nvm path discovery + product validation

## Pre-flight

- [x] Memory recall: `pulse runtime binary resolver opencode nvm` → 0 hits — no relevant prior lessons
- [x] Discovery pass: 0 commits / 0 merged PRs / 0 open PRs touch `setup-modules/schedulers.sh::_resolve_pulse_runtime_binary` in last 14d (last touch was t2176, Apr 18, the upgrade that exposed this bug)
- [x] File refs verified: 3 refs checked, all present at HEAD (`setup-modules/schedulers.sh:178-254`, `.agents/scripts/headless-runtime-lib.sh:836-884`, `setup-modules/tool-install.sh:1547-1572`)
- [x] Tier: `tier:standard` — touches 3 files, includes regression test, dispatch-path file (auto-elevated to opus per t2819)

## Origin

- **Created:** 2026-04-27
- **Session:** Claude Code interactive (marcusquinn)
- **Created by:** ai-interactive (driven by external bug report from alex-solovyev's runner)
- **Parent task:** none (leaf)
- **Conversation context:** alex-solovyev's Linux runner ran the broken resolver for ~9 days (Apr 18-27), dispatching 0 workers across 3 slots after `aidevops-auto-update.timer` regenerated the systemd service file under a minimal PATH. The resolver swept its hardcoded path list, missed nvm (the most popular Node version manager on Linux), fell through to `~/.local/bin/claude` (Anthropic's Claude Code CLI — different product), and persisted that path as `OPENCODE_BIN`. From then on every canary check returned `config_error` and the negative cache trapped the failure for 1h cycles. He's asked for the systemic fix so update doesn't break Linux users again.

## What

Two fixes in one PR:

1. **nvm/volta/fnm path discovery** in `_resolve_pulse_runtime_binary` (setup-modules/schedulers.sh) and `_find_alternative_opencode_binary` (.agents/scripts/headless-runtime-lib.sh). The current sweeps cover macOS install paths (Homebrew, npm-global, .local/bin, bun) but not Linux Node-version-manager paths. Both functions hit the same blind spot — fix in the same PR.

2. **Product validation before persisting** in `_resolve_pulse_runtime_binary`. Currently the resolver checks only `[[ -x ]]` (file is executable). When opencode is missing and `~/.local/bin/claude` exists, it persists claude as `OPENCODE_BIN` and the dispatch path silently breaks for ~1h cycles (the canary's negative-cache TTL). Validate at BOTH read-time (rejecting an existing wrong-product persisted file) AND write-time (refusing to persist a wrong-product result).

Plus a regression test that fails without these fixes.

## Why

Per alex-solovyev's incident report:

- **Duration:** ~9 days (Apr 18-27)
- **Workers active:** 0/3 slots (100% deficit)
- **Runnable tasks queued:** ~170-200
- **`no_worker_process` events:** 3,294
- **Canary failures:** 85
- **Root cause:** the binary resolver was written for macOS install paths; misses nvm (most-common Linux Node version manager) AND has no product validation, so it silently swaps OpenCode for Claude Code CLI when only the latter is on disk.

`aidevops update` is the framework's auto-update path — when it breaks dispatch this badly on Linux, every Linux runner is affected silently. This fix makes the resolver Linux-native and product-aware so the same class of failure cannot recur.

## Tier

### Tier checklist

- [x] **2 or fewer files to modify?** — NO (3 files: 2 source + 1 new test). Use `tier:standard`.
- [x] **Dispatch-path classification (t2821):** YES — `headless-runtime-lib.sh` is in `.agents/configs/self-hosting-files.conf`. Per t2920, use `#auto-dispatch` as normal; t2819 pre-dispatch detector auto-elevates to opus. **This task is being implemented interactively — auto-dispatch is moot, no `#auto-dispatch` tag.**

**Selected tier:** `tier:standard`

**Tier rationale:** Multi-file change (2 sources + test) with validation logic that needs careful boundary testing. Pattern is well-established (mirror `_setup_validate_opencode_binary`), so no novel design — `standard` suffices.

## PR Conventions

Leaf task. PR body will use `Resolves #NNN` (issue number assigned by `issue-sync-helper.sh push t2954` once this brief lands).

## How (Approach)

### Files to Modify

- `EDIT: setup-modules/schedulers.sh:178-254` — `_resolve_pulse_runtime_binary` function. Add nvm/volta/fnm sweep before the legacy fallback; validate persisted file at read-time (step 1); validate before persisting (step 5).
- `EDIT: .agents/scripts/headless-runtime-lib.sh:868-884` — `_find_alternative_opencode_binary` function. Add nvm/volta/fnm sweep before the existing candidate loop. Same product validator already used (`_validate_opencode_binary` at line 836).
- `NEW: .agents/scripts/tests/test-resolve-pulse-runtime-binary.sh` — regression test. Model on `.agents/scripts/tests/test-basename-collision-resolver.sh` (existing fixture-driven sourced-resolver test). Cover: nvm path discovery, claude rejection at read-time, claude rejection at write-time, persistence round-trip with valid binary.

### Implementation Steps

**Step 1 — schedulers.sh nvm/volta/fnm sweep.**

Insert a new "Step 4a" block in `_resolve_pulse_runtime_binary` BEFORE the existing fixed-paths sweep (line 221). Sort version dirs newest-first (`sort -rV`) so users with multiple Node versions get the most recent opencode.

Roots to sweep:

- `$HOME/.nvm/versions/node/<ver>/bin/opencode` (nvm)
- `$HOME/.volta/tools/image/node/<ver>/bin/opencode` (volta)
- `$HOME/.local/share/fnm/node-versions/<ver>/installation/bin/opencode` (fnm — note the extra `installation/` segment)

**Step 2 — schedulers.sh product validation.**

Use `_setup_validate_opencode_binary` (already defined at `setup-modules/tool-install.sh:1553`). Both modules are sourced by `setup.sh` in the same invocation, so the function is in scope. Guard with `declare -F _setup_validate_opencode_binary >/dev/null 2>&1` so the resolver still degrades gracefully if invoked outside the setup.sh context (e.g., direct sourcing for tests).

Validation points:

- **Read (step 1, `$_persisted_file`):** if the persisted file points at an executable that fails validation, drop it and continue to re-resolve. This heals existing alex-solovyev-class state.
- **Write (just before `printf '%s\n' >"$_persisted_file"`):** only persist if validation passes. The legacy `/opt/homebrew/bin/opencode` fallback (line 242) MUST be excluded from persistence on Linux machines where that path doesn't exist.

For each candidate in the legacy fixed-paths loop (step 4), validate before accepting. The `claude` paths in that list (lines 230-232) will fail validation against the opencode signature and be skipped — effectively neutralising the broken claude fallback without removing the candidates (preserves diff scope).

**Step 3 — headless-runtime-lib.sh nvm sweep.**

Add the same three nvm/volta/fnm roots to `_find_alternative_opencode_binary` (line 868). The existing per-candidate `_validate_opencode_binary` check (line 878) already does product validation — just extend the candidate set.

**Step 4 — regression test.**

Model on `test-basename-collision-resolver.sh`. Build a fixture HOME with synthetic nvm tree (`fixture_home/.nvm/versions/node/v24.13.1/bin/opencode`), source `setup-modules/schedulers.sh` AND `setup-modules/tool-install.sh` (for the validator), override `HOME`, and assert:

1. Resolver finds the nvm-installed opencode binary.
2. When `$_persisted_file` is pre-seeded with `~/.local/bin/claude` (a real claude binary), resolver rejects it and re-resolves.
3. Resolver does NOT persist the legacy `/opt/homebrew/bin/opencode` fallback when no real opencode is reachable.
4. Round-trip: resolver finds, persists, and re-reads the same valid path.

Synthetic binaries: write tiny shell scripts that print the right `--version` output (`echo "1.14.27"` for opencode, `echo "2.1.120 (Claude Code)"` for claude), `chmod +x`. The validator in tool-install.sh runs `--version` and checks the output — these stubs satisfy it.

### Files Scope

- `setup-modules/schedulers.sh`
- `.agents/scripts/headless-runtime-lib.sh`
- `.agents/scripts/tests/test-resolve-pulse-runtime-binary.sh`
- `todo/tasks/t2954-brief.md`
- `TODO.md`

### Complexity Impact

Estimated growth on `_resolve_pulse_runtime_binary`: current ~45 lines (function body, 178-254). Adding nvm sweep (~15 lines) + read-time validation (~6 lines) + write-time validation (~6 lines) → ~72 lines. Below the 80-line advisory threshold, well below the 100-line `function-complexity` gate. No refactor required.

`_find_alternative_opencode_binary`: current ~17 lines. Adding nvm sweep (~15 lines) → ~32 lines. Comfortably under all thresholds.

### Verification

```bash
# 1. Static checks
shellcheck setup-modules/schedulers.sh .agents/scripts/headless-runtime-lib.sh \
           .agents/scripts/tests/test-resolve-pulse-runtime-binary.sh

# 2. Regression test
bash .agents/scripts/tests/test-resolve-pulse-runtime-binary.sh

# 3. Existing test suite still passes
bash .agents/scripts/tests/test-basename-collision-resolver.sh

# 4. Manual smoke (on macOS — sanity check the validator path)
source setup-modules/tool-install.sh
_setup_validate_opencode_binary "$(which opencode)"; echo "opencode rc=$?"  # expect 0
_setup_validate_opencode_binary "$(which claude)";   echo "claude rc=$?"    # expect 1
```

## Acceptance

- [x] `_resolve_pulse_runtime_binary` discovers `$HOME/.nvm/versions/node/*/bin/opencode` (and volta + fnm equivalents) before falling through to legacy paths.
- [x] `_resolve_pulse_runtime_binary` rejects a persisted-file path that fails `_setup_validate_opencode_binary`, then re-resolves and overwrites with a valid path.
- [x] `_resolve_pulse_runtime_binary` does NOT write `/opt/homebrew/bin/opencode` to `$_persisted_file` on machines where that path is non-existent or wrong-product.
- [x] `_find_alternative_opencode_binary` discovers the same nvm/volta/fnm roots.
- [x] New regression test passes locally; covers nvm discovery, claude rejection at read+write, persistence round-trip.
- [x] `shellcheck` zero violations across the three modified/new files.
- [x] Existing `test-basename-collision-resolver.sh` still passes.
