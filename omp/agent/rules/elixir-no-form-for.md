---
description: Use the imported `<.form>` component and `Phoenix.Component.to_form/2` — never `Phoenix.HTML.form_for`/`inputs_for`.
globs: ["*.heex", "*.ex", "*.exs"]
condition: '\bform_for\b|Phoenix\.HTML\.inputs_for\b|(?<!\.)\binputs_for\b'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs), tool:edit(*.heex), tool:write(*.heex)]
---

Never use `Phoenix.HTML.form_for/3` or `Phoenix.HTML.inputs_for/2` — they are outdated.

Assign a form in the LiveView via `to_form/2` and drive the template from the form assign:

```elixir
assign(socket, form: to_form(changeset))
```

```heex
<.form for={@form} id="my-form" phx-submit="save">
  <.input field={@form[:field]} type="text" />
</.form>
```
