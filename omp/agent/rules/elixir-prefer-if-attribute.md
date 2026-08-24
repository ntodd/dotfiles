---
description: Prefer HEEx `:if` attributes for conditional elements; use an `if` block only when it has an `else` branch.
globs: ["*.heex", "*.ex"]
condition: '(?s)<%=\s*if\b(?:(?!<%\s*else\s*%>).)*?<%\s*end\s*%'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

When a HEEx conditional only controls whether an element is rendered, put `:if` on that element:

```heex
<div :if={@show_details?} id="details">
  ...
</div>
```

Do not wrap a single conditional branch in `<%= if ... do %>`. Keep block-form `if` only when there is a genuine `else` branch:

```heex
<%= if @available? do %>
  <span id="available">Available</span>
<% else %>
  <span id="unavailable">Unavailable</span>
<% end %>
```
