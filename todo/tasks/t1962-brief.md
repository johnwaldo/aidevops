---
mode: subagent
---

<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->

# t1962: pulse-wrapper.sh phased decomposition (parent) — clear 2000-line gate via module extraction

## Origin

- **Created:** 2026-04-12
- **Session:** claude-code:interactive
- **Created by:** marcusquinn (human, interactive)
- **Parent task:** none (this is the root of the decomposition tree)
- **Conversation context:** User asked whether `pulse-wrapper.sh` (13,797 lines, 201 functions) could be simplified in one session given that the 2,000-line threshold in `_issue_targets_large_files` blocks any issue whose edit scope touches it. After dependency analysis and call-graph mapping, the answer is no — but a staged 10-phase extraction with a pre-built safety net is tractable over multiple PRs. The full plan lives at `todo/plans/pulse-wrapper-decomposition.md`.

## What

Execute a 10-phase module extraction of `pulse-wrapper.sh` into ~15 sibling `pulse-<cluster>.sh` modules, preserving behaviour exactly. Each phase is one PR (two sub-PRs for the highest-risk clusters). Final state: orchestrator under 1,000 lines, large-file gate stops firing for this file, per-module simplification becomes routine worker dispatch.

This parent task tracks the overall decomposition. It does not directly change any code — every concrete change lives in a subtask (`t1962.N`) with its own brief, GH issue, PR, and verification evidence.

## Why

