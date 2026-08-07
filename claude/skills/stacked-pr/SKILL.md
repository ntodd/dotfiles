---
name: stacked-pr
description: >-
  This skill should be used when the user asks about "stacked PRs", "gh stack",
  "stack a PR", "split this into multiple PRs", "restack", "merge a stack",
  "rebase the stack", or when a change is large enough that it should ship as a
  chain of dependent pull requests. Covers GitHub's native Stacked PRs via the
  `gh stack` CLI extension: creating a stack, mid-stack edits, review feedback,
  syncing, and merging. For single-branch commit and PR conventions, use the
  `git-workflow` skill.
---

# Stacked PRs with `gh stack`

GitHub's native Stacked PRs break a large change into a chain of small,
individually reviewable PRs. Each PR targets the branch below it, so each diff
shows only that layer's changes.

```
stack/789-frontend  → PR #3 (base: stack/789-api)      ← top
stack/789-api       → PR #2 (base: stack/789-schema)
stack/789-schema    → PR #1 (base: main)               ← bottom
────────────────────
main (trunk)
```

`up` moves away from trunk, `down` moves toward it. Stack metadata lives in
`.git/gh-stack` and is not committed.

## When to Stack

Stack when the work has **two or more layers that can be reviewed independently
and merged in order**. Typical splits: schema/migration, then business logic,
then API, then UI.

Do **not** stack a single logical change. Use `git` + `gh pr create` for that
(see the `git-workflow` skill). Stacks cap at 100 PRs, but review quality drops
long before that; 3-5 layers is a good target.

## Setup

```bash
gh extension install github/gh-stack   # one time, per machine
gh stack --help                        # verify
gh extension upgrade gh-stack          # update later
```

GitHub documents Stacked PRs as **in public preview and subject to change**.
Availability and exact behavior vary by extension version and repository, so
verify against `gh stack <cmd> --help` on the installed version before relying on
a flag. Exit code 9 means the feature is not enabled for the repository.

## Agent Safety Rules

`gh stack view`, `submit`, `modify`, and `merge` default to interactive UIs
(`gh stack view --help` calls the bare form the "default interactive view").
Several of them detect a non-TTY and degrade, but do not rely on that — a
TTY-backed agent session will drop into the UI and stall. Always pass the
explicit flag:

| Command           | Non-interactive form                                         |
| ----------------- | ------------------------------------------------------------ |
| `gh stack view`   | `gh stack view --short` or `--json`                          |
| `gh stack submit` | `gh stack submit --auto` (add `--open` for ready-for-review) |
| `gh stack merge`  | `gh stack merge --yes` (+ `--squash`/`--merge`/`--rebase`)   |
| `gh stack modify` | No non-interactive form — hand this to the user              |

`gh stack sync` is safe non-interactively: a clean remote-ahead update is pulled
automatically, and a genuine divergence aborts without pushing anything. But it
exits **successfully** when it aborts, so check its output rather than `$?`.

**Never run `gh stack modify`, `unstack`, or `merge` without explicit user
confirmation.** `modify` restructures history, `unstack` dissolves the stack on
GitHub, and `merge` lands code.

## Detecting Stack Context

Branch on the **exact** exit code. Only code 2 means "not in a stack"; every other
non-zero code is a real failure and must not fall through to the single-branch path:

```bash
gh stack view --short >/dev/null 2>&1
case $? in
  0) STACKED=1 ;;                      # in a stack
  2) STACKED=0 ;;                      # no local stack — single-branch workflow
  *) echo "gh stack failed (exit $?)"; exit 1 ;;   # report and stop
esac
```

| Code | Meaning                                             | Agent action                                   |
| ---- | --------------------------------------------------- | ---------------------------------------------- |
| 0    | Success                                             | Stacked path                                   |
| 2    | Not in a stack / not found                          | Single-branch path                             |
| 1    | Generic error                                       | Stop, report                                   |
| 3    | Rebase conflict                                     | Stop, resolve first                            |
| 4    | GitHub API failure                                  | Stop, report (do **not** assume single-branch) |
| 5    | Invalid arguments or flags                          | Stop, fix the command                          |
| 6    | Disambiguation required (branch in multiple stacks) | Stop, ask the user which stack                 |
| 7    | Rebase already in progress                          | Stop, finish or abort it                       |
| 8    | Stack is locked by another process                  | Stop, retry later                              |
| 9    | Stacked PRs not enabled for this repo               | Stop, tell the user                            |
| 10   | Modify session interrupted                          | Stop, needs recovery                           |

