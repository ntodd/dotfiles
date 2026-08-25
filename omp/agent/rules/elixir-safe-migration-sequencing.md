---
description: Sequence Ecto migrations to avoid long locks, table rewrites, and incompatible rolling deployments.
globs: ["priv/repo/migrations/*.exs", "priv/*/migrations/*.exs"]
condition: '\bcreate\s+(?:unique_)?index\s*\(|\badd\s+:[a-z_]\w*\s*,\s*references\s*\(|\b(?:modify|remove|rename)\s+(?::|table\s*\()|\b(?:add|modify)\s+:[a-z_]\w*\s*,[^\n]*(?:default|null)\s*:'
scope: [tool:edit(priv/repo/migrations/*.exs), tool:write(priv/repo/migrations/*.exs), tool:edit(priv/*/migrations/*.exs), tool:write(priv/*/migrations/*.exs)]
---

Evaluate every index, reference, constraint, column removal/rename, default, and type change against the production adapter, table size, and rolling-deploy compatibility.

On populated systems, use the adapter's online/concurrent index strategy; add expensive foreign keys/checks without validation and validate separately where supported; stop application code from selecting a column before dropping it; and use expand/backfill/cutover phases for rewrites or incompatible changes. Keep concurrent index operations isolated in their own migration with the required transaction/lock settings.

Move large backfills into bounded, observable work rather than one deployment transaction. Small or empty tables may justify a simpler migration, but make the scale assumption explicit and benchmark risky operations.
