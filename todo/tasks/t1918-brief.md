---
mode: subagent
---

<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->
# t1918: Fix silent gh auth failure in approval-helper.sh under sudo on Linux

## Origin

- **Created:** 2026-04-07
- **Session:** claude-code:interactive
- **Created by:** ai-interactive (from review of GH#17754)
- **Conversation context:** User filed GH#17754 reporting that `sudo aidevops approve issue` silently fails on Linux when gnome-keyring is inaccessible under sudo. Review confirmed two bugs: silent `gh` auth failure and unchecked exit code.

## What

Fix `approval-helper.sh` so that `sudo aidevops approve` fails loudly when `gh` cannot authenticate, instead of printing a false `[OK]` message. Also document the `[owner/repo]` positional argument syntax in AGENTS.md.

## Why

The approval gate is a critical human-only security control (SSH-signed comments that workers cannot forge). A false success means the maintainer believes an issue is approved when no approval comment was posted — the issue stays unapproved but appears approved to the user. On Linux with gnome-keyring, `sudo` cannot access the desktop keyring session, so `gh` silently fails. macOS is unaffected (Keychain works under sudo with a password prompt).

## Tier

`tier:standard`

**Tier rationale:** Multi-point fix in one file requiring understanding of the sudo/keyring interaction. Narrative brief with file references is sufficient — no novel design needed.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/approval-helper.sh:266-308` — add `_require_gh_auth()` function and check `gh` command exit codes in `_approve_target()`
- `EDIT: .agents/AGENTS.md:168` — document `[owner/repo]` positional argument for `sudo aidevops approve`

### Implementation Steps

1. Add `_require_gh_auth()` function (model on existing `_require_approval_key()` at line 50):

```bash
_require_gh_auth() {
    if ! gh auth status >/dev/null 2>&1; then
        _print_error "gh authentication failed (common under sudo on Linux — gnome-keyring is inaccessible)"
        _print_info "Workaround: export GH_TOKEN before sudo, or run: sudo GH_TOKEN=\$(gh auth token) aidevops approve ..."
        return 1
    fi
    return 0
}
```

2. Call `_require_gh_auth` in `_approve_target()` after `_require_approval_key` (line 278):

```bash
    _require_approval_key "$actual_key" || return 1
    _require_gh_auth || return 1
```

3. Check exit code of `gh issue comment` / `gh pr comment` (lines 299-303) — don't print `[OK]` on failure:

```bash
    if [[ "$target_type" == "issue" ]]; then
        if ! gh issue comment "$target_number" --repo "$slug" --body "$comment_body"; then
            _print_error "Failed to post approval comment on issue #$target_number"
            return 1
        fi
    else
        if ! gh pr comment "$target_number" --repo "$slug" --body "$comment_body"; then
            _print_error "Failed to post approval comment on PR #$target_number"
            return 1
        fi
    fi
```

4. Update AGENTS.md to document the positional arg:

```markdown
`sudo aidevops approve issue <number> [owner/repo]`
```

### Verification

```bash
# ShellCheck passes
shellcheck .agents/scripts/approval-helper.sh

# Function exists
grep -q '_require_gh_auth' .agents/scripts/approval-helper.sh

# Exit code is checked (no more silent >/dev/null 2>&1 on gh comment calls)
! grep -q 'gh issue comment.*>/dev/null 2>&1' .agents/scripts/approval-helper.sh
! grep -q 'gh pr comment.*>/dev/null 2>&1' .agents/scripts/approval-helper.sh

# AGENTS.md documents the positional arg
grep -q 'owner/repo' .agents/AGENTS.md | grep -q 'approve'
```

## Acceptance Criteria

- [ ] `_require_gh_auth()` function exists and is called before posting approval comments
  ```yaml
  verify:
    method: codebase
    pattern: "_require_gh_auth"
    path: ".agents/scripts/approval-helper.sh"
  ```
- [ ] `gh issue comment` and `gh pr comment` exit codes are checked — failure prevents false `[OK]`
  ```yaml
  verify:
    method: bash
    run: "! grep -q 'gh issue comment.*>/dev/null 2>&1' .agents/scripts/approval-helper.sh && ! grep -q 'gh pr comment.*>/dev/null 2>&1' .agents/scripts/approval-helper.sh"
  ```
- [ ] Error message includes actionable workaround (`GH_TOKEN` export)
  ```yaml
  verify:
    method: codebase
    pattern: "GH_TOKEN"
    path: ".agents/scripts/approval-helper.sh"
  ```
- [ ] AGENTS.md documents `[owner/repo]` positional argument syntax
  ```yaml
  verify:
    method: bash
    run: "grep 'approve' .agents/AGENTS.md | grep -q 'owner/repo'"
  ```
- [ ] ShellCheck clean
  ```yaml
  verify:
    method: bash
    run: "shellcheck .agents/scripts/approval-helper.sh"
  ```

## Context & Decisions

- **Why option 1 (detect + error) over option 2 (auto-resolve token):** Auto-resolving the token before sudo escalation requires restructuring the sudo boundary. The helper is designed to be invoked after sudo, so the token would need to be passed as an env var from a wrapper. Clear error message with workaround is sufficient and lower complexity.
- **macOS unaffected:** Keychain works under sudo (with password prompt). This is Linux-specific but the fix is cross-platform safe.
- **Root cause is gnome-keyring isolation:** `sudo` creates a new session without `DBUS_SESSION_BUS_ADDRESS`, so `gh` cannot reach the credential store. `GH_TOKEN` env var bypasses the credential store entirely.

## Relevant Files

- `.agents/scripts/approval-helper.sh:266-308` — `_approve_target()` function with the bugs
- `.agents/scripts/approval-helper.sh:50-60` — `_require_approval_key()` pattern to follow
- `.agents/scripts/approval-helper.sh:580` — help text (already documents positional arg syntax)
- `.agents/AGENTS.md:168` — approval docs (missing `[owner/repo]` syntax)

## Dependencies

- **Blocked by:** none
- **Blocks:** none
- **External:** Linux environment for full testing (macOS can verify ShellCheck + code changes)

## Estimate Breakdown

| Phase | Time | Notes |
|-------|------|-------|
| Research/read | 10m | Review existing `_require_*` patterns |
| Implementation | 30m | Add function, check exit codes, update docs |
| Testing | 15m | ShellCheck, grep verification |
| **Total** | **~55m** | |