Codes vary by version — v0.1.0's README documents 0-8, GitHub's CLI reference
adds 9 and 10. Don't hardcode the high end. The durable rule is **0 = stacked,
2 = not stacked, anything else = stop and report**.

Treating code 4, 6, or 9 as "single branch" is how an agent opens a PR against
`main` that should have targeted its stack parent.

Do not infer stack membership from the branch name. The `stack/` prefix is a
naming convention only. Note also that `gh stack view` reads **local** tracking in
`.git/gh-stack`, so a stack created remotely via `gh stack link` reports exit 2
even though a stack exists on GitHub.

## Creating a Stack

Branch names follow the `git-workflow` convention: `stack/[issue]-[layer]`.
Always pass an explicit branch name, otherwise `gh stack add -Am` invents a
date+slug name.

```bash
# 1. Start the stack with its bottom branch
gh stack init stack/789-schema

# 2. Work, then commit on the current branch
#    (`add -Am` commits in place when the branch has no commits yet)
gh stack add -Am "Add gantt chart schema" stack/789-schema

# 3. Each further layer: write code, then add + commit in one step
gh stack add -Am "Add gantt chart API" stack/789-api
gh stack add -Am "Add gantt chart UI" stack/789-frontend

# 4. Push everything and open the PRs
gh stack submit --auto
```

To stack on a non-default trunk (release branch, long-lived feature branch):

```bash
gh stack init --base release stack/789-schema
```

To adopt branches that already exist:

```bash
gh stack init stack/789-schema stack/789-api stack/789-frontend
```

To stack PRs that are already open (no local tracking required — useful when the
branches were made by another tool):

```bash
gh stack link 101 102 103          # bottom to top, by PR number
gh stack link feat-a feat-b        # or by branch name
```

## PR Descriptions

`--auto` generates placeholder titles, so write real descriptions afterwards.
Each PR gets its own, following `.github/pull_request_template.md`:

```bash
gh pr edit <number> --title "Add gantt chart schema" --body "$(cat <<'EOF'
Part of #789 (stack 1/3 — `Fixes #789` goes on the top PR, not this one)

**What does this PR do?**
Adds the `gantt_tasks` table and schema module. No behavior change yet — the
API layer lands in the next PR in this stack.

**Screenshots**
N/A

**Does this PR require any external coordination to deploy?**
Yes - includes database migrations

**Additional context**
Reviewable on its own; the migration is additive and safe to deploy ahead of
the rest of the stack.
EOF
)"
```

Description conventions for stacks:

- Reference the issue once per PR, with the layer position: `Part of #789 (stack 1/3)`
- Put the closing keyword (`Fixes #789`) on the **top** PR, the one that completes
  the work. Putting it on the bottom PR closes the issue as soon as that layer
  merges, while the rest of the stack is still open. If no single layer completes
  the issue, omit the keyword entirely and close the issue by hand after the stack lands.
- Say what the layer does **and** what it deliberately defers to the layer above
- Note whether the layer is independently deployable (migrations usually are, UI usually is not)

Run descriptions through the `humanizer` skill before posting.

## Mid-Stack Changes

When you're on a higher layer and need a change that belongs lower, go make it
where it belongs rather than patching around it:

```bash
gh stack down                      # or: gh stack checkout stack/789-schema
git add lib/foundation/gantt.ex
git commit -m "Add duration field to gantt task"
gh stack rebase --upstack          # rebases this branch and every layer above it
gh stack push                      # force-with-lease pushes the rebased branches
gh stack top                       # back to where you were
```

This applies to **any** commit on a non-top branch, not just amends. A plain new
commit moves the branch tip, so the layers above are stale until you restack.
Only the top branch can skip the rebase.

`--upstack` fetches remote state; add `--no-trunk` to restack locally without
touching trunk. Never rewrite a layer whose PR is already merged or queued.

`gh stack push` is force-with-lease and **not atomic** — if one branch's lease
check fails, the others may still update. Re-run it and confirm every branch
landed rather than assuming a single success means the whole stack pushed.

Navigation: `gh stack up [n]`, `down [n]`, `top`, `bottom`, `trunk`, `switch`.

## Review Feedback

```bash
gh stack checkout stack/789-schema   # go to the branch the comment is on
# ... make the fixes, commit ...
gh stack rebase                      # cascade through the whole stack
gh stack push
```

Address feedback on the branch the comment targets, not on the top of the stack.
A fix committed to the wrong layer shows up in the wrong PR's diff and makes the
lower PR look unchanged.

