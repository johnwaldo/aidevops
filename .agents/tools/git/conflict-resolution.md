---
description: Git merge, rebase, and cherry-pick conflict resolution strategies and workflows
mode: subagent
tools:
  read: true
  write: false
  edit: true
  bash: true
  glob: false
  grep: true
  webfetch: false
  task: false
---

# Git Conflict Resolution

<!-- AI-CONTEXT-START -->

## Quick Reference

- **Recommended config**: `git config --global merge.conflictstyle diff3` (or zdiff3 on Git 2.35+) + `git config --global rerere.enabled true`
- **Conflict markers**: `<<<<<<<` (ours), `|||||||` (base, with diff3), `=======`, `>>>>>>>` (theirs)
- **Strategy options**: `-Xours` (our side wins conflicts), `-Xtheirs` (their side wins), `-Xignore-space-change`
- **Key commands**: `git merge --abort`, `git checkout --ours/--theirs <file>`, `git log --merge -p`
- **Resolution rules**: Diff is truth, surgical resolution, structure vs values, check migrations, escalate ambiguity (see Intent-Based Resolution Rules)

**Decision Tree** -- when you hit a conflict:

```text
Conflict detected
  |
  +-- Can you abort safely?
  |     YES --> git merge/rebase/cherry-pick --abort
  |     NO  --> continue below
  |
  +-- Is it a single file, clear which side wins?
  |     YES --> git checkout --ours/--theirs <file> && git add <file>
  |     NO  --> continue below
  |
  +-- Is it a code conflict needing both changes?
  |     YES --> Edit file manually, combine both intents, git add <file>
  |     NO  --> continue below
  |
  +-- Is it a binary or lock file?
        YES --> git checkout --ours/--theirs <file> && git add <file>
               (then regenerate lock file if needed)
```

**Quick resolution commands**:

```bash
git status                          # see conflicted files
git diff                            # see conflict details
git log --merge -p                  # commits touching conflicted files
git checkout --conflict=diff3 <f>   # re-show markers with base version
git checkout --ours <file>          # take our version
git checkout --theirs <file>        # take their version
git add <file>                      # mark as resolved
git merge --continue                # finish merge (or rebase/cherry-pick --continue)
```

<!-- AI-CONTEXT-END -->

## Conflict Markers

With `diff3` style (strongly recommended — shows base version for intent reasoning):

```text
<<<<<<< HEAD (or ours)
Your changes
||||||| base
Original version before either change
=======
Their changes
>>>>>>> branch-name (or theirs)
```

Enable globally: `git config --global merge.conflictstyle diff3`
Re-generate on already-conflicted file: `git checkout --conflict=diff3 <file>`

## Resolution Strategies

### Strategy options for merge (`-X`)

| Option                  | Effect                                                           | When to use                                             |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| `-Xours`                | Our side wins on conflicts (non-conflicting theirs still merges) | Your branch is authoritative                            |
| `-Xtheirs`              | Their side wins on conflicts                                     | Accepting incoming as authoritative                     |
| `-Xignore-space-change` | Treat whitespace-only changes as identical                       | Mixed line endings, reformatting                        |
| `-Xpatience`            | Use patience diff algorithm                                      | Better alignment when matching lines cause misalignment |

**Important**: `-Xours` (strategy option) ≠ `-s ours` (strategy). The strategy discards the other branch entirely; the option only resolves conflicts in your favor while still merging non-conflicting changes.

### Per-file resolution

```bash
git checkout --ours <file>          # keep your version
git checkout --theirs <file>        # keep their version
git add <file>

# Manual 3-way merge (extract all versions)
git show :1:<file> > file.base      # common ancestor
git show :2:<file> > file.ours      # our version
git show :3:<file> > file.theirs    # their version
git merge-file -p file.ours file.base file.theirs > <file>
```

### Investigating conflicts

```bash
git log --merge -p                  # commits touching conflicted files
git log --left-right HEAD...MERGE_HEAD  # commits by side
git diff --ours                     # vs our version
git diff --theirs                   # vs their version
git diff --base                     # vs common ancestor
git ls-files -u                     # list unmerged files with stage numbers
```

## Scenario-Specific Workflows

### Merge (`git merge main`)

```bash
git merge main
git status && git diff              # identify and review conflicts
# Edit files to resolve, then:
git add <resolved-files> && git merge --continue
# Or abort: git merge --abort
```

### Rebase (`git rebase main`)

Rebase replays commits one at a time — you may resolve multiple conflicts:

```bash
git rebase main
# For each conflicted commit: resolve, then:
git add <resolved-files> && git rebase --continue
# Skip this commit: git rebase --skip
# Abort: git rebase --abort
```

### Cherry-pick

```bash
git cherry-pick <commit>
# Resolve conflicts, then:
git add <resolved-files> && git cherry-pick --continue
# Abort: git cherry-pick --abort
```

Useful cherry-pick flags:

| Flag                       | Purpose                                              |
| -------------------------- | ---------------------------------------------------- |
| `--no-commit` (`-n`)       | Apply without committing (inspect first)             |
| `-x`                       | Append "(cherry picked from ...)" to message         |
| `-m 1`                     | Cherry-pick a merge commit (specify mainline parent) |
| `--strategy-option=theirs` | Their side wins on conflicts                         |

### Stash pop

```bash
git stash pop
# Resolve conflicts, then:
git add <resolved-files>
# Note: stash is NOT dropped on conflict. After resolving:
git stash drop
```

