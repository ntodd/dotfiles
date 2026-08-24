---
description: Implement `Phoenix.Param` when a resource consistently routes by slug, UUID, or another public identifier.
globs: ["*.ex", "*.heex"]
condition: '~p"[^"]*#\{@?[a-z_]\w*\.(?:slug|uuid|external_id|public_id)\}'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.heex), tool:write(*.heex)]
---

If one resource consistently appears in routes through the same slug, UUID, external ID, or public ID, implement `Phoenix.Param` for that struct and interpolate the struct directly:

```elixir
~p"/reports/#{report}"
```

This centralizes route encoding and removes repeated `report.slug` or `report.public_id` knowledge from controllers, LiveViews, components, and tests.

Use field interpolation when a route intentionally selects among multiple identifiers or the value is not the resource's canonical public identity. `Phoenix.Param` changes URL representation only; context lookups must still use current scope and must not treat an opaque ID as authorization.
