---
description: Drive LiveView test interactions through `element/3` or `form/3` instead of calling server event names directly.
globs: ["test/**/*.exs", "*_test.exs"]
condition: '\brender_(?:click|change|submit|focus|blur|keydown|keyup|hook)\(\s*(?:view|live|lv)\s*,'
scope: [tool:edit(test/**/*.exs), tool:write(test/**/*.exs), tool:edit(*_test.exs), tool:write(*_test.exs)]
---

Prefer DOM-driven LiveView tests:

```elixir
view
|> element("#delete-report")
|> render_click()
```

For forms, build the targeted form with `form/3` and call `render_change/1` or `render_submit/1`. This proves that the element is rendered, carries the expected binding and target, and can actually send the event a browser would send.

Avoid bypassing the DOM with calls such as `render_click(view, "delete", params)` except when the test intentionally targets a lower-level callback contract that cannot be exercised through rendered markup. Assert outcomes with selectors such as `has_element?/2` rather than brittle raw HTML strings.
