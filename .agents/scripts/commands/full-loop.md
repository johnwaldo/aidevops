---
description: Start end-to-end development loop (task → preflight → PR → postflight → deploy)
agent: Build+
mode: subagent
---

Task/Prompt: $ARGUMENTS

## Phases

```text
Claim → Branch Setup → Task Development → Preflight → PR Create → PR Review → Postflight → Deploy
```

## Lifecycle Gate (t5096 + GH#5317 — MANDATORY)

| # | Step | Signal |
|---|------|--------|
| 0 | Commit+PR gate — all changes committed, PR exists | `TASK_COMPLETE` |
| 1 | Review bot gate — wait for bots (poll ≤10 min) | |
| 2 | Address critical bot review findings | |
| 3 | Merge — `gh pr merge --squash` (no `--delete-branch` in worktrees) | |
| 4 | Auto-release — bump patch + GitHub release (aidevops repo only) | |
| 5 | Issue closing comment — structured comment on every linked issue | |
| 6 | Worktree cleanup — return to main, pull, prune | `FULL_LOOP_COMPLETE` |

---

## Step 0: Resolve Task ID

Extract first positional arg from `$ARGUMENTS` (ignore flags like `--max-task-iterations`).

**Supervisor dispatch (t158):** If `$ARGUMENTS` contains ` -- `, everything after is the task description.

**Task ID (`t\d+`):** Resolve description: (1) inline after ` -- `, (2) grep TODO.md, (3) `gh issue list --search "$TASK_ID"`. Set session title: `"t061: Fix login bug"`.

**Not a task ID:** Use description directly. Extract issue number:

```bash
ISSUE_NUM=$(echo "$ARGUMENTS" | sed -En 's/.*[Ii][Ss][Ss][Uu][Ee][[:space:]]*#*([0-9]+).*/\1/p' | head -1)
```

### Step 0.45: Decomposition Check (t1408.2)

Skip if `--no-decompose` or task already has subtasks. Run `task-decompose-helper.sh classify "$TASK_DESC"` → `kind` (atomic/composite). Atomic → proceed. Composite interactive → show tree, ask `[Y/n/edit]`, create child IDs via `claim-task-id.sh`, add `blocked-by:` edges. Composite headless → auto-decompose, exit `DECOMPOSED: task $TASK_ID split into $SUBTASK_COUNT subtasks ($CHILD_IDS)`. Depth limit: `DECOMPOSE_MAX_DEPTH` (default 3); at 3+ treat as atomic.

### Step 0.5: Claim Task (t1017)

Adds `assignee:<identity> started:<ISO>` to TODO.md via commit+push. Push rejection = someone else claimed → **STOP**. Skip when not a task ID or `--no-claim`.

### Step 0.6: Label Issue `status:in-progress`

Find linked issue: (1) `$ISSUE_NUM`, (2) TODO.md `ref:GH#NNN`, (3) `gh issue list --search "${TASK_ID}:"`. Check state is `OPEN` (t1343) — abort if not. Add `status:in-progress`, remove `status:available`/`queued`/`claimed`. Assign worker user.

**Label lifecycle:** `available` → `queued` → `in-progress` → `in-review` → `done`. Stale recovery: 3+ hours with no PR → pulse relabels `status:available`.

### Step 0.7: Label Dispatch Model

Detect from `$ANTHROPIC_MODEL`/`$CLAUDE_MODEL` or system prompt. Map: `*opus*`→`dispatched:opus`, `*sonnet*`→`dispatched:sonnet`, `*haiku*`→`dispatched:haiku`. Remove stale labels first.

### Step 1.7: Lineage Context (t1408.3)

If dispatch prompt contains `TASK LINEAGE:` block: only implement `<-- THIS TASK`, stub sibling dependencies, include lineage in PR body. Hard dependency not stub-able → exit `BLOCKED`.

---

## Step 1: Auto-Branch Setup

```bash
~/.aidevops/agents/scripts/pre-edit-check.sh --loop-mode --task "$ARGUMENTS"
```

Exit 0: on feature branch — proceed. Exit 2: on main — auto-create worktree.

Docs-only keywords: `readme`, `changelog`, `docs/`, `typo`. Code keywords override: `feature`, `fix`, `bug`, `implement`, `refactor`, `add`, `update`, `enhance`.

### Step 1.5: Operation Verification (t1364.3)

