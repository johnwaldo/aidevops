<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->
# t1965: git pre-push hook — detect private repo slug leaks in TODO.md pushes to public repos

## Origin

- **Created:** 2026-04-12
- **Session:** claude-code:interactive
- **Created by:** ai-interactive (discovered during turbostarter mirror setup)
- **Parent task:** none
- **Conversation context:** I almost committed the string `marcusquinn/turbostarter-ai` into the public `marcusquinn/aidevops:TODO.md` while adding an r005 routine for private mirror sync. The `.agents/AGENTS.md` rule forbids this, but there is no pre-commit/pre-push guard that enforces it — issue-sync-helper.sh has retroactive sanitisation for issue bodies pushed via its own path, but planning-only edits to `TODO.md` and `todo/*` bypass it (they go directly to main).

## What

A git `pre-push` hook, installed by `install-hooks-helper.sh`, that scans staged `TODO.md` and `todo/**/*.md` content about to be pushed to a public GitHub repo and blocks the push if it contains any private repo slugs from `~/.config/aidevops/repos.json`. The hook:

- Determines whether the push target is a public or private repo (via `gh api repos/OWNER/REPO --jq .private`, cached for 10 minutes in `~/.aidevops/cache/repo-privacy.json` to avoid rate-limit thrash)
- Enumerates private slugs from `initialized_repos[]` where a remote-resolvable entry has `private: true` (or falls back to static marker `pulse_private`/`mirror_upstream`/`local_only == false` with `gh api` confirmation)
- Scans only the DIFF content about to be pushed (not the whole file) to avoid flagging pre-existing historical content
- Exits 1 with a clear message if a private slug appears in the pushed diff to a public repo, naming the offending slug and the file
- Exits 0 (allow) if target is private, if no `TODO.md` or `todo/*` files are in the push, or if nothing matches
- Has a `--dry-run` / `--check` mode (for testing) that reads from stdin like `pre-push` does

## Why

The cross-repo privacy rule in `.agents/AGENTS.md` Quick Reference section and in `build.txt` is currently defended by prompt-level discipline only. In a multi-repo session the operator regularly edits public and private TODO files within minutes of each other; a single copy-paste of a routine entry across repos leaks private repo names into the public audit trail permanently (git history). The `issue-sync-helper.sh` sanitisation only covers GitHub issue bodies pushed via that helper — planning commits bypass it entirely.

A client-side pre-push hook is the earliest catchable point: it runs after commit but before network push, so the private slug never leaves the local machine. It is not authoritative (a user could `--no-verify`) but it catches the common case where an agent or human simply forgets.

## Tier

### Tier checklist

- [ ] **2 or fewer files to modify?** — 3-4 (new hook script, install-hooks-helper registration, test harness, docs update)
- [x] **Complete code blocks for every edit?** — yes (for the hook itself)
- [ ] **No judgment or design decisions?** — some: cache invalidation TTL, exit semantics, fallback behaviour when gh is unavailable
- [x] **No error handling or fallback logic to design?** — actually there IS fallback logic (offline/unauth gh)
- [x] **Estimate 1h or less?** — no, ~2h
- [x] **4 or fewer acceptance criteria?** — 5-6

**Selected tier:** `tier:standard`

**Tier rationale:** Multi-file change with real fallback design (offline gh, cache TTL, `--no-verify` discussion), security-adjacent so needs a test harness covering false positives and false negatives.

## How (Approach)

### Files to Modify

- `NEW: .agents/hooks/privacy-guard.sh` — pre-push hook body; scans stdin ref list for public targets and TODO/todo file diffs for private slug matches. Model on existing git hooks in `.agents/hooks/` if any, otherwise on `scripts/prompt-guard-helper.sh` scanning pattern.
- `NEW: .agents/scripts/privacy-guard-helper.sh` — reusable library: slug enumeration, cache, repo-privacy lookup, diff scanning. Keeps the hook itself thin and testable.
- `EDIT: .agents/scripts/install-hooks-helper.sh` — register the new pre-push hook in the install path (model on the existing PreToolUse git safety hook registration).
- `NEW: .agents/scripts/test-privacy-guard.sh` — smoke test harness that seeds a fake public repo, stages a known-bad TODO.md diff, runs the hook against it, and asserts exit code 1.
- `EDIT: .agents/AGENTS.md` "Security" or "Cross-repo privacy" section — document the hook and how to bypass with `--no-verify` for legitimate cases.

### Implementation Steps

1. Build `privacy-guard-helper.sh` with these functions:

   ```bash
   # _enumerate_private_slugs -> newline-separated slugs
   # Sources repos.json, queries gh for each slug, caches result 10m.
   # Slugs with local_only:true or pulse:false+mirror_upstream are treated as
   # likely-private without a gh call (cheaper, less noise).
   _enumerate_private_slugs() { ... }

   # _is_target_public <remote_url>
   # Returns 0 if public, 1 if private, 2 if unknown (fail-open).
   _is_target_public() { ... }

   # _scan_diff_for_slugs <ref1> <ref2> <slugs_file>
   # Prints offending lines as "file:lineno: slug".
   _scan_diff_for_slugs() { ... }
   ```

