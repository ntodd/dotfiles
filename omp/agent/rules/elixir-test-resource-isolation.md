---
description: Isolate test files and logs with ExUnit-managed resources instead of shared paths or global Logger changes.
globs: ["test/**/*.exs", "*_test.exs"]
condition: 'System\.tmp_dir!?\s*\(|["'']/tmp/|Logger\.(?:configure|add_backend|remove_backend)\s*\('
scope: [tool:edit(test/**/*.exs), tool:write(test/**/*.exs), tool:edit(*_test.exs), tool:write(*_test.exs)]
---

Use ExUnit's `@tag :tmp_dir` or `@tag tmp_dir: true` and consume the generated `tmp_dir` from test context. Do not write to a fixed `/tmp` path or another shared filename that parallel tests can overwrite. ExUnit removes managed temporary directories after the test.

Capture expected log output with `ExUnit.CaptureLog.capture_log/1` or `@tag capture_log: true`; do not globally reconfigure or remove Logger backends to silence one test.

Give fixtures and generated artifacts unique per-test paths, close file handles, and let `on_exit/1` undo any external resource not managed by ExUnit.
