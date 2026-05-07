<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->
# t1926: routine-log-helper.sh — issue description updates and execution tracking

## Origin

- **Created:** 2026-04-08
- **Session:** OpenCode interactive
- **Created by:** marcus + ai-interactive
- **Conversation context:** Design decision: issue description = living summary (rewritten after each execution), comments = discussions with the LLM for modification requests or questions. Detailed logs stay local. Script-only routines show $0 cost.

## What

New helper script that updates routine tracking issue descriptions with living summary metrics after each execution. Posts comments only for notable events (streak breaks, budget thresholds). The issue description is the quick-reference view; local logs have the detail.

## Why

Execution logs as issue comments create noise — dozens of identical entries obscuring actual discussion. The issue description as a living summary means you open the issue and immediately see current state. Comments are reserved for user-LLM conversations about modifications, questions, and notable events only.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** — 1 new file, but complex gh API integration
- [ ] **Complete code blocks for every edit?** — function signatures, not verbatim
- [x] **No judgment or design decisions?** — format specified
- [ ] **No error handling or fallback logic to design?** — gh API error handling
- [ ] **Estimate 1h or less?** — ~2h
- [ ] **4 or fewer acceptance criteria?** — 7

**Selected tier:** `tier:standard`

**Tier rationale:** Single new file but requires gh API integration for issue body editing, streak tracking, period aggregation logic.

## How (Approach)

### Files to Modify

- `NEW: .agents/scripts/routine-log-helper.sh` — model on `contribution-watch-helper.sh` for gh API patterns

### Implementation Steps

1. Create `routine-log-helper.sh` with subcommands:

   - `update <routine-id> --status success|failure --duration SECONDS [--tokens N] [--cost AMOUNT]`
     - Reads current issue body via `gh issue view --json body`
     - Updates metrics table (last run, last result, next run, streak, cost)
     - Computes period summary (last 7 days from local logs)
     - Rewrites issue body via `gh issue edit --body`
     - `run:` routines always show $0.00 cost

   - `notable <routine-id> --event "description"`
     - Posts a comment for notable events only
     - Uses `gh-signature-helper.sh footer` for comment signature

   - `create-issue <routine-id> --repo SLUG --title "rNNN: Title"`
     - Creates the initial tracking issue with template description
     - Returns issue number for storage in routine-state.json

   - `status`
     - Prints summary table of all routine issues across repos

2. Issue description template (rewritten by `update`):
   ```markdown
   ## rNNN: Routine Title

   | Field | Value |
   |-------|-------|
   | Schedule | {repeat expression} |
   | Type | script (`path`) / agent (`name`) |
   | Status | active / paused |
   | Last run | {ISO timestamp} |
   | Last result | {success/failure} ({duration}) |
   | Next run | {ISO timestamp} |
   | Streak | {N} consecutive {successes/failures} |
   | Total cost | ${amount} |

   ### Latest Period ({start} — {end})
   {N}/{M} runs succeeded. Total cost: ${amount}. Avg duration: {Xm Ys}.

   **Detailed logs**: `~/.aidevops/.agent-workspace/cron/{routine-id}/`
   ```

3. Local log reads: the helper reads `~/.aidevops/.agent-workspace/cron/<routine-id>/` to compute period aggregates. It does not push raw logs to git.

### Verification

```bash
~/.aidevops/agents/scripts/routine-log-helper.sh --help
# Verify it can parse its own template
echo '| Last run |' | grep -q 'Last run'
```

## Acceptance Criteria

- [ ] `routine-log-helper.sh update r001 --status success --duration 108` rewrites issue description
  ```yaml
  verify:
    method: bash
    run: "test -f .agents/scripts/routine-log-helper.sh && grep -q 'update' .agents/scripts/routine-log-helper.sh"
  ```
- [ ] Streak counter increments on consecutive same-status results and resets on status change
- [ ] Period summary aggregates last 7 days of execution data from local logs
- [ ] `run:` routines show $0.00 cost; `agent:` routines show actual token cost
- [ ] Notable events (streak breaks, budget thresholds) posted as comments, not description updates
- [ ] `routine-log-helper.sh status` prints summary table of all routines
- [ ] Detailed logs remain in `~/.aidevops/.agent-workspace/cron/` (never pushed to git)

## Context & Decisions

- Issue description as living summary (not comments) — keeps issues scannable
- Comments reserved for user discussions and notable events only
- Script-only routines always show $0.00 — don't count script execution as "cost"
- Period = last 7 days by default, computed from local log directory timestamps
- `gh issue edit --body` to rewrite description; `gh issue comment --body` for notables

## Relevant Files

- `.agents/scripts/contribution-watch-helper.sh` — gh API patterns to model on
- `.agents/scripts/gh-signature-helper.sh` — footer for notable-event comments
- `~/.aidevops/.agent-workspace/cron/` — local log directory (existing)
- `.agents/reference/routines.md` — format reference (created by t1923)

## Dependencies

- **Blocked by:** t1924 (routines repo with issues), t1925 (execution provides data)
- **Blocks:** nothing
- **External:** `gh` CLI for issue API

## Estimate Breakdown

| Phase | Time | Notes |
|-------|------|-------|
| Research/read | 15m | Read contribution-watch-helper.sh patterns |
| Implementation | 1.5h | Helper script with 4 subcommands |
| Testing | 30m | Test update, notable, create-issue, status |
| **Total** | **~2h** | |
