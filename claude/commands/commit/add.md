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

   # Amend current commit
   git commit --amend -m "Updated message"
   ```

   If the branch is part of a stack (`gh stack view --short` exits 0) and it is
   **not the top branch**, any commit — new or amended — leaves the branches
   above pointing at the old tip. Restack them:

   ```bash
   gh stack rebase --upstack
   gh stack push
   ```

   Check position with `gh stack view --short`; the top branch needs no restack.
   Never rewrite a layer whose PR is already merged or queued.

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
- **Restacking depends on position, not on whether you amended** - any commit on a non-top stack branch strands the branches above it
- **Adding a layer to a stack**: use `gh stack add -Am "message" <branch-name>` to stage, commit, and create the branch in one step. Always pass an explicit branch name so it follows the naming convention. See the `stacked-pr` skill.

---

Additional instructions (if any): $ARGUMENTS
