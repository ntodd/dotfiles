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
gt log short
```

If the branch starts with `stack/` or `gt log short` shows it is part of a Graphite stack, note the stack context and review only the changes in this PR (not the full stack).

If the PR is not found, report the error and stop.

## Review

Follow the `code-review` skill with the diff and changed files from above.

**DO NOT submit a review or add any comments to the PR.** This is a local review only.

$ARGUMENTS
