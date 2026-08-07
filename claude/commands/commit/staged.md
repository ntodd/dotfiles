---
description: Commit already-staged changes with a quality message
argument-hint: [instructions]
---

# Commit Staged Changes

The user has already staged exactly what they want to commit. Review the staged changes, prepare a high-quality commit message, and commit. Follow the `git-workflow` skill for commit message conventions.

## Workflow

1. **Review staged changes**:
   - Run `git status` to see which files are staged
   - Run `git diff --staged` to see the actual changes
   - Run `git log --oneline -5` to understand recent commit message style

2. **Analyze the changes**:
   - Understand what changed and why
   - Identify the primary purpose (bug fix, feature, refactor, docs, etc.)

3. **Commit**:

   ```bash
   # Create a new commit
   git commit -m "Your commit message"

   # Amend the current commit (if user asks to amend)
   git commit --amend -m "Updated commit message"
   ```

   If the branch is part of a stack (`gh stack view --short` exits 0) and it is
   **not the top branch**, restack so the branches above pick up the new tip.
   This applies to a plain commit as much as to an amend:

   ```bash
   gh stack rebase --upstack
   gh stack push
   ```

4. **Verify**: Run `git status` after committing to confirm success

## Important Notes

- **Trust the staged changes** - The user has already decided what to commit
- **Never add additional files** - Only commit what's already staged
- **Focus on the message** - Craft a clear, informative commit message following the `git-workflow` skill conventions
- **Match repo style** - Look at recent git history for style cues
- **Restack after any commit on a non-top stack branch** - amend or not, the branches above are now stale

---

Additional instructions (if any): $ARGUMENTS
