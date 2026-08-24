---
description: Use `stream_async/3` for asynchronous collection loads instead of manually wiring `start_async`, `handle_async`, and streams.
globs: ["lib/**/*_web/**/*.ex"]
condition: '(?s)\bdef\s+handle_async\b.{0,3000}?\bstream\s*\('
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

When an async operation's result is a collection intended for a LiveView stream, use the built-in `stream_async/3` abstraction:

```elixir
stream_async(socket, :reports, fn ->
  {:ok, Reports.list_reports(scope)}
end)
```

LiveView initializes `@streams.reports`, assigns an `AsyncResult` to `@reports`, starts the task only when connected, and handles success or failure. Render loading and failure through `<.async_result assign={@reports}>` and render the collection from `@streams.reports`.

Return stream options as the third element—`{:ok, items, reset: true}`—when the result should replace the stream. The `reset: true` option passed to `stream_async/4` resets async-result state, not stream contents. Keep `start_async` plus `handle_async` only when the result requires custom stream/state coordination that `stream_async` cannot express.
