---
description: In LiveView tests, call `render_async/1` before asserting results produced by asynchronous work.
globs: ["test/**/*.exs", "*_test.exs"]
condition: '\b(?:live|live_isolated)\s*\('
scope: [tool:edit(test/**/*.exs), tool:write(test/**/*.exs), tool:edit(*_test.exs), tool:write(*_test.exs)]
---

When the LiveView under test uses `assign_async/3`, `start_async/3`, `stream_async/3`, or otherwise starts asynchronous work, call `render_async(view)` before asserting the resulting UI. Call it again after any event that starts another asynchronous operation.

```elixir
{:ok, view, _html} = live(conn, ~p"/reports")
_ = render_async(view)

assert has_element?(view, "#report-results")
```

After an event starts new work:

```elixir
view
|> element("#refresh-reports")
|> render_click()

_ = render_async(view)
assert has_element?(view, "#report-results")
```

Do not use sleeps or timing-based assertions to wait for LiveView async operations.
