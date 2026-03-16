---
description: Fetch a GitHub issue, plan implementation, and start working
argument-hint: <issue-number>
---

# Start Work on Issue

## Phase 1: Fetch and Understand the Issue

Run these in parallel:

```bash
gh issue view $ARGUMENTS --json title,body,labels,assignees,comments,state
```

```bash
gh api user -q '.login'
```

If the issue does not exist or is closed, report it and stop.

### Assess Readiness

Determine the issue type from its labels and body structure:

- **Bug**: Has "bug" label or "Describe the bug" / "To Reproduce" sections
- **Feature**: Has "feature" label or "Describe the solution" section
- **Task**: Has "task" label or "Describe the Task" section

Evaluate whether the issue has enough information to implement. Check:

- Is the desired outcome clear?
- For bugs: are reproduction steps provided?
- For features: is the scope defined?
- Are dependencies or external coordination needs described?

If the issue is underspecified, list what's missing and ask the user before proceeding.

## Phase 2: Plan the Implementation

Think carefully about the implementation approach. Consider:

1. Which files and contexts are affected
2. Whether this requires database changes (migrations)
3. Whether background jobs or external integrations are involved
4. Whether this is large enough to warrant stacked PRs

Consult `docs/documentation/` for any affected business contexts or integrations before proposing changes.

Present a concise implementation plan. If the scope is large, propose breaking it into phases and suggest using the `stacked-pr` skill.

Wait for user confirmation before proceeding.

## Phase 3: Set Up and Start

Once the plan is confirmed:

1. **Assign the issue** (if not already assigned):

   ```bash
   gh issue edit $ARGUMENTS --add-assignee "@me"
   ```

2. **Sync with main**:

   ```bash
   gt sync
   ```

3. **Create a branch** following the `git-workflow` skill conventions. Determine the branch type from the issue type:
   - Bug -> `bug/$ARGUMENTS-<description>`
   - Feature -> `feature/$ARGUMENTS-<description>`
   - Task -> `task/$ARGUMENTS-<description>`
   - Large feature needing stacked PRs -> `stack/$ARGUMENTS-<description>`

   ```bash
   gt create <branch-name> -m "<commit message>" -a
   ```

4. **Update the issue** with the implementation plan if significant new context was gathered during analysis:

   ```bash
   gh issue comment $ARGUMENTS --body "Implementation plan: ..."
   ```

Begin implementation following the confirmed plan.
