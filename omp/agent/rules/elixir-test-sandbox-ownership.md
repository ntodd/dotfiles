---
description: Give every test child process explicit SQL Sandbox ownership and finish its work before the test owner exits.
globs: ["test/**/*.exs", "*_test.exs"]
condition: '\bEcto\.Adapters\.SQL\.Sandbox\.(?:allow|mode|checkout|start_owner!|stop_owner)\s*\('
scope: [tool:edit(test/**/*.exs), tool:write(test/**/*.exs), tool:edit(*_test.exs), tool:write(*_test.exs)]
---

The SQL Sandbox connection is owned by the test process. When another process queries through the Repo, explicitly grant it access with `Sandbox.allow/3` or rely on supported caller tracking.

Prefer allowances because they preserve `async: true`. Use shared mode only when collaborating processes cannot be identified; shared mode requires synchronous tests and must be enabled after checkout.

Start test-owned workers with `start_supervised!/1` and ensure asynchronous database work completes before the test exits. Otherwise the connection owner can terminate while a child is still querying, producing intermittent ownership errors. PostgreSQL supports concurrent sandbox tests; do not assume the same behavior for adapters whose transaction model cannot support it.
