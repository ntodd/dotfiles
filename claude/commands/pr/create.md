---
description: Push the current branch and create a pull request
---

# PR Create - Fast & Smart

Create a pull request with intelligent description generation and quality checks. Follow the `git-workflow` skill for PR template conventions, and the `stacked-pr` skill when the branch is part of a stack.

## Phase 1: Detect Context First

Stack membership changes what "the diff" even means, so resolve it **before** computing diffs. Run these in parallel:

1. `git status` - Working tree state
2. `git branch --show-current` - Current branch name
3. `gh stack view --json 2>/dev/null; echo "stack_exit=$?"` - Stack state and exit code

### Branch on the exit code

Only exit code **2** means "not in a stack". Anything else non-zero is a real error:

| `stack_exit` | Meaning                                | Action                                |
| ------------ | -------------------------------------- | ------------------------------------- |
| `0`          | Branch is in a stack                   | Stacked path (Phase 2b / 3b)          |
| `2`          | No local stack                         | Single-branch path (Phase 2a / 3a)    |
| `4`          | GitHub API failure                     | **Stop and report**                   |
| `6`          | Branch is in multiple stacks           | **Stop and ask the user which stack** |
| `9`          | Stacked PRs not enabled for this repo  | **Stop and tell the user**            |
| other        | See the `git-workflow` exit code table | **Stop and report**                   |

**Never fall through a non-2 error into the single-branch path.** Doing so creates a PR based on `main` when it should have been based on its stack parent, which silently breaks the stack.

If `gh stack` is not installed, **stop** and tell the user to run `gh extension install github/gh-stack`. Do not silently continue on the single-branch path: without the extension you cannot tell whether this branch belongs to a stack, and guessing wrong opens a PR against the wrong base. Continue only if the user confirms the work is unstacked.

## Phase 2a: Gather Context (Single Branch)

Determine the base branch rather than assuming `main`:

```bash
BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
git log "$BASE..HEAD" --oneline
git diff "$BASE...HEAD" --stat
git diff "$BASE...HEAD" --name-only
gh pr list --head "$(git branch --show-current)" --json number,title,state
```

## Phase 2b: Gather Context (Stack)

`gh stack view --json` returns:

```jsonc
{
  "trunk": "main",
  "currentBranch": "stack/789-api",
  "branches": [
    // ordered bottom to top
    {
      "name": "stack/789-schema",
      "head": "abc123", // this branch's HEAD sha
      "base": "def456", // ⚠ a SHA, not a branch name
      "isCurrent": false,
      "isMerged": false,
      "isQueued": false,
      "needsRebase": false,
      "pr": { "number": 101, "url": "...", "state": "OPEN" },
    },
  ],
}
```

