---
description: Never use `phx-update="append"`/`"prepend"` — use LiveView streams with `phx-update="stream"`.
globs: ["*.heex", "*.ex"]
condition: 'phx-update\s*=\s*["''](?:append|prepend)["'']'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

`phx-update="append"` and `phx-update="prepend"` are deprecated — use LiveView streams.

On the server: `stream(socket, :items, [item])` (with `reset: true` or `at: -1` where needed).

In the template the parent needs `phx-update="stream"` and a DOM id, and each child uses the stream id:

```heex
<div id="items" phx-update="stream">
  <div :for={{id, item} <- @streams.items} id={id}>{item.name}</div>
</div>
```
