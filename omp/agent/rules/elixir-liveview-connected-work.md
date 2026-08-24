---
description: In LiveView `mount/3`, guard subscriptions, timers, and process messaging with `connected?/1`.
globs: ["*.ex"]
condition: '\b(?:[A-Z][A-Za-z0-9_.]*\.)?subscribe\s*\(|\b(?:Process\.send_after|:timer\.send_interval|:timer\.send_after)\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex)]
---

A root LiveView mounts once for the static HTTP render and again for the connected process. When stateful work occurs in `mount/3`, run it only for the connected mount:

```elixir
def mount(_params, _session, socket) do
  if connected?(socket) do
    Reports.subscribe(socket.assigns.current_scope)
  end

  {:ok, assign(socket, :page_title, "Reports")}
end
```

Guard PubSub subscriptions, timers, and messages that require a live process. Keep ordinary assigns and data needed for the disconnected render outside the guard. Do not wrap `assign_async/3`, `start_async/3`, or `stream_async/3` in `connected?/1`; those APIs already start their tasks only after the socket connects. Calls made from callbacks that only run on a connected LiveView do not need an additional check.
