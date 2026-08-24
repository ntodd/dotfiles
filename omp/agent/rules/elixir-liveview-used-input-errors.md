---
description: Filter LiveView form errors with `used_input?/1` so untouched fields do not show premature validation errors.
globs: ["*.heex", "*.ex"]
condition: '\b(?:field|[a-z_]\w*_field)\.errors\b|@form\[[^\]]+\]\.errors\b'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

LiveView form events include `_unused_` metadata identifying fields the user has not interacted with. Core input components should filter field errors through `Phoenix.Component.used_input?/1`:

```elixir
errors = if used_input?(field), do: field.errors, else: []
```

Render translated errors from that filtered list. This avoids showing a wall of errors as soon as the user touches the first field while still allowing submitted forms to display relevant feedback.

Do not disable unused-field tracking with `phx-no-unused-field` unless the form intentionally needs immediate validation feedback for untouched inputs.
