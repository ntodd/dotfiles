---
description: Start test processes with `start_supervised!/1` so ExUnit guarantees cleanup between tests.
globs: ["test/**/*.exs", "*_test.exs"]
condition: '(?::[a-z_]\w*|\b[A-Z][A-Za-z0-9_.]*)\.start_link\s*\(|\bstart_supervised\s*\('
scope: [tool:edit(test/**/*.exs), tool:write(test/**/*.exs), tool:edit(*_test.exs), tool:write(*_test.exs)]
---

Use `start_supervised!/1` when a test needs to start a process. ExUnit will link it to the test supervisor and guarantee cleanup:

```elixir
pid = start_supervised!({MyApp.Worker, worker_options})
```

Prefer the bang variant so startup failures fail the test at the point of setup. Do not call a process module's `start_link/1` directly or use non-bang `start_supervised/1` in normal test setup.

A direct `start_link` call is appropriate only when the startup contract or its error return is itself the behavior under test; ensure that any successfully started process is still cleaned up.
