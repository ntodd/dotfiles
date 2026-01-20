---
name: github-pr-review
description: Create and manage GitHub PR reviews with inline comments. Use when reviewing pull requests, adding review comments to specific lines, or submitting reviews.
argument-hint: [pr-number]
allowed-tools: Bash, Read, Grep, Glob
---

# PR Review Skill

Review pull requests by adding inline comments to specific lines of code and submitting reviews.

## Quick Reference

```bash
# Get PR info
gh pr view $ARGUMENTS

# Get list of changed files
gh pr diff $ARGUMENTS --name-only

# Get full diff
gh pr diff $ARGUMENTS

# Get diff for specific file (use grep)
gh pr diff $ARGUMENTS | grep -A 50 "diff --git a/path/to/file.ex"
```

## GitHub PR Review API

### Key Concepts

1. **Reviews vs Comments**: A review is a container that can hold multiple inline comments plus an overall verdict (APPROVE, REQUEST_CHANGES, COMMENT)
2. **One Pending Review Per User**: You can only have ONE pending review at a time per PR. Creating a new review while one is pending will fail.
3. **Line Numbers**: Comments must be on lines that appear in the diff. You cannot comment on unchanged lines outside diff hunks.

### Check for Pending Reviews

Before creating a review, check if one exists:

```bash
gh api repos/{owner}/{repo}/pulls/{pr}/reviews \
  --jq '.[] | select(.state == "PENDING") | {id, state, user: .user.login}'
```

### Delete a Pending Review

If you need to start fresh:

```bash
gh api repos/{owner}/{repo}/pulls/{pr}/reviews/{review_id} -X DELETE
```

### Create a Review with Inline Comments

Use JSON input via heredoc for complex payloads:

```bash
COMMIT_SHA=$(git rev-parse HEAD) && cat <<EOF | gh api repos/{owner}/{repo}/pulls/{pr}/reviews --input -
{
  "commit_id": "$COMMIT_SHA",
  "event": "COMMENT",
  "comments": [
    {
      "path": "lib/example/file.ex",
      "line": 42,
      "body": "Your comment here. Use \\n for newlines and \\` for backticks."
    }
  ]
}
EOF
```

**Event types:**

- `COMMENT` - Submit as a comment without approval/rejection
- `APPROVE` - Approve the PR
- `REQUEST_CHANGES` - Request changes (blocks merge in protected branches)
- `PENDING` - Save as draft (don't submit yet)

### Add Multiple Comments in One Review

```bash
COMMIT_SHA=$(git rev-parse HEAD) && cat <<EOF | gh api repos/{owner}/{repo}/pulls/{pr}/reviews --input -
{
  "commit_id": "$COMMIT_SHA",
  "event": "COMMENT",
  "comments": [
    {
      "path": "lib/file1.ex",
      "line": 10,
      "body": "First comment"
    },
    {
      "path": "lib/file2.ex",
      "line": 25,
      "body": "Second comment"
    }
  ]
}
EOF
```

### Submit a Review with Summary (No Inline Comments)

```bash
gh pr review $ARGUMENTS --request-changes --body "Summary of changes needed..."
gh pr review $ARGUMENTS --approve --body "LGTM!"
gh pr review $ARGUMENTS --comment --body "Some observations..."
```

## Common Errors and Solutions

### "User can only have one pending review per pull request"

**Cause**: You have an existing pending (draft) review.
**Solution**: Delete the pending review first, or submit it.

```bash
# Find pending review
gh api repos/{owner}/{repo}/pulls/{pr}/reviews \
  --jq '.[] | select(.state == "PENDING")'

# Delete it
gh api repos/{owner}/{repo}/pulls/{pr}/reviews/{id} -X DELETE
```

### "Line could not be resolved"

**Cause**: The line number isn't in the diff (unchanged code outside diff context).
**Solution**: Only comment on lines that appear in `gh pr diff` output. Find a nearby changed line.

### "Unprocessable Entity - Variable $commitOID invalid"

**Cause**: Short commit SHA or invalid commit.
**Solution**: Use full SHA from `git rev-parse HEAD`.

### JSON Escaping Issues

When using heredocs with JSON:

- Use `<<EOF` (not `<<'EOF'`) if you need variable substitution like `$COMMIT_SHA`
- Escape backticks as `\`` in the body
- Escape newlines as `\n`

## Workflow

1. **Initialize** with a user request to add PR review comments to PR after doing a review (this process is out of scope for this skill,
   assume it has already been done and issues have been identified).

2. **Get PR context**

   ```bash
   gh pr view $ARGUMENTS
   gh pr diff $ARGUMENTS --name-only
   ```

3. **Check for pending reviews** and delete if needed (be sure to ask, DON'T lose user data without approval)

4. **Add inline comments** using the reviews API with JSON input

5. **Ask the user** if they want to submit the review or keep working.

6. **Submit the review**, if requested, with `--request-changes`

## Example: Full Review Flow

```bash
# 1. Check PR
gh pr view 174
gh pr diff 174 --name-only

# 2. Check for pending reviews
gh api repos/owner/repo/pulls/174/reviews \
  --jq '.[] | select(.state == "PENDING") | {id}'

# 3. Add comments (creates and submits review)
COMMIT_SHA=$(git rev-parse HEAD) && cat <<EOF | gh api repos/owner/repo/pulls/174/reviews --input -
{
  "commit_id": "$COMMIT_SHA",
  "event": "COMMENT",
  "comments": [
    {
      "path": "lib/app/user.ex",
      "line": 15,
      "body": "Consider adding validation here."
    }
  ]
}
EOF

# 4. Submit final review with summary
gh pr review 174 --request-changes --body "See inline comments for details."
```
