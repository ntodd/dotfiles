---
description: Express durable data invariants in migrations with nullability, constraints, references, defaults, and appropriate indexes.
globs: ["priv/repo/migrations/*.exs", "priv/*/migrations/*.exs"]
condition: '\b(?:create|alter)\s+table\s*\('
scope: [tool:edit(priv/repo/migrations/*.exs), tool:write(priv/repo/migrations/*.exs), tool:edit(priv/*/migrations/*.exs), tool:write(priv/*/migrations/*.exs)]
---

If persisted data is required, use `null: false`; if a value has a database default, keep the Ecto schema default aligned. Add foreign keys and check/unique constraints for durable relationships and value invariants rather than relying only on changeset validation.

Add indexes for foreign keys and columns used by high-value scope filters, lookups, joins, and ordering when the query plan warrants them. PostgreSQL does not automatically index the referencing side of a foreign key. Avoid speculative indexes: each one costs storage and write work.

Every scope/ownership invariant should be enforceable under concurrency. Use composite unique indexes or checks where the invariant spans several columns, and map expected violations through changeset constraint functions.