**`base` is a commit SHA, not a branch ref** — it records the parent's HEAD at the last sync/rebase, so it goes stale. Derive each layer's parent branch **by position** instead, skipping merged and queued ancestors (this mirrors the extension's own `ActiveBaseBranch` logic):

> Walk backwards from the branch's index. The first entry that is neither `isMerged` nor `isQueued` is the parent. If there is none, the parent is `trunk`.

Then diff each layer against that parent, which is what its PR actually shows:

```bash
git diff "$parent...$branch" --stat
git log "$parent..$branch" --oneline
```

Do not diff against `trunk` for every layer — that includes the lower layers' commits and produces a description for the wrong scope.

The stack JSON has no `baseRefName`/`headRefName`. If you need a merged or queued layer's real refs, ask the PR directly:

```bash
gh pr view "$pr" --json baseRefName,headRefName
```

Flag these before submitting:

- Any branch with `needsRebase: true` -> the stack is stale. Run `gh stack rebase` and `gh stack push` first.
- Any branch with `isMerged` or `isQueued` -> do not rewrite or resubmit that layer.

**Quick validation** (do not block unless critical):

- BLOCK if on `main`/`master` or on the stack's `trunk`
- WARN if a PR already exists - it will be updated rather than created
- WARN if the change contains two or more independently reviewable units with a dependency order (e.g. migration -> logic -> API -> UI) and suggest splitting it into a stack. Size alone is a weak signal; a 900-line change with one concern is still one PR, and splitting it produces artificial layers.
- WARN if the working tree is not clean

## Phase 3: Generate Descriptions

### Auto-detect PR type and scope

- **Files changed**: Count by category (lib/, test/, config/, migrations/, etc.)
- **PR type**: Infer from commits and files (feature/bug/refactor/chore)
- **Issue number**: Extract from branch name or commit messages (e.g., `#123`)

Refer to the `git-workflow` skill for the PR template and coordination-need auto-detection.

**Title**: Use the first commit message if there is only 1 commit. Otherwise synthesize from the changes (capitalized, concise, 50 chars max).

**For a stack**, generate one description per layer from that layer's own diff, following the `stacked-pr` skill: `Part of #<issue> (stack N/M)`, the `Fixes #<issue>` keyword on the **top** PR only (a closing keyword on the bottom PR closes the issue as soon as that layer merges), and a note on what each layer defers upward.

## Phase 4a: Create PR (Single Branch)

```bash
git push -u origin HEAD
gh pr create --fill
gh pr edit <number> --title "Title" --body "$(cat <<'EOF'
[Generated description using PR template]
EOF
)" --add-label "label1,label2"
```

If the PR already exists, skip `gh pr create` and go straight to `gh pr edit`.

## Phase 4b: Create PRs (Stack)

Submitting touches **every** PR in the stack, so show the user the stack and confirm first:

```bash
gh stack view --short
```

Use `--short`, never bare `gh stack view` — the bare form is the interactive view and will stall a non-interactive session.

`gh stack submit` has no per-PR body flag (its only flags are `--auto`, `--open`, `--remote`), so descriptions are written afterwards with `gh pr edit`. Submit as drafts first, fill in the bodies, then mark ready:

```bash
gh stack submit --auto                        # 1. create/update every PR as a draft
gh pr edit "$pr" --body-file "$body_file"     # 2. per PR, bottom to top
gh pr ready "$pr"                             # 3. or: gh stack submit --auto --open
```

Use `--body-file` rather than `--body` for multi-line descriptions; it avoids shell quoting problems with backticks and `$` in the body.

`--open` flips **every** PR in the stack to ready, including ones that were already drafts on purpose. Confirm with the user before using it on a stack that already has PRs, or use `gh pr ready` per PR instead.

Get the PR numbers from the `branches[].pr.number` fields in the Phase 2b JSON.

**Never run `gh stack merge`, `gh stack modify`, or `gh stack unstack` from this command.**

## Phase 5: Post-Creation

1. **Display PR URL(s)** prominently - for a stack, list them bottom to top with stack position
2. **Suggest next steps**:
   - "Run `/pr:feedback <number>` to review comments once reviewers have looked at it"
   - If CI is running: "Monitor CI status with `gh pr checks <number>`"
   - If screenshots needed: "Don't forget to add screenshots!"
   - For a stack: "Land it with `gh stack merge` once approved - `gh pr merge` won't work on stacked PRs"

## Labels

**IMPORTANT**: Only suggest labels that exist in the repository (verify with `gh label list`). Invalid labels will cause failures.

## Speed Optimizations

- Use a single Bash tool message with multiple commands for parallel execution
- Don't wait for `mix precommit` - assume it was run (per CLAUDE.md guidelines)
- Don't read every file - use git operations only
- Generate "good enough" descriptions quickly - user can edit if needed
- Auto-apply confident labels, skip if uncertain

## Edge Cases

- **No commits**: Error immediately - "No commits to create PR from"
- **Already on remote**: `gh pr edit` and `gh stack submit --auto` both handle updates
- **Draft PR**: If >5 commits or >300 lines, ask "Create as draft?"
- **Failed submit**: Report the error. Do not fall back to `gh pr create` on a stacked branch - that creates a PR with the wrong base and breaks the stack.
- **Stack needs rebase**: If any branch has `needsRebase: true`, rebase and push before submitting
- **Stack diverged**: If `gh stack submit` or `gh stack sync` reports divergence, stop and hand it to the user (see the `stacked-pr` skill). Note that sync exits successfully even when it aborts on divergence, so read the output rather than trusting `$?`.

---

**Philosophy**: Be fast and smart. Generate 90% accurate descriptions in seconds rather than 100% perfect descriptions in minutes.
