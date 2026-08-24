---
description: Use dot access or pattern matching for required atom keys; reserve bracket access for optional or dynamic keys.
globs: ["*.ex", "*.exs"]
condition: '(?<!@)\b[a-z_]\w*\s*\[:[a-z_]\w*\]'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

When an atom key is required to exist, use `map.key` or pattern match it. This documents the invariant, enables compiler checks for structs, and fails at the source instead of propagating `nil`.

Use `map[:key]` only when the key is genuinely optional, the key is dynamic, or the value intentionally implements the Access protocol. Structs generally do not implement Access; use their fields directly. For changesets, use `Ecto.Changeset.get_field/3` and related APIs.

HEEx form access such as `@form[:field]` is intentionally correct and is outside this rule.