2. Build `.agents/hooks/privacy-guard.sh` as a thin pre-push hook:

   ```bash
   #!/usr/bin/env bash
   # git pre-push hook: pass '<local ref> <local sha> <remote ref> <remote sha>' on stdin
   set -euo pipefail
   source "$(dirname "$0")/../scripts/privacy-guard-helper.sh"

   remote_name="$1"
   remote_url="$2"

   # Fast path: private target, no-op
   _is_target_public "$remote_url" || exit 0

   # Enumerate private slugs once
   slugs_file=$(mktemp)
   _enumerate_private_slugs > "$slugs_file"
   trap 'rm -f "$slugs_file"' EXIT

   exit_code=0
   while read -r local_ref local_sha remote_ref remote_sha; do
       [[ "$local_sha" == "0000000000000000000000000000000000000000" ]] && continue
       # Scan only TODO.md and todo/** paths in the diff
       hits=$(_scan_diff_for_slugs "$remote_sha" "$local_sha" "$slugs_file") || true
       if [[ -n "$hits" ]]; then
           echo "BLOCKED: push contains private repo slugs in public TODO content:" >&2
           echo "$hits" >&2
           echo "Use --no-verify to bypass (audit trail preserves the override)." >&2
           exit_code=1
       fi
   done
   exit "$exit_code"
   ```

3. Register in `install-hooks-helper.sh install` so `setup.sh` wires it up automatically.

4. Test harness `.agents/scripts/test-privacy-guard.sh`:
   - Creates a temp git repo tagged as "public" via a mock repos.json
   - Stages a TODO.md containing a known-private slug from the real repos.json
   - Pipes a fake pre-push input and asserts exit 1 and error message
   - Repeats with a sanitised TODO.md and asserts exit 0

5. Document in `.agents/AGENTS.md` Quick Reference under "Cross-repo privacy" — mention the hook and the `--no-verify` escape.

### Verification

```bash
shellcheck .agents/hooks/privacy-guard.sh .agents/scripts/privacy-guard-helper.sh .agents/scripts/test-privacy-guard.sh
bash .agents/scripts/test-privacy-guard.sh

# Integration: try to push a fake bad commit and confirm block
cd /tmp && git init public-test && cd public-test
git remote add origin https://github.com/marcusquinn/aidevops.git   # public repo
echo "r999 test marcusquinn/turbostarter-ai" > TODO.md
git add TODO.md && git commit -m "bad"
git push 2>&1 | grep -q "BLOCKED" && echo "PASS: push blocked" || echo "FAIL: leak allowed"
```

## Acceptance Criteria

- [ ] `pre-push` hook blocks a push of `TODO.md` containing a private slug to a public GitHub repo (exit 1, stderr names the slug).
- [ ] Push of the same content to a private target repo is allowed (exit 0).
- [ ] Push of unrelated files (no `TODO.md` or `todo/*`) to a public target is allowed.
- [ ] Hook handles offline / unauthenticated `gh` gracefully: fails open with a stderr warning rather than blocking all pushes. Rationale: a hard fail when offline breaks legitimate work; the rule is enforced by AGENTS.md when offline.
- [ ] `install-hooks-helper.sh install` wires the hook into `.git/hooks/pre-push` for the aidevops repo.
- [ ] `test-privacy-guard.sh` passes, covering at minimum: match blocks, sanitised passes, private target passes, no-TODO-in-push passes, gh-offline fails-open.

## Context & Decisions

- **Why client-side rather than server-side:** Cheaper to build, catches the bug before anything leaves the machine, and the data never hits GitHub. A server-side GitHub Actions scan runs AFTER the private slug is in commit history, which is too late.
- **Why pre-push rather than pre-commit:** A pre-commit hook runs on every `git commit` across all branches/worktrees and punishes exploratory commits that a dev might later squash. Pre-push is the final gate before leaving the machine.
- **Why fail-open on offline gh:** A hard fail would break legitimate offline work and push the user toward `--no-verify` as a habit, defeating the purpose. Fail-open with a warning keeps the hook useful for the 99% online case without introducing a blocker people learn to bypass.
- **Why cache in `~/.aidevops/cache/repo-privacy.json` with 10m TTL:** `gh api repos/OWNER/REPO` is ~500ms and is called on every push. 10m is short enough that newly-made-private repos are caught within the same session, long enough that a rapid edit/push cycle doesn't thrash the API.
- **`--no-verify` escape:** Preserved. Rare legitimate cases exist (publishing a meta-announcement about a now-public mirror), and blocking `--no-verify` would break git's trust model.

## Relevant Files

- `.agents/AGENTS.md` Quick Reference — "Cross-repo privacy" rule this hook enforces
- `.agents/scripts/issue-sync-helper.sh` — existing server-side sanitisation (after push), for reference
- `.agents/scripts/install-hooks-helper.sh` — model for hook registration
- `.agents/hooks/git_safety_guard.py` — existing PreToolUse hook pattern (Claude-specific, but the registration flow is analogous)
- `~/.config/aidevops/repos.json` — source of the private slug list

## Dependencies

- **Blocked by:** none
- **Blocks:** none
- **External:** `gh` CLI must be authenticated (graceful degradation otherwise)

## Estimate Breakdown

| Phase | Time | Notes |
|-------|------|-------|
| Research/read | 15m | Already partial (this session) |
| Implementation | 1h | Library + hook + install + test harness |
| Testing | 30m | Test harness + manual push-blocking verification |
| PR | 15m | Review bot gate, merge |

**Total estimate:** ~2h
