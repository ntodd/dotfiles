---
description: Push the current branch and create a pull request
---

# PR Create - Fast & Smart

Create a pull request with intelligent description generation and quality checks. Follow the `git-workflow` skill for Graphite CLI usage and PR template conventions.

## Phase 1: Fast Pre-flight Checks (Parallel)

Run these checks IN PARALLEL (single message, multiple Bash tool calls):

1. `git status` - Check working tree state and branch
2. `git log main..HEAD --oneline` - Get commits for this PR
3. `git diff main...HEAD --stat` - Get file change statistics
4. `git diff main...HEAD --name-only` - Get list of changed files
5. `git branch --show-current` - Get current branch name
6. `gt log short` - Check Graphite stack state

After getting the branch name, check if PR already exists: 7. `gh pr list --head <branch-name> --json number,title,state` - Check for existing PR

**Quick validation** (do not block unless critical):

- BLOCK if on `main` or `master` branch
- WARN if PR already exists - `gt submit` will update it
- WARN if >500 lines changed (suggest splitting PR)
- WARN if working tree is not clean (uncommitted changes)

### Detect Stack Context

Examine the `gt log short` output and current branch name to determine if this is a stacked PR:

- **Is a stack** if: branch starts with `stack/`, OR `gt log short` shows multiple branches between HEAD and main
- **Not a stack** if: single branch between HEAD and main with no `stack/` prefix

If a stack is detected, **stop and tell the user**:

> "This branch is part of a Graphite stack. For stacked PRs, use `gt submit --stack --no-edit` to submit the entire stack at once. See the `stacked-pr` skill for the full workflow including PR descriptions, merge order, and collaboration."

Then stop. Do not continue with the standard PR creation flow for stacked branches.

## Phase 2: Smart PR Description Generation

### Auto-detect PR type and scope

- **Files changed**: Count by category (lib/, test/, config/, migrations/, etc.)
- **PR type**: Infer from commits and files (feature/bug/refactor/chore)
- **Issue number**: Extract from branch name or commit messages (e.g., `#123`)

### Generate description following `.github/pull_request_template.md`

Refer to the `git-workflow` skill for the full PR template format and auto-detection rules for coordination needs.

**Title**: Use first commit message if only 1 commit. Otherwise synthesize from changes (capitalize, concise, 50 chars max).

## Phase 3: Create PR with Graphite

1. **Submit using gt**:

   ```bash
   gt submit --no-edit
   ```

2. **Update PR metadata with gh**:
   ```bash
   gh pr edit <number> --title "Title" --body "$(cat <<'EOF'
   [Generated description using PR template]
   EOF
   )" --add-label "label1,label2"
   ```

**IMPORTANT**: Only suggest labels that exist in the repository (verify with `gh label list`). Invalid labels will cause failures.

Only use `gh pr create` if the user explicitly asks for it. If `gt submit` fails, report the error rather than silently falling back.

## Phase 4: Post-Creation

After PR created successfully:

1. **Display PR URL** prominently
2. **Suggest next steps**:
   - "Run `/pr:feedback <number>` to review comments once reviewers have looked at it"
   - If CI is running: "Monitor CI status with `gh pr checks <number>`"
   - If screenshots needed: "Don't forget to add screenshots!"

## Speed Optimizations

- Use single Bash tool message with multiple commands for parallel execution
- Don't wait for `mix precommit` - assume it was run (per CLAUDE.md guidelines)
- Don't read every file - use git operations only
- Generate "good enough" descriptions quickly - user can edit if needed
- Auto-apply confident labels, skip if uncertain

## Edge Cases

- **No commits**: Error immediately - "No commits to create PR from"
- **Already on remote**: Just run `gt submit`, it handles updates
- **Draft PR**: If >5 commits or >300 lines, ask "Create as draft?"
- **Failed submit**: Report error, check if branch is tracked with `gt log short`

---

**Philosophy**: Be fast and smart. Generate 90% accurate descriptions in seconds rather than 100% perfect descriptions in minutes.
