---
description: HEEx has no `<% else if ... %>` branch — use `cond` or `case` for multiple branches.
globs: ["*.heex", "*.ex"]
condition: '(?i)<%\s*(?:else\s+if|elsif|elseif)\b'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

HEEx does not support `<% else if ... %>`, `<% elsif ... %>`, or `<% elseif ... %>` branches. Use `cond` or `case` instead:

```heex
<%= cond do %>
  <% condition -> %>
    ...
  <% other_condition -> %>
    ...
  <% true -> %>
    ...
<% end %>
```
