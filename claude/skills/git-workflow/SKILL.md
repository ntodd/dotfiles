---
name: git-workflow
description: >-
  This skill should be used when the user asks about "commit message format",
  "branch naming", "how to commit", "how to create a PR", "PR template",
  "gh stack", "stacked PRs", "git conventions", or needs guidance on commit
  conventions, branch naming, GitHub Stacked PRs (`gh stack`) basics, or PR
  creation workflow. Covers the project's standard Git and GitHub CLI practices
  for committing, branching, and pull request creation.
---

# Git Workflow Conventions

This project uses standard Git plus the GitHub CLI (`gh`), with GitHub's native
Stacked PRs (`gh stack`) for multi-layer work.

**`gh stack` only manages stacks.** It is not a general git wrapper, so it has no
opinion about ordinary single-branch work. Use plain `git` and `gh pr create` for
that, and do not initialize a stack for a single PR.

| Situation                 | Use                                     |
| ------------------------- | --------------------------------------- |
| One branch, one PR        | `git` + `gh pr create`                  |
| Two or more dependent PRs | `gh stack` (see the `stacked-pr` skill) |

## Setup

`gh stack` is an official GitHub CLI extension and is not bundled with `gh`:

```bash
# Install (one time, per machine)
gh extension install github/gh-stack

# Verify
gh stack --help

# Update later
gh extension upgrade gh-stack
```

Optional: `gh stack alias` installs a `gs` wrapper in `~/.local/bin` so `gs view`
works instead of `gh stack view`. Write `gh stack` in scripts and docs regardless,
since the alias is per-machine.

If `gh stack` reports it is available as an extension but not installed, install it
rather than falling back to manual base-branch juggling.

GitHub documents Stacked PRs as **in public preview and subject to change**. Check
`gh stack <cmd> --help` against the installed version before relying on a flag.

## Command Reference

| Operation                | Single branch                              | Inside a stack                                     |
| ------------------------ | ------------------------------------------ | -------------------------------------------------- |
| Create branch            | `git checkout -b <branch>`                 | `gh stack add <branch>`                            |
| Create branch + commit   | `git checkout -b <b>` + `git commit`       | `gh stack add -Am "msg" <branch>`                  |
| New commit               | `git commit -m "msg"`                      | `git commit -m "msg"` (+ restack if not on top)    |
| Amend                    | `git commit --amend`                       | `git commit --amend` + `gh stack rebase --upstack` |
| Push + create/update PR  | `git push -u origin HEAD` + `gh pr create` | `gh stack submit --auto`                           |
| Push only (no PR change) | `git push`                                 | `gh stack push`                                    |
| Sync with main           | `git fetch && git rebase origin/main`      | `gh stack sync`                                    |
| Inspect state            | `git log main..HEAD --oneline`             | `gh stack view --short`                            |
| Checkout a PR            | `gh pr checkout <pr>`                      | `gh stack checkout <pr-or-stack-number>`           |
| Merge                    | `gh pr merge`                              | `gh stack merge`                                   |

### When a restack is needed

Any change to a branch's tip leaves the branches above it pointing at the old
commit. What matters is **position in the stack**, not whether you amended:

| Change                             | Restack needed?                             |
| ---------------------------------- | ------------------------------------------- |
| New commit on the **top** branch   | No. Just `gh stack push`.                   |
| Amend on the **top** branch        | No descendants to restack. `gh stack push`. |
| New commit on a **non-top** branch | **Yes** — `gh stack rebase --upstack`       |
| Amend on a **non-top** branch      | **Yes** — `gh stack rebase --upstack`       |

There is no single command that commits and restacks. Do it in two steps:

```bash
git commit -m "msg"          # or: git commit --amend
gh stack rebase --upstack    # rebases the current branch and everything above it
gh stack push
```

`--upstack` covers the current branch **and all branches above it**. It fetches
remote state unless you also pass `--no-trunk`, which restacks locally only.
A rebase can conflict even after a trivial amend — resolve, `git add`, then
`gh stack rebase --continue`, or back out with `--abort`.

Never rewrite a layer whose PR is already merged or queued for merge.

**`gh pr merge` does not work on stacked PRs.** Use `gh stack merge`, which merges
every PR up to and including the chosen one atomically.

### Running `gh stack` non-interactively

