---
name: code-review
description: >-
  Use when reviewing code changes as a senior staff engineer - whether from a
  pull request, uncommitted local changes, or staged changes before committing.
  Covers parallel agent review, issue verification, and prioritized output.
  Triggered by /pr:review, /code:review, or any request to review code for
  correctness, idioms, tests, and documentation quality.
---

# Senior Staff Engineer Code Review

Review code changes thoroughly, focusing on real issues that affect code quality. Not nitpicks.

## Review Areas

Spawn **4 parallel agents** (single message, multiple Agent tool calls). Pass each agent the diff and the list of changed files so they can read the full source for context.

### Agent 1: Correctness & Logic

- **Bugs and typos**: Off-by-one errors, nil/empty handling, wrong variable names, misspellings in user-facing strings
- **Logic errors**: Does the code do what it claims? Are conditionals correct? Are edge cases handled?
- **Data integrity**: Are database operations correct? Proper use of transactions, preloads, constraints?

### Agent 2: Elixir Idioms & Patterns

- **Elixir conventions**: Proper use of `with`, pattern matching, pipe operator, guard clauses
- **OTP patterns**: Correct use of GenServer, Task, Supervisor, Registry where applicable
- **Phoenix patterns**: LiveView best practices, proper use of streams, assigns, events
- **Anti-patterns**: Nested `case`/`if` that should be `with`, imperative loops vs `Enum`/`Stream`, unnecessary `Enum.into`

### Agent 3: Tests & Quality

- **Test coverage**: Are the important paths tested? Are edge cases covered?
- **Test quality**: Do tests verify behavior or just exercise code? Are assertions meaningful?
- **Redundant tests**: Are there duplicate or near-duplicate tests that add maintenance burden without coverage value?
- **Missing tests**: What critical scenarios are untested?

### Agent 4: Specs, Docs & Comments

- **Typespecs**: Are `@spec` annotations present for public functions? Are they accurate?
- **Documentation**: Do public functions have `@doc`? Are docs clear and helpful?
- **Comments**: Are there comments where logic is non-obvious? Are there stale or misleading comments?
- **Module docs**: Does the module have a `@moduledoc` explaining its purpose?

Each agent must return findings with:

- **File and line number** (e.g., `lib/foundation/core/projects.ex:142`)
- **What's wrong** (specific description)
- **Why it matters** (impact on correctness, maintainability, or readability)
- **Suggested fix** (if not obvious)

## Filter

Collect all findings. Discard anything purely cosmetic or nitpicky.

**DO NOT report:**

- Variable renaming suggestions
- Minor formatting preferences already handled by `mix format`
- Adding docs/specs to private functions
- Stylistic preferences with no functional impact
- Things that work correctly but could be written "differently"

**DO report:**

- Bugs, logic errors, data integrity issues
- Missing error handling that could cause crashes
- Incorrect or misleading docs/specs
- Significant test gaps for critical paths
- Misuse of Elixir/Phoenix patterns that could cause real problems (memory leaks, race conditions, N+1 queries)

## Verify

For each remaining finding, spawn a **background verification agent** (general-purpose type) to confirm the issue is real. Launch all in parallel (single message, multiple tool calls). Each agent should:

1. Read the relevant source file(s) for full context
2. If the `codex-discussion` skill is available, use it to discuss whether the issue is valid. If not available, the agent should verify independently by reading surrounding code, searching documentation, and reasoning about the issue
3. Use Tidewave MCP tools if available and helpful (e.g., to check runtime behavior, evaluate expressions)
4. Return a verdict: **confirmed**, **likely**, or **false positive**

Drop any findings marked as **false positive**.

## Output

Present verified findings as a numbered list, sorted and grouped by priority:

### Critical (Must Fix)

Bugs, data integrity issues, security problems, crashes

### Important (Should Fix)

Logic errors, significant test gaps, incorrect specs/docs, pattern misuse with real consequences

### Suggestion (Consider Fixing)

Minor improvements that would meaningfully improve code quality

Format each finding as:

```
N. **[File:line]** - Brief title
   Description of the issue and why it matters.
   **Fix:** Suggested resolution.
```

End with a brief overall assessment of the code quality.
