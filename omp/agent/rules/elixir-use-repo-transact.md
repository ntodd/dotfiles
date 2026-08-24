---
description: On Ecto 3.14+, use `Repo.transact/2`; `Repo.transaction/2` is deprecated and has different return semantics.
globs: ["*.ex", "*.exs"]
condition: '\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.transaction\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Use `Repo.transact/2` for new function-based transactions and pipe `Ecto.Multi` into `Repo.transact/2`. Ecto 3.14 deprecates `Repo.transaction/2`.

This is not always a mechanical rename. A `transact` function must explicitly return `{:ok, result}` to commit or `{:error, reason}` to roll back, and that tuple is returned unchanged:

```elixir
Repo.transact(fn ->
  with {:ok, report} <- Repo.insert(report_changeset),
       {:ok, audit} <- Repo.insert(audit_changeset) do
    {:ok, %{report: report, audit: audit}}
  end
end)
```

Review existing bare return values when migrating from `transaction/2`, which wrapped a successful function result in `{:ok, value}`.