If a rebase conflicts, `gh stack rebase` pauses and prints the conflicted files.
Resolve, `git add`, then `gh stack rebase --continue`. To back out entirely,
`gh stack rebase --abort` restores every branch to its pre-rebase state.
`git rerere` is enabled by `gh stack init`, so repeat conflicts resolve themselves.

## Syncing

Run after anything merges upstream or after a teammate touches the stack:

```bash
gh stack sync            # fetch, reconcile, fast-forward trunk, rebase, push, sync PR state
gh stack sync --prune    # also delete local branches for merged PRs, no prompt
```

If sync reports the local and remote stacks have **diverged**, stop and hand it
to the user. The choices (adopt remote, delete the stack on GitHub, cancel) all
have consequences that need a human decision.

Do not judge sync by its exit status alone. In a non-interactive terminal a
divergence **aborts while still exiting successfully**, having pushed nothing and
updated no PRs. Read the output, not just `$?`.

## Merging

`gh pr merge` does not work on stacked PRs. Use `gh stack merge`, which merges
every PR from the bottom up to and including the one you choose, atomically — if
any PR can't merge, none do.

```bash
gh stack merge                       # interactive picker (user-driven)
gh stack merge --yes --squash        # whole current stack, no prompts
gh stack merge 42                    # everything up to and including stack-or-PR 42
```

**A bare number is resolved as a stack number first, then as a PR number.** The
same is true for `gh stack checkout`. If a stack and a PR share a number, you will
get the stack. Pass an unambiguous reference when it matters.

Merge order is always bottom-to-top: everything below your selection is included.
A layer only becomes mergeable once the layers beneath it have merged.
If the base branch uses a merge queue, the stack is added to the queue instead,
the queue picks the merge method (any `--squash`/`--merge`/`--rebase` is ignored
with a warning), and PRs may land in separate groups.

Bypassing merge requirements is not supported for stack merges.

After merging, run `gh stack sync --prune`.

## Collaboration

Pick up someone else's stack:

```bash
gh stack checkout            # interactive picker of all local + remote stacks
gh stack checkout 7          # by stack number
gh stack checkout 42         # by PR number
gh stack checkout https://github.com/owner/repo/pull/42
```

This fetches the branches and sets up local tracking. When someone adds PRs to
the stack on GitHub, `gh stack sync` appends them to your local stack
automatically.

## CI and Branch Protection

Every PR in a stack is evaluated as if it targets the **stack base** (usually
`main`), not its immediate parent. So required reviews, required status checks,
CODEOWNERS, and code scanning all run against `main` for every layer — meaning a
5-layer stack runs your full PR workflow 5 times.

If that gets expensive, gate jobs on stack metadata:

```yaml
- name: Run only on the top PR
  if: >-
    github.event.pull_request.stack != null &&
    github.event.pull_request.stack.position == github.event.pull_request.stack.size
  run: mix test
```

The `stack != null` guard is required. Without it the condition is false for every
standalone PR in the repo, silently skipping the job on unstacked work.

Available fields: `stack.number`, `stack.size`, `stack.position` (1 = bottom),
`stack.base.ref`, `stack.base.sha`. The object is absent on `pull_request.opened`
(the PR joins the stack after creation); listen for the `stacked` action instead.

## Restructuring

`gh stack modify` opens a TUI to drop, fold, insert, rename, and reorder
branches, applying everything on save. It requires a clean working tree, no
in-progress rebase, no queued PRs, and linear history. Run `gh stack submit`
afterwards to push the new structure.

This is interactive-only — hand it to the user rather than attempting it as an
agent. The scriptable alternative is to tear down and rebuild:

```bash
gh stack unstack                     # dissolve the stack (PRs and branches survive)
git branch -m old-name new-name      # make structural changes
gh stack init stack/789-schema stack/789-api stack/789-frontend
gh stack submit --auto
```

Note that merged and queued PRs cannot be unstacked; a stack containing them
persists.

## Limitations

- Cross-fork stacks are not supported; all branches must be in the same repository
- Maximum 100 PRs per stack
- `gh pr merge` and merge-requirement bypass do not work on stacked PRs
- `gh stack modify` has no non-interactive mode
- **Stack branches must stay linear.** Never merge into a stack branch — always
  rebase. A merge commit breaks `gh stack modify` (which requires linear history)
  and confuses the cascading rebase.
- `gh stack push` is force-with-lease and non-atomic; verify every branch landed
- `gh stack view` sees only local tracking, so it cannot detect a stack created
  remotely with `gh stack link`