```bash
source ~/.aidevops/agents/scripts/verify-operation-helper.sh
result=$(verify_operation "terraform destroy" "$(check_operation "terraform destroy")")
```

Critical/high → block or verify. Moderate → log. Low → skip. Config: `VERIFY_ENABLED`, `VERIFY_POLICY`, `VERIFY_TIMEOUT` (30s), `VERIFY_MODEL` (haiku).

---

## Step 2: Start Full Loop

**Headless mode (t174):** `--headless` or `FULL_LOOP_HEADLESS=true`.

```bash
~/.aidevops/agents/scripts/full-loop-helper.sh start "$ARGUMENTS" --background
~/.aidevops/agents/scripts/full-loop-helper.sh {status|logs|cancel}
```

---

## Step 3: Task Development (Ralph Loop)

Iterate until emitting `<promise>TASK_COMPLETE</promise>`.

### Completion Criteria (ALL required)

1. All requirements implemented (list each `[DONE]`)
2. Tests passing (lint, shellcheck, type-check)
3. Generalization check — works for varying inputs
4. **README gate (t099)** — update if user-facing features change; skip for refactor/bugfix. aidevops: also run `readme-helper.sh check`
5. Conventional commits, headless rules observed
6. Every deferred finding has tracked task+issue
7. Runtime testing gate passed (see below)
8. **Commit+PR gate (GH#5317 — MANDATORY):**

    ```bash
    [[ $(git status --porcelain | wc -l | tr -d ' ') -gt 0 ]] && \
      git add -A && git commit -m "feat: complete implementation (GH#5317 commit gate)"
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$BRANCH" != "main" && "$BRANCH" != "master" ]]; then
      git push -u origin HEAD 2>/dev/null || git push origin HEAD
      gh pr view >/dev/null 2>&1 || echo "[GH#5317] No PR — proceed to Step 4"
    fi
    ```

    **Do NOT emit `TASK_COMPLETE` with uncommitted changes or no PR.**

### Actionable Finding Coverage

`findings-to-tasks-helper.sh create --input <findings.txt> --repo-path "$(git rev-parse --show-toplevel)" --source <type>`. PR body: `actionable_findings_total=N fixed_in_pr=N deferred_tasks_created=N coverage=100%`.

### Runtime Testing Gate (t1660.7 — MANDATORY)

| Risk | Patterns | Required | Gate |
|------|----------|----------|------|
| **Critical** | Payment/billing, auth/session, data deletion, crypto, credentials | `runtime-verified` | **BLOCK** if unavailable |
| **High** | Polling loops, WebSocket/SSE, state machines, form handlers, API endpoints | `runtime-verified` | **BLOCK** if unavailable |
| **Medium** | UI, CSS, routes, config, env vars, DB queries | `runtime-verified` if dev env available | **WARN**, proceed `self-assessed` |
| **Low** | Docs, comments, types-only, tests, linter/CI config, agent prompts | `self-assessed` | **PASS** |

Detection is intelligence, not regex. ANY critical pattern → entire PR requires `runtime-verified`. Use `.aidevops/testing.json` if present; otherwise detect from `package.json`/`pytest.ini`/`Cargo.toml`/`go.mod`. `testing.json` `required_level` overrides defaults. `--skip-runtime-testing`: emergency hotfixes only. PR body must include `## Runtime Testing` (level, risk, env, smoke results).

### Key Rules

- **Parallelism (t217):** Use Task tool for concurrent independent operations.
- **Replanning:** Try a different strategy before giving up.
- **CI debugging (t1334):** `gh pr checks`, `gh run view --log | grep -iE 'FAIL|Error'`.
- **Blast radius cap (t1422):** Quality-debt/simplification PRs touch **at most 5 files**.

### Headless Dispatch Rules (t158/t174 — MANDATORY)

1. Never prompt — use uncertainty framework to proceed or exit
2. Do NOT edit TODO.md or shared planning files
3. Auth failures — retry 3x then exit
4. `git pull --rebase` before push
5. **Uncertainty (t176):** PROCEED for style ambiguity, multiple valid approaches, clear intent. EXIT for contradicts codebase, breaks public API, task obsolete, missing deps/credentials, architectural decisions.
6. Time budget: 45 min → self-check. 90 min → `gh pr create --draft`, exit. 120 min → stop.
7. Dependency detection at START — missing deps → exit immediately
8. Push/PR failure — retry after rebase; still fails → exit `BLOCKED`
9. `PULSE_SCOPE_REPOS` restricts code changes (t1405); issues always allowed
10. Verify work matches issue before linking PR (t1344). Mismatch → new issue.

### Changelog

`feat:` (Added), `fix:` (Fixed), `docs:`/`perf:`/`refactor:` (Changed), `chore:` (excluded). See `workflows/changelog.md`.

---

## Step 4: Automatic Phase Progression

### 4.1 Preflight

Quality checks, auto-fix issues.

### 4.2 PR Create

Verify `gh auth`, rebase onto `origin/main`, push, create PR.

**Issue linkage (MANDATORY):** PR body MUST include `Closes #NNN`. Backtick-escape when describing bugs (PR #2512 closed wrong issue #2498).

### 4.3 Label `status:in-review`

Check issue state is `OPEN` (t1343 — MANDATORY) before modifying. Add `status:in-review`, remove `status:in-progress`. `status:done` is set by `sync-on-pr-merge` — workers don't set it.

### 4.4 Review Bot Gate (t1382 — MANDATORY)

`review-bot-gate-helper.sh check "$PR_NUMBER" "$REPO"` → `PASS`/`WAITING`/`SKIP`. Poll every 60s up to 10 min. Timeout: interactive → warn; headless → proceed (CI is hard gate).

### 4.5 Merge

`gh pr merge --squash` (no `--delete-branch` in worktrees).

### 4.6 Auto-Release (aidevops repo only — MANDATORY)

```bash
REPO_SLUG=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [[ "$REPO_SLUG" == "marcusquinn/aidevops" ]]; then
  CANONICAL_DIR="${REPO_ROOT%%.*}"
  git -C "$CANONICAL_DIR" pull origin main
  (cd "$CANONICAL_DIR" && "$HOME/.aidevops/agents/scripts/version-manager.sh" bump patch)
  NEW_VERSION=$(cat "$CANONICAL_DIR/VERSION")
  git -C "$CANONICAL_DIR" add -A && git -C "$CANONICAL_DIR" commit -m "chore(release): bump version to v${NEW_VERSION}"
  git -C "$CANONICAL_DIR" push origin main
  git -C "$CANONICAL_DIR" tag "v${NEW_VERSION}" && git -C "$CANONICAL_DIR" push origin "v${NEW_VERSION}"
  gh release create "v${NEW_VERSION}" --repo "$REPO_SLUG" --title "v${NEW_VERSION} - AI DevOps Framework" --generate-notes
  "$CANONICAL_DIR/setup.sh" --non-interactive || true
fi
```

### 4.7 Issue Closing Comment (MANDATORY)

Post structured comment on every linked issue: **What was done**, **Testing Evidence** (level, stability, smoke checks), **Key decisions**, **Files changed**, **Blockers**, **Follow-up needs**, **Released in** (aidevops only). Every section ≥1 bullet. Gate — no `FULL_LOOP_COMPLETE` until posted.

### 4.8 Worktree Cleanup

See [`worktree-cleanup.md`](worktree-cleanup.md). Never pass `--delete-branch` to `gh pr merge` from inside a worktree.

### 4.9 Postflight + Deploy

Verify release health. Deploy: `setup.sh --non-interactive` (aidevops repos only).

---

## Step 5: Human Decision Points

> `--headless`: loop never pauses — proceeds autonomously, exits if blocked.

| Point | When | Action |
|-------|------|--------|
| Merge approval | Repo requires human approval | Approve PR in GitHub |
| Rollback | Postflight detects issues | Decide rollback |
| Scope change | Task evolves beyond original | Confirm new scope |

## Step 6: Completion

```text
<promise>FULL_LOOP_COMPLETE</promise>
```

---

## Commands & Options

```bash
/full-loop "Implement feature X with tests"                    # Start
~/.aidevops/agents/scripts/full-loop-helper.sh {status|resume|cancel}
```

Flags: `--background`/`--bg` (recommended), `--headless`, `--max-task-iterations N` (50), `--max-preflight-iterations N` (5), `--max-pr-iterations N` (20), `--skip-preflight`, `--skip-postflight`, `--no-auto-pr`, `--no-auto-deploy`, `--skip-runtime-testing`.

## Related

- `workflows/ralph-loop.md`, `workflows/preflight.md`, `workflows/pr.md`, `workflows/postflight.md`, `workflows/changelog.md`
- `tools/ai-orchestration/openprose.md` — OpenProse DSL for multi-agent orchestration
