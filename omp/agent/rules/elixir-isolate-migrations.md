---
description: Keep Ecto migrations reproducible by avoiding current application schemas, changesets, contexts, and services.
globs: ["priv/repo/migrations/*.exs", "priv/*/migrations/*.exs"]
condition: '(?m)^\s*(?:alias|import|require)\s+(?!Ecto\b)[A-Z][A-Za-z0-9_.]*'
scope: [tool:edit(priv/repo/migrations/*.exs), tool:write(priv/repo/migrations/*.exs), tool:edit(priv/*/migrations/*.exs), tool:write(priv/*/migrations/*.exs)]
---

A historical migration must continue to run after application modules evolve. Use `Ecto.Migration`, SQL, `Ecto.Query` against table-name strings, and `repo()`; do not call current schemas, changesets, contexts, domain services, mailers, or external APIs.

Write explicit table and column names that describe the database at that migration's point in history. If a complex transformation needs a schema, define a minimal migration-local representation rather than reusing the application schema.

Move long-running, batched, retryable, or externally visible backfills into a release task or dedicated job. Treat already-deployed migrations as immutable history and add a new migration for subsequent changes.
