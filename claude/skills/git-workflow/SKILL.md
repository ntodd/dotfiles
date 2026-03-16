---
name: git-workflow
description: >-
  This skill should be used when the user asks about "commit message format",
  "branch naming", "how to commit", "how to create a PR", "PR template",
  "gt modify", "gt submit", "use Graphite", "git conventions", or needs
  guidance on commit conventions, branch naming, Graphite CLI basics, or
  PR creation workflow. Covers the project's standard Git and Graphite CLI
  practices for committing, branching, and pull request creation.
---

# Git Workflow Conventions

This project uses Graphite CLI (`gt`) alongside standard Git. Both `git commit` and `gt modify` work for committing — the key difference is that `gt modify` automatically restacks descendant branches, which only matters when working in the middle of a stack.

## Graphite CLI Basics

| Operation               | Preferred                                           | Alternative                        |
| ----------------------- | --------------------------------------------------- | ---------------------------------- |
| Create branch + commit  | `gt create <branch> -m "msg" -a`                    | `git checkout -b` + `git commit`   |
| New commit              | `git commit -m "msg"` or `gt modify -c -m "msg" -a` | Both work identically              |
| Amend (stacked branch)  | `gt modify -m "msg" -a`                             | Restacks descendants automatically |
| Amend (non-stacked)     | `git commit --amend` or `gt modify -m "msg" -a`     | Both work identically              |
| Push + create/update PR | `gt submit --no-edit`                               | `git push` + `gh pr create`        |
| Sync with main          | `gt sync`                                           | `git fetch` + `git rebase`         |
| Checkout PR             | `gt get <pr-number>`                                | `gh pr checkout`                   |

**When `gt modify` matters**: Only when amending a commit in the middle of a stack — it automatically rebases descendant branches. For new commits on any branch, `git commit` is fine.

**When `gt submit` matters**: Always use `gt submit` (not `git push`) to push and create/update PRs. This ensures Graphite tracks PR relationships correctly.

## Branch Naming

Use the format `[type]/[issue_number]-[branch_name]`:

- `type`: one of `task`, `feature`, `bug`, or `stack` (for stacked PRs)
- `issue_number`: GitHub issue number (omit if unknown)
- `branch_name`: succinct description, e.g. `add-roles-to-users`

Examples:

- `feature/123-add-user-roles`
- `bug/456-fix-login-timeout`
- `task/update-dependencies`
- `stack/789-gantt-chart-backend` (for stacked PRs — see the `stacked-pr` skill)

Always branch from `main` unless context requires otherwise. If unclear, ask.

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

Always use `gt submit` to push and create/update PRs:

```bash
# Push and create/update PR
gt submit --no-edit

# Create as draft
gt submit --no-edit --draft
```

After creating a PR, update the description to follow the project's PR template (`.github/pull_request_template.md`) using `gh pr edit`:

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

## Pre-Commit Quality Check

Run `mix precommit` before committing to catch formatting, linting, and test issues early.
