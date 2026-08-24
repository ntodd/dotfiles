---
description: LiveViews authenticate at lifecycle boundaries but delegate resource authorization to scope-aware context functions.
globs: ["lib/**/*.ex"]
condition: '\bdef\s+(?:mount|handle_params|handle_event)\s*\('
scope: [tool:edit(lib/**/*.ex), tool:write(lib/**/*.ex)]
---

Use `live_session` and `on_mount` to establish and authenticate `current_scope`. Treat mount params, URL params, and every event payload as untrusted.

Do not implement resource authorization policy in a LiveView, LiveComponent, or controller. Pass the current scope into the context operation and let that function authorize by scoping its query or mutation:

```elixir
def handle_event("delete", %{"id" => id}, socket) do
  :ok = Reports.delete_report(socket.assigns.current_scope, id)
  {:noreply, socket}
end
```

The context must reject or fail to find resources outside the scope. The web layer may translate an authorization result into a flash, redirect, or not-found response, but it must not be the only place enforcing access. Hiding controls in the UI is not authorization.
