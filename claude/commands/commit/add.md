---
description: Stage and commit changes on the current branch
argument-hint: [instructions]
---

# Commit Changes

Stage and commit changes on the current branch. Follow the `git-workflow` skill for commit conventions.

## Workflow

1. **Review all changes** - Run `git status` and `git diff` to understand what changed
2. **Group changes logically** - Identify which changes belong together as a single unit of work
3. **Stage changes strategically**:
   - For all changes: `git add -A`
   - For specific files: `git add <file>`
   - For specific hunks: `git add -p <file>`
   - Review staged changes: `git diff --staged`
4. **Run quality checks** - Execute `mix precommit` before committing
5. **Commit**:

   ```bash
   # Create a new commit
   git commit -m "Your commit message"

   # Amend current commit (non-stacked branches)
   git commit --amend -m "Updated message"

   # Amend current commit (stacked branches — restacks descendants)
   gt modify -m "Updated message" -a
   ```

6. **Repeat for additional logical units** - If you have more unrelated changes, repeat steps 3-5

## Partial File Staging

When a file contains both related and unrelated changes:

```bash
git add -p lib/foundation/core/projects.ex
# y - stage this hunk, n - skip, s - split, e - edit

git commit -m "Refactor project creation logic"
```

## Pre-Commit Checklist

- [ ] Ran `mix precommit` and fixed any issues
- [ ] Each commit represents a single logical change
- [ ] Commit messages follow the `git-workflow` skill conventions
- [ ] No unrelated changes are staged together

## Notes

- **Multiple commits are encouraged** when changes represent different logical units
- **When in doubt, split it out** - it's easier to squash commits later than to split them
- **Use `gt modify` only when amending in the middle of a stack** - it auto-restacks descendants

---

Additional instructions (if any): $ARGUMENTS
