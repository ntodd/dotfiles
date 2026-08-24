---
description: Phoenix 1.8 context functions that access scoped data must take the scope first and enforce authorization with it.
globs: ["lib/**/*.ex"]
condition: '\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.(?:all|all_by|one|one!|get|get!|get_by|get_by!|exists\?|insert|insert!|update|update!|delete|delete!|insert_all|update_all|delete_all|preload|transact)\s*\('
scope: [tool:edit(lib/**/*.ex), tool:write(lib/**/*.ex)]
---

Follow Phoenix 1.8's scope-first context API. Any public context function that reads, creates, updates, deletes, subscribes to, or broadcasts scoped resources must accept the authenticated scope as its first argument:

```elixir
def get_report!(%Accounts.Scope{} = scope, id) do
  Repo.get_by!(Report, id: id, account_id: scope.account.id)
end
```

Use the scope inside the query or changeset so authorization is enforced at the data boundary. Set ownership fields from the scope rather than params.

The web layer should pass `socket.assigns.current_scope` or `conn.assigns.current_scope`; it must not reproduce authorization policy itself. A truly public or system-wide operation may omit a user scope only when that behavior is deliberate and explicit in its API name.
