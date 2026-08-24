---
description: Never capture a LiveView socket inside `assign_async`, `start_async`, or `stream_async`; extract required values first.
globs: ["*.ex"]
condition: '(?s)\b(?:assign_async|start_async|stream_async)\s*\(.{0,2000}?fn\s*->.{0,2000}?\bsocket(?:\.assigns)?\b'
scope: [tool:edit(*.ex), tool:write(*.ex)]
---

Do not reference `socket` from the function passed to `assign_async/3`, `start_async/3`, or `stream_async/3`. Capturing it copies the entire socket struct into the task process.

Extract the smallest required values before starting the task:

```elixir
def mount(_params, _session, socket) do
  account_id = socket.assigns.current_scope.account.id

  {:ok,
   assign_async(socket, :report, fn ->
     {:ok, %{report: Reports.latest_report(account_id)}}
   end)}
end
```

The same principle applies to other process boundaries: do not capture a connection, changeset, or large struct when the worker only needs a small immutable value.
