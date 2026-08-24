---
description: In HEEx, generate collections with `<%= for item <- collection do %>` — never `Enum.each` or non-for comprehensions.
globs: ["*.heex", "*.ex"]
condition: '<%=?\s*Enum\.each\b'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

HEEx templates must use `for` comprehensions to render collections — never `Enum.each/2` or other non-for enumerables:

```heex
<ul>
  <li :for={item <- @items}>{item.name}</li>
</ul>
```
