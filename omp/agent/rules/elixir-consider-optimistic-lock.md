---
description: Consider `optimistic_lock/3` for records edited concurrently instead of silently accepting last-write-wins.
globs: ["lib/**/*.ex"]
condition: '\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.update!?\s*\('
scope: [tool:edit(lib/**/*.ex), tool:write(lib/**/*.ex)]
---

When a record may be loaded, edited for a while, and updated concurrently by another user or process, decide whether last-write-wins is acceptable. If not, add a version column and apply `Ecto.Changeset.optimistic_lock/3` to update and delete changesets.

Handle `Ecto.StaleEntryError` as an explicit conflict: reload current data, preserve the user's attempted changes where appropriate, and present a clear retry/merge experience. Long-lived LiveView forms, administration screens, collaborative records, inventory, and configuration are common candidates.

Do not add versioning mechanically to append-only or single-writer data. This rule is a concurrency decision gate for update workflows.
