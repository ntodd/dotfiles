---
description: Deep-dive code review of a pull request like a senior staff engineer
argument-hint: [pr-number]
---

# PR Deep-Dive Review

Review a pull request using the `code-review` skill.

## Fetch PR Context

If `$ARGUMENTS` is provided, use it as the PR number. Otherwise, detect the PR for the current branch.

Run these in parallel:

```bash
gh pr view $PR_NUMBER --json number,title,state,baseRefName,headRefName,body,url -q '.'
```

```bash
gh pr diff $PR_NUMBER
```

```bash
gh pr view $PR_NUMBER --json files -q '.files[].path'
```

```bash
gh stack view --short 2>/dev/null; echo "stack_exit=$?"
```

`stack_exit=0` means the branch is in a stack, `2` means it is not. Any other non-zero code is a real `gh stack` failure (4 = API, 6 = branch in multiple stacks) — report it rather than assuming the PR is unstacked.

If the PR is part of a stack, note the stack context and review only the changes in this PR, not the full stack. `gh pr diff` already scopes to the PR's own base, so the diff is the single layer — do not widen it to `main...HEAD`.

Stack-specific things worth flagging in the review:

- Changes that belong in a lower layer (they muddy this PR's diff and make the lower PR look untouched)
- A layer that can't stand on its own, e.g. code calling something that only exists further up the stack
- Migrations mixed into a layer that isn't independently deployable

If the PR is not found, report the error and stop.

## Review

Follow the `code-review` skill with the diff and changed files from above.

**DO NOT submit a review or add any comments to the PR.** This is a local review only.

$ARGUMENTS
