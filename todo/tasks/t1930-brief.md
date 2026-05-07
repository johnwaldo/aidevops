---
mode: subagent
---

# t1930: Optimize memory-pressure-monitor _check_processes performance (~25s to <2s)

## Origin

- **Created:** 2026-04-08
- **Session:** claude-code:interactive
- **Created by:** ai-interactive (review of GH#17825)
- **Conversation context:** Issue #17825 reported `_check_processes` taking ~25s per cycle on macOS due to O(patterns x processes) fork storms. Review confirmed the diagnosis and identified three compounding causes.

## What

Optimize `_check_processes()` in `memory-pressure-monitor.sh` to complete in <2s instead of ~25s. Eliminate per-line subprocess forks for `basename` and per-match subprocess forks for `_get_process_age`. Bump default `DAEMON_INTERVAL` to a sensible laptop value.

## Why

The daemon runs every 60s by default. A 25s check cycle means 42% CPU duty cycle just for monitoring — unacceptable on battery-powered devices. The reporter's 300s workaround reduces monitoring responsiveness 5x. The root cause is algorithmic, not a tuning problem.

## Tier

### Tier checklist (verify before assigning)

- [ ] **2 or fewer files to modify?** — Yes (1 file + 1 test)
- [x] **Complete code blocks for every edit?** — No, requires rewriting loop logic
- [ ] **No judgment or design decisions?** — Needs awk pattern matching design
- [x] **No error handling or fallback logic to design?** — Some edge cases in awk
- [x] **Estimate 1h or less?** — Yes
- [x] **4 or fewer acceptance criteria?** — Yes

**Selected tier:** `tier:standard`

**Tier rationale:** Single file but requires rewriting the inner loop from bash to awk/batched-ps, with edge case handling for regex patterns and process age formatting. Not copy-pasteable.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/memory-pressure-monitor.sh:383-386` — replace `basename` subprocess with parameter expansion
- `EDIT: .agents/scripts/memory-pressure-monitor.sh:264-295` — batch `_get_process_age` to accept comma-separated PIDs
- `EDIT: .agents/scripts/memory-pressure-monitor.sh:360-435` — rewrite `_check_processes` inner loop to collect PIDs first, then batch-fetch etime
- `EDIT: .agents/scripts/memory-pressure-monitor.sh:94` — bump default `DAEMON_INTERVAL` from 60 to 120
- `EDIT: tests/test-memory-pressure-monitor.sh` — add timing assertion for `_check_processes`

### Implementation Steps

1. **Replace `basename` fork with parameter expansion** (line 386):

```bash
# OLD (forks per line):
cmd_name=$(basename "$cmd_path" 2>/dev/null || echo "unknown")

# NEW (zero forks):
cmd_name="${cmd_path##*/}"
[[ -z "$cmd_name" ]] && cmd_name="unknown"
```

2. **Batch `_get_process_age`** — instead of calling `ps -p "$pid" -o etime=` per matched process (line 289), collect all matched PIDs in the loop, then make ONE call after the loop:

```bash
# After the pattern-matching loop, batch-fetch etime for all matched PIDs:
local pid_list
pid_list=$(printf '%s,' "${matched_pids[@]}")
pid_list="${pid_list%,}"  # trim trailing comma

# Single ps call for all PIDs
local -A pid_etime_map
while IFS= read -r line; do
    local p_pid p_etime
    p_pid=$(echo "$line" | awk '{print $1}')
    p_etime=$(echo "$line" | awk '{print $2}')
    pid_etime_map["$p_pid"]="$p_etime"
done < <(ps -p "$pid_list" -o pid=,etime= 2>/dev/null)
```

3. **Bump default interval** (line 94):

```bash
DAEMON_INTERVAL="${MEMORY_DAEMON_INTERVAL:-120}"
```

4. **Update the interval help text** (line 1092) to reflect the new default.

### Verification

```bash
# Performance: should complete in <2s
time ~/.aidevops/agents/scripts/memory-pressure-monitor.sh --check

# Correctness: existing tests still pass
bash tests/test-memory-pressure-monitor.sh

# Shell quality
shellcheck .agents/scripts/memory-pressure-monitor.sh
```

## Acceptance Criteria

- [ ] `_check_processes` completes in <2s on a typical macOS system (~500 processes)
  ```yaml
  verify:
    method: bash
    run: "timeout 5 bash -c 'time ~/.aidevops/agents/scripts/memory-pressure-monitor.sh --check 2>&1' | grep -q real"
  ```
- [ ] No `basename` subprocesses in `_check_processes` (parameter expansion only)
  ```yaml
  verify:
    method: codebase
    pattern: "basename"
    path: ".agents/scripts/memory-pressure-monitor.sh"
    expect: absent
  ```
- [ ] Single batched `ps` call for process age instead of per-PID forks
  ```yaml
  verify:
    method: bash
    run: "grep -c 'ps -p.*etime' .agents/scripts/memory-pressure-monitor.sh | xargs test 2 -ge"
  ```
- [ ] Default `DAEMON_INTERVAL` is 120s (not 60s)
  ```yaml
  verify:
    method: bash
    run: "grep 'DAEMON_INTERVAL.*:-120' .agents/scripts/memory-pressure-monitor.sh"
  ```
- [ ] shellcheck clean
  ```yaml
  verify:
    method: bash
    run: "shellcheck .agents/scripts/memory-pressure-monitor.sh"
  ```

## Context & Decisions

- `pgrep` approach rejected: loses RSS data, still needs a second `ps` call. Partial fix.
- Caching approach rejected: masks the problem, doesn't fix the O(n) fork cost.
- 300s interval is the reporter's workaround — acceptable as stopgap but 120s is a better default after optimization.
- The `basename` at line 998 (self-path detection) is unrelated and should NOT be changed — it runs once at startup, not in the hot loop.

## Relevant Files

- `.agents/scripts/memory-pressure-monitor.sh:360-435` — `_check_processes` function (hot path)
- `.agents/scripts/memory-pressure-monitor.sh:264-295` — `_get_process_age` function (per-PID fork)
- `.agents/scripts/memory-pressure-monitor.sh:106-116` — `MONITORED_PATTERNS` array
- `tests/test-memory-pressure-monitor.sh` — existing test suite

## Dependencies

- **Blocked by:** none
- **Blocks:** none
- **External:** none

## Estimate Breakdown

| Phase | Time | Notes |
|-------|------|-------|
| Research/read | 10m | Review _check_processes and _get_process_age |
| Implementation | 40m | Rewrite inner loop, batch ps, parameter expansion |
| Testing | 10m | Timing check, shellcheck, existing tests |
| **Total** | **~1h** | |