## Common Conflict Patterns

**Both sides modified the same function**: Use `git log --merge -p` to understand each side's intent. Read the base version (with diff3), combine manually.

**File renamed on one side, modified on the other**: Git's `ort` strategy (default since Git 2.34) detects renames automatically. If it fails: `git merge -Xfind-renames=30 <branch>` (lower threshold = more aggressive detection).

**File deleted on one side, modified on the other** (`CONFLICT (modify/delete)`):

```bash
git add <file>      # keep the modified version
git rm <file>       # accept the deletion
```

**Both sides added a file with the same name (add/add)**: Use per-file resolution to pick one version.

**Lock files** (package-lock.json, yarn.lock, pnpm-lock.yaml): Never manually merge. Pick one side, then regenerate:

```bash
npm install && git add package-lock.json
```

**Binary files**: Git cannot merge. Use per-file resolution to pick one version.

## git rerere (Reuse Recorded Resolution)

Records conflict resolutions and auto-applies them on recurrence.

```bash
git config --global rerere.enabled true
```

**How it works**: On conflict, rerere saves the preimage (conflict markers). After you resolve and commit, it saves the postimage. Next time the same conflict occurs, it auto-applies your resolution — but you still need to `git add` and verify.

```bash
git rerere status               # files with recorded preimages
git rerere diff                 # current state vs recorded resolution
git rerere remaining            # files still unresolved
git rerere forget <path>        # delete a bad recorded resolution
git rerere gc                   # prune old records
```

GC config: `git config gc.rerereUnresolved 15` (days, default 15) / `git config gc.rerereResolved 60` (default 60).

**Best use cases**: Long-lived topic branches repeatedly rebased against main; test merges; integration branches merging many topic branches for CI.

**Safety**: Use `git cherry-pick --no-rerere-autoupdate <commit>` then `git rerere diff` to inspect before staging.

## Intent-Based Resolution Rules

Before resolving, understand what each side changed. Check file history for migrations:

```bash
git log --oneline --follow -- <file>        # check if file was migrated/renamed
```

**Rule 1: Diff is the source of truth.** A conflict block shows ENTIRE content from each side, not just changes. Always compare against actual diffs (`git diff --ours`, `git diff --theirs`) to identify which lines were modified vs unchanged context.

**Rule 2: Surgical resolution.** Resolve only lines actually changed by each side. Never accept an entire conflict block without verifying each line against the actual diff.

**Rule 3: Structure from one side, values from the other.** When conflicts arise from infrastructure changes (package renames, import paths) on one side and business logic on the other: keep infrastructure changes from the side that made them, apply business values from the other.

**Rule 4: Modify/delete — check for migration.** Do NOT blindly accept either side. Check `git log --follow -- <file>` — a deleted file may have been renamed or refactored into another file. If so, apply the modifications to its successor instead.

**Rule 5: Custom values win over upstream defaults (rebase).** When rebasing over upstream, custom values (sizes, colors, copy) take priority over upstream defaults. Upstream provides structure, customizations provide intent.

**Rule 6: Clean up after resolution.** Remove orphaned imports and unused variables left behind after replacing code from one side with the other.

**Rule 7: Escalate ambiguous resolutions.** When not confident, DO NOT guess — resolve what you can and escalate the rest.

**Escalate when:**
- You cannot confidently map a diff change to a specific location (code was refactored, split, or reformatted)
- The resolution would require adding content that exists in neither side
- You feel the need to modify a file that git did not mark as conflicted

**Format:**

```text
ESCALATE: <file> | <description of ambiguity> | <options you see>
```

Continue resolving all non-ambiguous conflicts normally. Return escalations at the end so the caller can collect user decisions and resume.

## AI-Assisted Conflict Resolution

1. **Enable diff3** — gives the AI the base version for reasoning about intent
2. **Provide context** — run `git log --merge -p` and share the output
3. **Review carefully** — AI may not understand project conventions, build implications, or runtime behavior

AI works well for: code conflicts where both sides add different features; import/export conflicts; configuration file conflicts.

AI needs human review for: generated files (schemas, lock files — regenerate instead); database migrations (ordering matters); security-sensitive code.

## Prevention

```bash
git config --global merge.conflictstyle diff3
git config --global rerere.enabled true
git config --global pull.rebase true
git config --global diff.algorithm histogram
```

| Practice             | Effect                                                               |
| -------------------- | -------------------------------------------------------------------- |
| Frequent integration | Merge/rebase from main often -- small conflicts early                |
| Small PRs            | Fewer files changed = fewer conflicts                                |
| Rebase before PR     | `git rebase main` surfaces conflicts in your branch                  |
| Worktrees            | Parallel work without stash conflicts (see `tools/git/worktrunk.md`) |
| Feature flags        | Ship disabled features to main early -- avoid long-lived branches    |

## Error Recovery

```bash
# Undo a completed merge (before push)
git reset --hard HEAD^

# Undo a completed merge (after push) -- creates a revert commit
git revert -m 1 <merge-commit>

# Find lost commits after a bad reset
git reflog
git checkout <lost-commit-sha>
```

## Related

- `tools/git/worktrunk.md` -- Worktree management (conflict prevention)
- `workflows/git-workflow.md` -- Branch-first development
- `workflows/pr.md` -- PR creation and merge
- `workflows/branch.md` -- Branch management
- `workflows/branch/release.md` -- Cherry-pick for releases
- `tools/git/lumen.md` -- Visual diff viewer for conflict review
