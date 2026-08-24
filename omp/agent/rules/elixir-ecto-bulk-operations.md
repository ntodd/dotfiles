---
description: Treat Ecto bulk operations as low-level APIs that bypass changesets, callbacks, associations, and generated timestamps.
globs: ["*.ex", "*.exs"]
condition: '\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.(?:insert_all|update_all|delete_all)\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

`insert_all`, `update_all`, and `delete_all` bypass ordinary changesets and schema callbacks. They do not automatically manage associations, ordinary UUID generation, or `inserted_at`/`updated_at` values; set every required value explicitly.

Every bulk update/delete query must include current-scope authorization filters. Review database constraints because application validations are skipped.

Choose `on_conflict`, `conflict_target`, replacement fields, placeholders, and `returning` deliberately. Avoid broad `:replace_all` behavior that may overwrite primary keys, timestamps, or fields not owned by the operation. Use regular changesets when per-record validation and domain behavior are required.
