---
description: Do not guard LiveView async APIs with `connected?/1`; they already defer task startup until connected.
globs: ["lib/**/*_web/**/*.ex"]
condition: '(?s)\b(?:if|case)\s+connected\?\(\s*socket\s*\).{0,2000}?\b(?:assign_async|start_async|stream_async)\s*\(|\bconnected\?\(\s*socket\s*\)\s*(?:&&|and).{0,500}?\b(?:assign_async|start_async|stream_async)\s*\('
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

Call `assign_async/3`, `start_async/3`, and `stream_async/3` unconditionally from `mount/3`. LiveView creates their loading state during the disconnected render but starts the underlying task only after the socket connects:

```elixir
def mount(_params, _session, socket) do
  {:ok,
   assign_async(socket, :report, fn ->
     {:ok, %{report: Reports.latest_report()}}
   end)}
end
```

Use `connected?/1` for stateful work that LiveView does not defer for you, such as PubSub subscriptions, timers, and manual process messages. Wrapping an async API in the guard duplicates its lifecycle logic and often loses the useful disconnected loading state.
