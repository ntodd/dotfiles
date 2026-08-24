---
description: Keep database transactions atomic and short; never perform irreversible external I/O inside them.
globs: ["*.ex", "*.exs"]
condition: '\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.transact\s*\(|\b(?:Ecto\.)?Multi\.run\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Group dependent database writes in one `Repo.transact/2` operation. Use ordinary `with`/`case` control flow for a fixed workflow; use `Ecto.Multi` when operations are dynamic or benefit from composition and introspection.

Do not call HTTP services, send email, charge a payment method, publish a webhook, or perform other irreversible external effects inside a transaction or `Multi.run/3`. A database rollback cannot undo them, and network waits hold a pooled database connection open.

For reliable delivery, insert a durable job or outbox record in the same transaction and perform the effect after commit with idempotency and retries. Keep all code executed inside the transaction bounded and database-focused.
