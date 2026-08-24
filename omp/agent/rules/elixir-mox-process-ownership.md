---
description: Keep Mox expectations process-owned; use allowances and explicit synchronization instead of global-mode races.
globs: ["test/**/*.exs", "*_test.exs"]
condition: '\b(?:set_mox_global|set_mox_from_context|allow|verify!|verify_on_exit!)\s*\('
scope: [tool:edit(test/**/*.exs), tool:write(test/**/*.exs), tool:edit(*_test.exs), tool:write(*_test.exs)]
---

Mox expectations belong to the process that defines them. Keep private mode and `setup :verify_on_exit!` by default so tests using the same mock can remain asynchronous.

Tasks normally inherit caller ownership through `$callers`. For another child process, use `Mox.allow(mock, owner_pid, child_pid_or_lazy_fun)` explicitly. Use global mode only for a synchronous test that truly cannot identify its collaborating processes; never combine global Mox mode with `async: true`.

When a mock is called asynchronously, synchronize through an observable message from the expectation and `assert_receive` before verification. Do not race `verify!` against work that may not have called the mock yet, and do not use sleeps as synchronization.
