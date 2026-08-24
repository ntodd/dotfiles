---
description: '`live_redirect`/`live_patch` are deprecated — use `<.link navigate/patch>` and `push_navigate`/`push_patch`.'
globs: ["*.ex", "*.exs", "*.heex"]
condition: '\b(live_redirect|live_patch)\b'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs), tool:edit(*.heex), tool:write(*.heex)]
---

`live_redirect/2` and `live_patch/2` are deprecated in Phoenix LiveView v1.0+.

In templates use the link components:

```heex
<.link navigate={~p"/path"}>navigate</.link>
<.link patch={~p"/path"}>patch</.link>
```

In LiveView modules use:

```elixir
push_navigate(socket, to: ~p"/path")
push_patch(socket, to: ~p"/path")
```
