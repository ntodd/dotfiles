---
description: Remove LiveView `mount/3` callbacks that only return the unchanged socket.
globs: ["*.ex", "*.exs"]
condition: '\bdef\s+mount\([^)]*,\s*([a-z_]\w*)\s*\)\s*(?:,\s*do:\s*\{\s*:ok\s*,\s*\1\s*\}|do\s+\{\s*:ok\s*,\s*\1\s*\}\s*end\b)'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Do not define an empty LiveView `mount/3` that only returns `{:ok, socket}`. The callback is optional, so remove it until the LiveView has real mount-time work.

Define `mount/3` only when it performs meaningful initialization such as assigning state, streaming data, subscribing when connected, or configuring the returned socket:

```elixir
def mount(_params, _session, socket) do
  {:ok, assign(socket, :page_title, "Reports")}
end
```
