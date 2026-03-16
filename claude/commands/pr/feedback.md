---
description: Classify and prioritize unresolved PR review comments
argument-hint: <pr-number>
---

# PR Review Feedback

Fetch unresolved review comments from PR #$ARGUMENTS (up to 100 threads, 50 comments per thread), classify them by priority, and create an actionable plan to address them.

## Phase 1: Fetch Unresolved Threads

Determine the repository owner and name, then query the GitHub GraphQL API for review threads on PR #$ARGUMENTS.

Run the following as a single bash command:

```bash
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner') && \
OWNER="${REPO%%/*}" && \
NAME="${REPO##*/}" && \
QUERY=$(cat <<'GRAPHQL'
query($owner: String!, $name: String!, $pr: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $pr) {
      title
      url
      state
      reviewThreads(first: 100) {
        nodes {
          isResolved
          isOutdated
          path
          line
          originalLine
          startLine
          comments(first: 50) {
            nodes {
              author { login }
              body
              createdAt
              url
            }
          }
        }
      }
    }
  }
}
GRAPHQL
) && \
gh api graphql \
  -F owner="$OWNER" \
  -F name="$NAME" \
  -F pr="$ARGUMENTS" \
  -f query="$QUERY" | jq '{
  pr: {
    title: .data.repository.pullRequest.title,
    url: .data.repository.pullRequest.url,
    state: .data.repository.pullRequest.state
  },
  threads: [
    .data.repository.pullRequest.reviewThreads.nodes[]
    | select(.isResolved == false)
    | {
        path: .path,
        line: (.line // .originalLine // .startLine),
        isOutdated: .isOutdated,
        comments: [
          .comments.nodes[]
          | {
              author: (.author.login // "ghost"),
              body: .body,
              createdAt: .createdAt,
              url: .url
            }
        ]
      }
  ]
}'
```

If the command fails or the PR is not found, report the error and stop.

If `threads` is empty, report: "No unresolved review threads on PR #$ARGUMENTS" and stop.

## Phase 2: Classify Each Thread

For each thread, look at the **first comment** (the thread opener) to determine the author and priority.

### Human Reviewers (any author that is NOT `coderabbitai`)

Human feedback is high-priority by default:

- **P0 (Blocking)**: Comment contains blocking language like "must", "blocking", "do not merge", "required", "critical"
- **P1 (Important)**: Default for all human comments
- **P2 (Suggestion)**: Comment contains suggestion language like "nit", "nitpick", "optional", "consider", "could", "minor", "style"

### CodeRabbit (`coderabbitai` author)

CodeRabbit comments have a structured first line: `_<emoji> <category>_ | _<color_emoji> <severity>_`

Parse the severity from the color emoji on the first line:

- `🔴` (Critical) = **P0**
- `🟠` (Major) = **P1**
- `🟡` (Minor) = **P2**
- `🔵` (Trivial) = **P3**

If the severity cannot be parsed, default to **P2**.

Also extract the `🤖 Prompt for AI Agents` section if present - it contains specific file paths, line numbers, and fix instructions inside a code block within a `<details>` tag. This is the most actionable part of CodeRabbit comments.

### Outdated Threads

If `isOutdated` is true, append "(outdated - code has changed)" to the summary. These threads may no longer apply but are still unresolved.

## Phase 3: Present the Plan

Output a structured, prioritized plan using this format:

### Header

```
## PR #<number>: <title>
State: <state> | Unresolved threads: <count>
```

### Human Reviewer Comments (listed first)

Group by author. Within each author group, sort by priority (P0 first).

For each thread (omit `:<line>` if line is null):

```
- **[P<n>]** `<path>:<line>` - <one-line summary of what the reviewer is asking for>
  [View comment](<url>)
```

### CodeRabbit Comments (listed second)

Sort by priority (P0 > P1 > P2 > P3).

For each thread (omit `:<line>` if line is null):

```
- **[P<n>]** `<path>:<line>` - <one-line summary>
  <AI Agent prompt instructions if available, otherwise brief description of the fix needed>
  [View comment](<url>)
```

### Suggested Order of Operations

After listing all threads, suggest an efficient order to address them:

1. P0 items first (blocking/critical)
2. P1 items grouped by file (reduce context switching)
3. P2/P3 items grouped by file
4. Note any outdated threads that should be verified before fixing

### Prompt

End with: "Would you like me to start addressing these? I'll work through them in the suggested order, starting with the highest priority items."
