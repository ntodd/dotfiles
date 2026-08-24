---
description: Never drive HEEx directly from a changeset assign; assign `to_form/2` and use `@form` instead.
globs: ["*.heex", "*.ex"]
condition: '@(?:changeset|[a-z_]\w*_changeset)\b'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Do not access a changeset assign from HEEx or pass one directly to `<.form>` or `<.input>`. Build the form in the LiveView with `to_form/2`:

```elixir
socket = assign(socket, :form, to_form(changeset))
```

Drive the template only from the form assign:

```heex
<.form for={@form} id="profile-form" phx-submit="save">
  <.input field={@form[:name]} type="text" />
</.form>
```

Keep changeset inspection in Elixir code. When a server-side field value is needed, use APIs such as `Ecto.Changeset.get_field/2`; never use struct-style Access syntax on a changeset.