`gh stack view`, `submit`, `modify`, and `merge` all default to interactive UIs
(`gh stack view --help` describes the bare form as the "default interactive
view"). Some detect a non-TTY and degrade gracefully, but do not rely on that.
As an agent or in a script, always pass the explicit flag:

- `gh stack view --short` or `--json` (bare `gh stack view` pages/renders interactively)
- `gh stack submit --auto` (auto-generated titles; creates PRs as **drafts** unless
  you also pass `--open`)
- `gh stack merge --yes` (add `--squash` / `--merge` / `--rebase` for the method)
- `gh stack modify` has no non-interactive form — hand it to the user

### Exit codes

`gh stack` distinguishes "no stack here" from real failures. Do **not** treat
every non-zero exit as "not in a stack":

| Code | Meaning                                                |
| ---- | ------------------------------------------------------ |
| 0    | Success                                                |
| 1    | Generic error                                          |
| 2    | Not in a stack / stack not found                       |
| 3    | Rebase conflict                                        |
| 4    | GitHub API failure                                     |
| 5    | Invalid arguments or flags                             |
| 6    | Disambiguation required (branch is in multiple stacks) |
| 7    | Rebase already in progress                             |
| 8    | Stack is locked by another process                     |
| 9    | Stacked PRs are not enabled for this repository        |
| 10   | Modify session interrupted, recovery required          |

This table drifts by version: the extension README at v0.1.0 documents only 0-8,
while GitHub's CLI reference documents 9 and 10. Do not hardcode the high end.
The durable rule is **0 = stacked, 2 = not stacked, anything else = stop**.

Detect stack context by branching on the code specifically:

```bash
gh stack view --short >/dev/null 2>&1
case $? in
  0) : ;;   # in a stack
  2) : ;;   # not in a stack — single-branch workflow
  *) : ;;   # a real error — report it and stop, do not assume single-branch
esac
```

Falling through case 4 (API failure) or 6 (ambiguous) into the single-branch path
is how you end up opening a PR against `main` that should have targeted its stack
parent.

`gh stack view` only knows about **local** tracking in `.git/gh-stack`. A stack
created remotely with `gh stack link` is intentionally not tracked locally, so
exit 2 means "no local stack", not "no stack on GitHub".

## Branch Naming

Use the format `[type]/[issue_number]-[branch_name]`:

- `type`: one of `task`, `feature`, `bug`, or `stack` (for a layer in a stack)
- `issue_number`: GitHub issue number (omit if unknown)
- `branch_name`: succinct description, e.g. `add-roles-to-users`

Examples:

- `feature/123-add-user-roles`
- `bug/456-fix-login-timeout`
- `task/update-dependencies`
- `stack/789-gantt-chart-backend` (one layer of a stack — see the `stacked-pr` skill)

Always branch from `main` unless context requires otherwise. If unclear, ask.

**Always pass an explicit branch name to `gh stack add`.** Without one, `gh stack add -Am
"msg"` auto-generates a date+slug name like `03-24-add_login`, which breaks this
convention:

```bash
gh stack add -Am "Add gantt chart backend" stack/789-gantt-chart-backend
```

## Commit Messages

Write commit messages in the imperative mood ("Fix bug" not "Fixed bug"). Follow this template:

```text
Capitalized, short (50 chars or less) summary

More detailed explanatory text, if necessary. Wrap it to about 72
characters or so. The blank line separating the summary from the body
is critical.

Write your commit message in the imperative: "Fix bug" and not
"Fixed bug" or "Fixes bug."

- Bullet points are okay, too
- Use a hyphen followed by a single space
- Use a hanging indent
```

### Summary Line Rules

- Capitalized, 50 characters or less
- Imperative mood, no trailing period
- Describes what the commit does, not what you did

### Body Guidelines

- Explain the "why", not the "what" (the diff shows what changed)
- Wrap at 72 characters
- Use bullet points for multiple related items

### Atomic Commits

Each commit should represent one logical change:

- A single bug fix
- A single feature addition
- A refactoring of one component
- A documentation update for one area

When a file contains both related and unrelated changes, use `git add -p <file>` to stage only the relevant hunks, then commit.

## Pull Request Creation

### Single branch

```bash
git push -u origin HEAD
gh pr create --fill --draft   # drop --draft when it's ready for review
```

### Stack

Pick exactly one:

```bash
gh stack submit --auto          # creates/updates every PR, links them as a Stack, as drafts
gh stack submit --auto --open   # same, but marks them ready for review
```

`--open` also flips existing draft PRs in the stack to ready, so confirm before
using it on a stack that already has PRs.

Either way, follow up by writing a real description per PR. `--fill` and `--auto`
produce placeholder text, so update each PR to match the project's PR template
(`.github/pull_request_template.md`) with `gh pr edit`.

**In a stack, put the closing keyword on the top PR**, not the bottom one, or the
issue closes as soon as the bottom layer merges. The template below assumes a
single PR:

```bash
gh pr edit <number> --title "Title" --body "$(cat <<'EOF'
Fixes #<issue> (only if related to an issue)

**What does this PR do?**
Describe what it changes and why.

**Screenshots**
If applicable, include screenshots. Otherwise: N/A

**Does this PR require any external coordination to deploy?**
Migrations, env vars, new dependencies, queue config, etc. Otherwise: No

**Additional context**
Breaking changes, affected integrations, key files modified.
EOF
)"
```

### Auto-detect coordination needs

When generating PR descriptions, check for:

- Migrations present -> "Yes - includes database migrations"
- `config/runtime.exs` or new env vars -> "Yes - requires environment variable changes"
- New dependencies in `mix.exs` -> "Yes - requires mix deps.get"
- New Oban queues -> "Yes - may require Oban queue configuration"

## CI Cost in Stacks

Branch protection, required checks, and CODEOWNERS are evaluated against the
**stack base** (usually `main`) for every PR in the stack, not against each PR's
immediate parent. Workflows configured to run on PRs targeting `main` therefore
run once per stack layer. Keep stacks reasonably small, and if CI cost becomes a
problem, gate jobs on `github.event.pull_request.stack.position` and
`.stack.size`.

## Pre-Commit Quality Check

Run `mix precommit` before committing to catch formatting, linting, and test issues early.
