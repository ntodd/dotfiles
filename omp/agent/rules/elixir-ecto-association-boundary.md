---
description: Use Ecto association APIs according to trust boundaries and treat destructive `on_replace` behavior explicitly.
globs: ["*.ex", "*.exs"]
condition: '\b(?:cast_assoc|cast_embed|put_assoc|put_embed)\s*\(|\bon_replace:\s*:(?:delete|delete_if_exists|nilify|update)\b'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Use `cast_assoc/3` and `cast_embed/3` when nested external params should be cast and validated with the parent. Use `put_assoc/4` and `put_embed/4` for trusted internal structs/data that replace the relationship as a whole. Use `Ecto.Multi` when the workflow needs explicit operations across records.

Review `:on_replace` as a data-deletion policy, not a convenience flag. In particular, `:delete` and `:delete_if_exists` can let omitted or empty client association data delete persisted records. Prefer an explicit authorized deletion signal and changeset when deletion is user-controlled.

Preload the existing association when the chosen operation needs to compare current and submitted members.
