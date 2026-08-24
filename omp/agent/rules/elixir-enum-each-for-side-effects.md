---
description: Use `Enum.each/2` for side effects; use `Enum.map/2` only when the transformed result is consumed.
globs: ["*.ex", "*.exs"]
condition: '(?s)\bEnum\.map\s*\(.{0,1000}?(?:send|deliver|notify|insert|update|delete|write|broadcast|enqueue|perform)\w*(?:\s*\(|/\d)'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

`Enum.map/2` communicates that each item is transformed and that the returned collection matters. If the callback exists only to send, persist, notify, log, write, or perform another side effect and the result is ignored, use `Enum.each/2`.

Use `map`, `flat_map`, `reduce`, or `map_reduce` when their returned value is part of the computation. For a lazy side-effect pipeline, use `Stream.each/2` and terminate it with `Stream.run/1` or another consumer.

Changing `map` to `each` is not valid when callers rely on the collected return values; inspect the surrounding contract before rewriting.
