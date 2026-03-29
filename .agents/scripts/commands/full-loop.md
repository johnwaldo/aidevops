---
description: Start end-to-end development loop (task → preflight → PR → postflight → deploy)
agent: Build+
mode: subagent
---

Task/Prompt: `$ARGUMENTS`

**Phases:** `Claim → Branch → Develop → Preflight → PR → Review → Merge → Release → Close → Cleanup`

## Lifecycle Gate (t5096 + GH#5317 — MANDATORY)

Fatal modes: **GH#5317** (exits without PR), **GH#5096** (exits after PR). Steps: 0. Commit+PR gate (`TASK_COMPLETE`) → 1. Review bot gate (poll ≤10 min) → 2. Address critical findings → 3. Merge (`gh pr merge --squash`, no `--delete-branch` in worktrees) → 4. Auto-release (aidevops only) → 5. Issue closing comment → 6. Postflight + deploy (`FULL_LOOP_COMPLETE`) → 7. Worktree cleanup

## Step 0: Resolve Task ID

Extract first arg. If ` -- ` present, use text after (t158). Task ID (`t\d+`): resolve via TODO.md or `gh issue list`. Extract issue: `sed -En 's/.*[Ii]ssue[[:space:]]*#*([0-9]+).*/\1/p'`

**0.45 Decomposition (t1408.2):** Skip if `--no-decompose` or has subtasks. `task-decompose-helper.sh classify`. Composite: interactive → show tree; headless → auto-decompose, exit `DECOMPOSED`. Depth limit: 3.

**0.5 Claim (t1017):** Add `assignee: started:` to TODO.md. Push rejection = claimed → STOP.

**0.6 Label `status:in-progress`:** Verify issue `OPEN` (t1343/#2452), assign worker, add label, remove stale. Lifecycle: `available` → `queued` → `in-progress` → `in-review` → `done`.

**0.7 Label dispatch model:** `dispatched:{opus|sonnet|haiku}` from `$ANTHROPIC_MODEL`.

**0.8 Label session origin:** `origin:worker` or `origin:interactive` via `shared-constants.sh`.

**1.7 Lineage (t1408.3):** If `TASK LINEAGE:` block, only implement `<-- THIS TASK`, stub siblings.

## Step 1: Branch Setup

`pre-edit-check.sh --loop-mode --task "$ARGUMENTS"` — Exit 0 = feature branch; Exit 2 = main, auto-create worktree.

**1.5 Operation Verification (t1364.3):** `verify-operation-helper.sh`. Critical/high → block or verify.

Start: `full-loop-helper.sh start "$ARGUMENTS" --background`. Headless: `--headless` or `FULL_LOOP_HEADLESS=true`.

## Step 3: Task Development

Iterate until `<promise>TASK_COMPLETE</promise>`.

**Completion criteria:** Requirements `[DONE]`; tests/lint/shellcheck clean; README gate (t099); conventional commits; actionable finding coverage; runtime testing (t1660.7); **Commit+PR gate (GH#5317)** — no uncommitted changes, PR exists.

**Runtime testing (t1660.7):** Critical/High (payment, auth, polling, WebSocket) → `runtime-verified` or BLOCK. Medium (UI, config, DB) → `runtime-verified` if dev env, else `self-assessed`. Low (docs, types) → `self-assessed`. `--skip-runtime-testing` for emergency only.

**Headless rules (t158/t174):** Never prompt; don't edit TODO.md; auth fail → retry 3x, exit; `git pull --rebase` before push; PROCEED for style ambiguity, EXIT for API breaks/missing deps; time budget 45→self-check, 90→draft PR, 120→stop; push fail → rebase retry, then BLOCKED.

**Key rules:** Parallelism (t217) — Task tool for concurrent ops. CI (t1334) — read logs first. Blast radius (t1422) — quality-debt PRs ≤5 files.

## Step 4: PR, Review & Merge

**4.1 Preflight:** Quality checks, auto-fixes.

**4.2 PR Create:** Rebase onto `origin/main`, push, create PR. **`Closes #NNN` MANDATORY.** Signature: `gh-signature-helper.sh footer`. Origin label: `origin:worker` or `origin:interactive`.

**4.3 Label `status:in-review` (t1343):** Check issue `OPEN` before modifying.

**4.4 Review Bot Gate (t1382):** `review-bot-gate-helper.sh check`. Poll 60s ≤10 min.

**4.5 Merge:** `gh pr merge --squash` (no `--delete-branch` in worktrees).

**4.6 Auto-Release (aidevops only):** `version-manager.sh bump patch`, tag, `gh release create`, `setup.sh`.

**4.7 Issue Closing Comment:** What done, Testing Evidence, Key decisions, Files changed, Follow-up. Signature: `gh-signature-helper.sh footer --solved`. Gate — no `FULL_LOOP_COMPLETE` until posted.

**4.8 Postflight + Deploy:** Verify health, `setup.sh --non-interactive`. Emit: `<promise>FULL_LOOP_COMPLETE</promise>`

**4.9 Worktree Cleanup (GH#6740):** `cd` to canonical dir, `git pull`, `worktree-helper.sh remove --force`, delete remote branch. See `worktree-cleanup.md`.

## Options

| Option | Description |
|--------|-------------|
| `--background`, `--bg` | Run in background |
| `--headless` | Fully headless worker mode |
| `--max-task-iterations N` | Max task iterations (default: 50) |
| `--max-preflight-iterations N` | Max preflight iterations (default: 5) |
| `--max-pr-iterations N` | Max PR review iterations (default: 20) |
| `--skip-preflight` | Skip preflight checks |
| `--skip-postflight` | Skip postflight monitoring |
| `--no-auto-pr` | Pause for manual PR creation |
| `--no-auto-deploy` | Don't auto-run setup.sh |
| `--skip-runtime-testing` | Skip runtime testing gate (emergency only) |

## Related

`workflows/ralph-loop.md` · `workflows/preflight.md` · `workflows/pr.md` · `workflows/postflight.md` · `workflows/changelog.md` · `workflows/worktree-cleanup.md`
