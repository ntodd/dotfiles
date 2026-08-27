---
description: Define test helpers at module level; `describe` does not scope `defp`.
globs: ["test/**/*.exs", "*_test.exs"]
condition: '(?m)^(?: {4}|\t{2})defp?\s+[a-z_]\w*'
scope:
  [
    tool:edit(test/**/*.exs),
    tool:write(test/**/*.exs),
    tool:edit(*_test.exs),
    tool:write(*_test.exs),
  ]
---

`describe/2` groups tests; it does not create a scope. A `defp` written inside a describe block compiles at module level and is callable from every other describe, so the placement only misleads the reader about visibility — and a same-named helper in another block becomes a conflicting clause of the same function.

Define helpers once at module level. For per-group setup, use a named `setup` function registered on the describe rather than a helper pretending to be scoped.

Functions inside a nested support `defmodule` within the test file belong to that inner module and are fine; this rule targets bare `def`/`defp` inside `describe` blocks.
