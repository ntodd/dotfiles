---
description: Deep-dive code review of local changes before committing
argument-hint: [base-ref]
---

# Local Code Review

Review uncommitted and staged local changes using the `code-review` skill.

## Fetch Local Changes

Determine what to diff against. If `$ARGUMENTS` is provided, use it as the base ref (e.g., `main`, `HEAD~3`, a commit SHA). Otherwise, diff against the merge base with `main`.

Run these in parallel:

```bash
git diff $(git merge-base main HEAD)
```

```bash
git diff $(git merge-base main HEAD) --name-only
```

```bash
git status --short
```

```bash
git log --oneline $(git merge-base main HEAD)..HEAD
```

If `$ARGUMENTS` is provided, replace `$(git merge-base main HEAD)` with `$ARGUMENTS` in the commands above.

If there are no changes, report "No changes to review" and stop.

Include both committed changes on the branch AND any uncommitted/staged changes in the review scope.

## Review

Follow the `code-review` skill with the diff and changed files from above.

$ARGUMENTS
