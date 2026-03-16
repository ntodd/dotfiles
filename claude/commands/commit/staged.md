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

   # Amend on a stacked branch (restacks descendants)
   gt modify -m "Updated commit message"
   ```

4. **Verify**: Run `git status` after committing to confirm success

## Important Notes

- **Trust the staged changes** - The user has already decided what to commit
- **Never add additional files** - Only commit what's already staged
- **Focus on the message** - Craft a clear, informative commit message following the `git-workflow` skill conventions
- **Match repo style** - Look at recent git history for style cues
- **Use `gt modify` only when amending in the middle of a stack** - it auto-restacks descendants

---

Additional instructions (if any): $ARGUMENTS
