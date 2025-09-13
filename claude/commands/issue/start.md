Take a look at issue #$ARGUMENTS on GitHub using the `gh` CLI. If the issue title, description, and comments do not
include enough information to understand and implement the fix, ask questions. Think hard about the implementation plan.

Once a plan has been developed that we need to start implementing, make sure to do the following:

1. Work on a new branch. Branch from main if possible. If not, ask what to do.
2. Follow branch naming guidelines
3. If new information is collected that is not captured in the issue, you may update the issue so that we have this
   information in the event our update is interrupted or we need to start again.

# Branch naming

- When creating branches, prefer the format `[type]/[issue_number]-[branch_name]` where:
  - `type` can be one of `task`, `feature`, or `bug`
  - `issue_number` is the GitHub issue number (if unknown, do not include in the branch name)
  - `branch_name` appropriate and succinct description of what the branch is for, e.g. `add-roles-to-users`
- If you know the GitHub user (perhaps through gh cli), you can add the user to the string like
  `[type]/[github_user]/[issue_number]-[branch_name]` (only do this if you for sure know the current github user name)
