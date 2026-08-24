---
description: Configure and consume `Task.async_stream/3` deliberately for bounded concurrency, timeout, ordering, and failures.
globs: ["*.ex", "*.exs"]
condition: '\bTask\.async_stream\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

`Task.async_stream/3` is lazy: consume it with `Enum`, `Stream.run/1`, or another terminal operation. Choose `max_concurrency` from the actual bottleneck—CPU schedulers, database pool, external rate limit, or memory—not an arbitrarily high number.

Set timeout and failure semantics intentionally. For application-controlled work that should not be killed by an arbitrary default, prefer `timeout: :infinity`; otherwise use a domain timeout and handle exits/timeouts explicitly. Use `ordered: false` when result order is irrelevant.

Limit input before starting the task stream when only a subset is needed, and capture only small required values in each task closure. Inspect every `{:ok, result}` / `{:exit, reason}` outcome instead of silently dropping failures.
