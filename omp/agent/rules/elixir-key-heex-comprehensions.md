---
description: Give non-stream HEEx `:for` comprehensions a stable `:key` whenever item identity is available.
globs: ["*.heex", "*.ex"]
condition: '<(?=[^>]*\s:for=\{)(?![^>]*\s:key=\{)(?![^>]*@streams\.)[^>]+>'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

For ordinary HEEx comprehensions, provide stable identity so LiveView can track inserts, removals, and reordering efficiently:

```heex
<li :for={item <- @items} :key={item.id} id={"item-#{item.id}"}>
  {item.name}
</li>
```

Without `:key`, LiveView uses the item index and may treat all following items as changed. Use a stable domain key rather than the index whenever one exists.

Do not add `:key` to stream comprehensions; streams already use their generated DOM IDs. Slots currently do not support keyed comprehensions. A tiny compile-time list with no stable identity may reasonably keep the default index.
