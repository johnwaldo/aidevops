<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->

# t1893: Failure-loop circuit breaker: tiered model escalation before user reassignment

## Origin

- **Created:** 2026-04-05
- **Author:** ai-interactive
- **Source:** Review of PR #621 (t164) — user questioned what happens when a worker self-assigns and continually fails to produce work. Stale claim detection (t1263) only handles dead sessions; global circuit breaker (t1331) pauses all dispatch. Neither addresses a live worker repeatedly failing the same task.

## What

Three-tier escalation for tasks that fail dispatch repeatedly:

1. **Tier 1 — Model upgrade**: Re-dispatch to the highest model tier the assigned user has available (e.g., haiku failed → try sonnet → try opus)
2. **Tier 2 — User rotation**: Release assignment so another registered user can attempt with their highest-level model
3. **Tier 3 — Maintainer assignment**: Assign to repo maintainer with a `needs:maintainer` label

No separate worker stats tracking — the repo's issues and PRs already serve as the success/failure audit trail and reflect current codebase state better than decaying historical stats.

## Why

Multiple tasks in TODO.md show "Max retries exceeded: clean_exit_no_signal" and "Re-prompt dispatch failed: clean_exit_no_signal" — these tasks get stuck indefinitely. The current circuit breaker (t1331) pauses ALL dispatch after N consecutive failures, which is a blunt instrument. The stale claim detector (t1263) only catches dead sessions (>24h with no process). Neither handles a worker that is alive but repeatedly failing the same task.

The escalation strategy is:
- Cheapest fix first (model upgrade costs more tokens but same user/auth/context)
- Broadest fix second (different user may have different model access, different approach)
- Human-in-the-loop last (maintainer review when automation exhausts its options)

## How

1. **Dispatch attempt tracking** — In `supervisor-helper.sh` or `pulse-wrapper.sh`, track dispatch attempts per task (likely in supervisor DB or as TODO.md metadata like `dispatch_attempts:N`). Increment on each dispatch, reset on success (merged PR or verified completion).

2. **Tier 1 threshold** (e.g., 2 failed attempts at current model tier):
   - Read the task's current `model:` tag and the user's available model tiers from `repos.json` or account pool
   - Re-dispatch at the next higher tier: haiku → sonnet → opus
   - Update the task's `model:` tag in TODO.md

3. **Tier 2 threshold** (e.g., 2 failed attempts at highest available tier):
   - Remove `assignee:` from the task in TODO.md
   - Add `needs:fresh-eyes` label to the GitHub issue
   - The next pulse cycle for a different registered user picks it up

4. **Tier 3 threshold** (e.g., failed by 2+ different users):
   - Assign to repo `maintainer` (from `repos.json`)
   - Add `needs:maintainer` label to the GitHub issue
   - Remove from auto-dispatch pool (`#manual` tag)

Key files:
- `.agents/scripts/supervisor-helper.sh` — dispatch logic, state transitions
- `.agents/scripts/pulse-wrapper.sh` — dispatch orchestration, circuit breaker integration
- `.agents/scripts/claiming.sh` — claim/unclaim flows
- `.agents/configs/aidevops.json` — threshold configuration

## Acceptance Criteria

- Dispatch attempts per task are tracked and visible (DB or TODO.md metadata)
- After N failures at current tier, task is re-dispatched at next higher model tier
- After exhausting model tiers for current user, assignment is released for another user
- After multiple users fail, task is assigned to maintainer with `needs:maintainer` label
- Thresholds are configurable (not hardcoded)
- No separate stats database — success/failure tracking uses existing GitHub issues/PRs
- Existing circuit breaker (t1331 global pause) still functions as a safety net
- ShellCheck clean
- Existing tests pass

## Context

- t1331 (global circuit breaker) pauses ALL dispatch after N consecutive failures — remains as safety net
- t1263 (stale claim detection) handles dead sessions (>24h, no process) — orthogonal
- t164/t165 (claiming) provides the assignment mechanism this builds on
- Multiple TODO.md tasks show "Max retries exceeded" / "Re-prompt dispatch failed" as evidence of the problem
- `repos.json` already has `maintainer` field for Tier 3 routing
- Account pool (`oauth-pool-helper.sh`) already tracks available models per user
