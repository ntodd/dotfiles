---
description: Run ExUnit case modules asynchronously when isolated; keep synchronous tests only for real shared state.
globs: ["test/**/*.exs", "*_test.exs"]
condition: '(?m)^\s*use\s+[A-Z][A-Za-z0-9_.]*Case\b(?![^\n]*\basync:\s*true\b)[^\n]*$'
scope: [tool:edit(test/**/*.exs), tool:write(test/**/*.exs), tool:edit(*_test.exs), tool:write(*_test.exs)]
---

Prefer `async: true` for test modules that do not mutate process-global state. Tests within one module remain sequential; the option allows independent modules to run concurrently.

Use `async: false` only when the module changes application environment, process-wide configuration, current working directory, shared filesystem locations, global mocks, or another resource that cannot be isolated. Consider an ExUnit `:group` when modules may run asynchronously with the suite but must serialize against others using the same named resource.

Database tests may be asynchronous only when the adapter and SQL Sandbox ownership support it. Make the reason for a synchronous case explicit rather than omitting `async` by habit.
