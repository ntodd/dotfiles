---
description: Do not cast tenant or ownership IDs from client params; derive them from the authenticated scope.
globs: ["*.ex", "*.exs"]
condition: '\bcast\s*\([^)]{0,1000}:(?:user|account|organization|org|tenant|owner|workspace)_id\b|@\w*fields\w*\s+\[[^\]]*:(?:user|account|organization|org|tenant|owner|workspace)_id\b'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Ownership and tenancy fields must not be accepted from untrusted attributes. Remove fields such as `user_id`, `account_id`, `organization_id`, `tenant_id`, `owner_id`, and `workspace_id` from `cast/3` field lists.

Set the value from the authenticated scope when constructing the record:

```elixir
%MyApp.Report{account_id: scope.account.id}
|> MyApp.Report.changeset(attrs)
```

For an existing changeset, an explicit server-side `put_change/3` after casting is also acceptable. The important invariant is that client params cannot choose or replace the record's owner or tenant.

If an ID is a genuinely user-selectable relationship rather than an ownership boundary, casting can be appropriate, but validate that the current scope is authorized to reference it.
