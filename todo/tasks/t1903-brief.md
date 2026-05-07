---
mode: subagent
---

<!-- SPDX-License-Identifier: MIT -->
<!-- SPDX-FileCopyrightText: 2025-2026 Marcus Quinn -->
# t1903: Suppress per-file log_success output in generate-skills.sh during normal mode

## Origin

- **Created:** 2026-04-07
- **Session:** claude-code:interactive
- **Created by:** ai-interactive
- **Parent task:** none
- **Conversation context:** User reviewed GH#17677 (external reporter asking for quieter generate-skills.sh output during `aidevops update`). Review confirmed the root cause: three generation loops each call `log_success "Generated: $skill_file"` unconditionally, producing hundreds of lines. The fix is to gate those calls behind `DRY_RUN == true`, matching the existing dry-run pattern in the same loops.

## What

`generate-skills.sh` produces per-file `log_success` lines in normal (non-dry-run) mode. With hundreds of SKILL.md files, `aidevops update` scrolls through hundreds of "Generated: ..." lines. After this task, normal mode prints only the summary count; `--dry-run` retains per-file output for debugging.

## Why

UX/DX: the verbose output obscures meaningful update output and is noise during routine `aidevops update` runs. The summary line already exists (lines 361–363) and provides sufficient feedback. Reported externally in GH#17677; maintainer accepted it.

## Tier

`tier:simple`

**Tier rationale:** Single-file edit with exact before/after code blocks provided. Worker copies blocks, runs shellcheck, done.

## How (Approach)

### Files to Modify

- `EDIT: .agents/scripts/generate-skills.sh:260-270` — gate Pattern 1 `log_success` behind `DRY_RUN == true`
- `EDIT: .agents/scripts/generate-skills.sh:291-307` — gate Pattern 2 `log_success` behind `DRY_RUN == true`
- `EDIT: .agents/scripts/generate-skills.sh:346-352` — gate Pattern 3 `log_success` behind `DRY_RUN == true`
- `EDIT: .agents/scripts/generate-skills.sh:213-221` — gate `--clean` mode `log_success` behind `DRY_RUN == true`

### Implementation Steps

1. **Pattern 1 (line 266)** — wrap the `log_success` call:

```bash
# Before:
		mkdir -p "$folder"
		generate_folder_skill "$folder" "$parent_md" >"$skill_file"
		log_success "Generated: $skill_file"

# After:
		mkdir -p "$folder"
		generate_folder_skill "$folder" "$parent_md" >"$skill_file"
		if [[ "$DRY_RUN" == true ]]; then
			log_success "Generated: $skill_file"
		fi
```

2. **Pattern 2 (line 306)** — same gate:

```bash
# Before:
		} >"$skill_file"
		log_success "Generated: $skill_file"

# After:
		} >"$skill_file"
		if [[ "$DRY_RUN" == true ]]; then
			log_success "Generated: $skill_file"
		fi
```

3. **Pattern 3 (line 351)** — same gate:

```bash
# Before:
		mkdir -p "$target_dir"
		generate_leaf_skill "$md_file" >"$skill_file"
		log_success "Generated: $skill_file"

# After:
		mkdir -p "$target_dir"
		generate_leaf_skill "$md_file" >"$skill_file"
		if [[ "$DRY_RUN" == true ]]; then
			log_success "Generated: $skill_file"
		fi
```

4. **Clean mode (line 218)** — same gate for consistency:

```bash
# Before:
		rm -f "$skill_file"
		log_success "Removed: $skill_file"

# After:
		rm -f "$skill_file"
		if [[ "$DRY_RUN" == true ]]; then
			log_success "Removed: $skill_file"
		fi
```

5. Run `shellcheck .agents/scripts/generate-skills.sh` — must be zero violations.

### Verification

```bash
# Run in normal mode — should print summary only, no per-file lines
bash .agents/scripts/generate-skills.sh --agents-dir /tmp/test-agents 2>&1 | grep "Generated:"
# Expected: no output (empty)

# Run in dry-run mode — per-file lines should still appear
bash .agents/scripts/generate-skills.sh --dry-run 2>&1 | grep "Would generate:" | head -5
# Expected: lines present

# ShellCheck
shellcheck .agents/scripts/generate-skills.sh
```

## Acceptance Criteria

- [ ] Normal mode (`generate-skills.sh` without `--dry-run`) produces zero "Generated: ..." lines
  ```yaml
  verify:
    method: bash
    run: "bash .agents/scripts/generate-skills.sh 2>&1 | grep -c 'Generated:' | grep -q '^0$'"
  ```
- [ ] `--dry-run` mode still prints "Would generate: ..." per-file lines (existing behaviour preserved)
  ```yaml
  verify:
    method: bash
    run: "bash .agents/scripts/generate-skills.sh --dry-run 2>&1 | grep -q 'Would generate:'"
  ```
- [ ] Summary line still printed in normal mode ("Generation complete: Generated: N SKILL.md files")
  ```yaml
  verify:
    method: bash
    run: "bash .agents/scripts/generate-skills.sh 2>&1 | grep -q 'Generation complete'"
  ```
- [ ] `shellcheck` reports zero violations
  ```yaml
  verify:
    method: bash
    run: "shellcheck .agents/scripts/generate-skills.sh"
  ```

## Context & Decisions

- `--verbose` flag considered and rejected: `--dry-run` already serves the debug/verbose use case. Adding a third mode adds complexity without benefit.
- Clean mode gated for consistency, even though it's less common — uniform behaviour across modes is clearer.
- No change to the `--dry-run` "Would generate:" / "Would remove:" lines — those are the debug path and should remain verbose.

## Relevant Files

- `.agents/scripts/generate-skills.sh:213-228` — clean mode loop (4th edit target)
- `.agents/scripts/generate-skills.sh:250-270` — Pattern 1 loop
- `.agents/scripts/generate-skills.sh:277-310` — Pattern 2 loop
- `.agents/scripts/generate-skills.sh:318-354` — Pattern 3 loop
- `.agents/scripts/generate-skills.sh:356-368` — summary block (no change needed)

## Dependencies

- **Blocked by:** none
- **Blocks:** nothing
- **External:** none

## Estimate Breakdown

| Phase | Time | Notes |
|-------|------|-------|
| Research/read | 5m | Read lines 213–370 of generate-skills.sh |
| Implementation | 10m | 4 × one-line wraps |
| Testing | 5m | shellcheck + smoke test dry-run vs normal |
| **Total** | **~20m** | |