- **In-place shrinking has failed.** Six or more prior simplification PRs tightened individual functions (GH#5627, GH#6770, GH#11066, GH#12095, GH#14960, GH#17497). The file kept growing because new subsystems (queue governor, fast-fail, FOSS scan, simplification-state, NMR cache, dep-graph, routines, cycle index) were co-located.
- **The large-file gate creates a deadlock.** Any issue whose `EDIT:` scope lists `pulse-wrapper.sh` is auto-labelled `needs-simplification`, blocking dispatch. GH#18042 added an exception for simplification-tagged issues, but unrelated small fixes still trip the gate. Tens of routine fixes wait behind this.
- **Precedent exists.** t1431 successfully extracted `stats-functions.sh` (~1,473 lines) using an include-guard pattern. The extraction template works.
- **Projected final state is well under the gate.** Decomposition arithmetic (verified): 13,797 → ~804 lines in the orchestrator (344 function lines + 435 bootstrap + ~25 source lines). Clears the 2,000-line gate with 60% headroom.

## Tier

### Tier checklist (verify before assigning)

This is a **parent tracking task**, not a single implementation. Tier assignment does not apply directly — each subtask gets its own tier based on the phase it executes. The parent task itself does no code work.

**Selected tier:** `tier:reasoning` (nominal — never dispatched directly; used for label routing only).

**Tier rationale:** The parent is coordination work. Individual phases range from `tier:standard` (Phases 1-5, mechanical leaf extractions) to `tier:reasoning` (Phases 7-9, high-coupling clusters). All phases are `origin:interactive` per §10.5 of the plan — not worker-dispatched.

## How (Approach)

### Files to Modify

- **No direct file edits.** This parent task creates and coordinates subtasks. Every concrete change is in a subtask brief.
- **Reference:** `todo/plans/pulse-wrapper-decomposition.md` (committed 2026-04-12, commit 813f176cc) is the authoritative source for:
  - The 201-function cluster map (§3.1)
  - Inter-cluster dependency edges (§3.2)
  - Global state audit (§4)
  - Phase sequence with line-count projections (§6)
  - Extraction methodology — module template, PR structure, gate checklist (§7)
  - Risk mitigations (§9)
  - Resolved decisions (§10)

### Implementation Steps

1. **Phase 0 — Safety net** (subtask `t1962.0`): characterization test harness, `--self-check` mode, `--dry-run` mode, git-diff rename guard. No code moved from `pulse-wrapper.sh`. This is the gate to all extraction phases.
2. **Phases 1-10 — Extractions** (subtasks `t1962.1` through `t1962.10`): each phase opens a subtask with its own brief that restates the phase's cluster list from the plan, includes verification steps, and documents cutover procedure. PRs follow the two-commit structure from §7.3.
3. **Phase 11 — Gate clear**: post-Phase 10, remove any `needs-simplification` labels that were gated on this file alone. No PR needed.
4. **Phase 12 — Follow-up simplifications**: now that modules exist, per-module simplification goes through normal worker dispatch. Not part of this parent; filed as separate issues.

### Verification

Parent-level verification = all subtasks complete + orchestrator under 2,000 lines:

```bash
# Check current line count
wc -l ~/Git/aidevops/.agents/scripts/pulse-wrapper.sh
# Expected after Phase 10: < 1,000

# Verify all modules present
ls ~/Git/aidevops/.agents/scripts/pulse-*.sh | grep -v wrapper | wc -l
# Expected: 15+

# Verify self-check passes
~/.aidevops/agents/scripts/pulse-wrapper.sh --self-check

# Verify dry-run cycle completes
PULSE_DRY_RUN=1 ~/.aidevops/agents/scripts/pulse-wrapper.sh

# Verify gate no longer fires for this file
grep LARGE_FILE_LINE_THRESHOLD ~/.aidevops/agents/scripts/pulse-wrapper.sh
# _issue_targets_large_files won't label pulse-wrapper.sh as needing simplification
```

## Acceptance Criteria

- [ ] Safety net landed (Phase 0) and characterization tests green
- [ ] Phases 1-10 complete, each as its own merged PR with passing smoke test
- [ ] `pulse-wrapper.sh` under 2,000 lines (target: ~804)
- [ ] `pulse-wrapper.sh --self-check` exits 0
- [ ] `PULSE_DRY_RUN=1 pulse-wrapper.sh` completes a full cycle without error
- [ ] All existing `test-pulse-wrapper-*.sh` tests still pass
- [ ] Live pulse runs for 24h post-Phase 10 without regression (no `function not found`, no `unbound variable`, no unexpected dispatch failures)
- [ ] Decomposition plan updated with lessons-learned appendix

## Context & Decisions

All architectural decisions are recorded in `todo/plans/pulse-wrapper-decomposition.md` §10:

1. **Flat module layout.** `pulse-<cluster>.sh` siblings to `pulse-wrapper.sh`. Matches `stats-functions.sh` precedent. No `setup.sh` changes needed.
2. **STOP_FLAG pause mechanism.** `touch ~/.aidevops/logs/pulse-session.stop` before merge; `rm` after smoke test. Non-destructive; in-flight workers finish; next cycle short-circuits.
3. **Hybrid characterization tests.** "Function exists" check for all 201 + behavioural tests for the 20 most-called hotspots (plan §3.2).
4. **`origin:interactive` for Phases 0-9.** Post-merge smoke test requires maintainer laptop access. No worker dispatch for these phases. Phase 10+ may use workers once the pattern is proven.
5. **Two-commit PR structure.** Commit 1 adds the new module with function copies; commit 2 removes the originals and adds `source` line. Revertible at either granularity.
6. **No refactoring during extraction.** Every PR must produce a near-zero `git diff -w -M --find-renames=90` (rename-only). Improvements are Phase 12, separate PRs, post-gate.

### Non-goals

- Does not touch `stats-functions.sh` (3,125 lines, also over the gate). Separate plan after this completes.
- Does not change pulse cadence, launchd plist, or supervisor-pulse invocation.
- Does not split large functions (`dispatch_with_dedup` 370 lines, etc.). They move intact. Per-function simplification is post-gate.
- Does not add tests to subsystems that had none. Characterization tests lock current behaviour, not correctness. Bug fixes are separate PRs.

## Relevant Files

- `todo/plans/pulse-wrapper-decomposition.md` — authoritative plan (827 lines)
- `.agents/scripts/pulse-wrapper.sh` — the file under decomposition (13,797 lines)
- `.agents/scripts/stats-functions.sh` — extraction precedent (t1431)
- `.agents/scripts/tests/test-pulse-wrapper-*.sh` — existing pulse test harness (9 files)
- `todo/tasks/t1962.0-brief.md` — Phase 0 safety net subtask (to be created)

## Dependencies

- **Blocked by:** none
- **Blocks:** every issue whose `EDIT:` scope references `pulse-wrapper.sh` and does not carry the `simplification` or `simplification-debt` label (currently held by the `_issue_targets_large_files` gate)
- **External:** none

## Estimate Breakdown

| Phase | Est | Notes |
|-------|-----|-------|
| 0 | 3h | Safety net: characterization tests (~400 lines), `--self-check` mode, `--dry-run` mode, lint & verification |
| 1 | 2h | 5 trivial leaf extractions, ~866 lines moved, one PR |
| 2 | 3h | 4 leaves with fan-in, ~1,545 lines moved, one PR; fast-fail hotspot needs extra test coverage |
| 3 | 3h | Operational plumbing, ~1,415 lines moved, one PR |
| 4 | 2.5h | Merge + PR gates co-extracted (cycle), ~973 lines, one PR |
| 5 | 3h | Cleanup + issue-reconcile, ~1,185 lines, one PR |
| 6 | 3h | Simplification cluster, ~1,973 lines, one PR |
| 7 | 3.5h | Prefetch, ~1,625 lines, one PR (validates cross-module graph end-to-end) |
| 8 | 2h | Triage, ~428 lines, one PR |
| 9a | 4h | `pulse-dispatch-core.sh`, ~1,312 lines — heart of the pulse, extended test coverage required |
| 9b | 3h | `pulse-dispatch-engine.sh`, ~954 lines |
| 10 | 2.5h | Tail: quality-debt + ancillary-dispatch, ~717 lines, one PR |
| **Total** | **~35h** | Across 11 PRs. Wall-clock: weeks, not days (paced for review + smoke test time) |
