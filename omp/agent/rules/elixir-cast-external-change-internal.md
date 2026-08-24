---
description: Use `cast/3` for untrusted external params and `change/2` or explicit struct construction for trusted internal data.
globs: ["*.ex", "*.exs"]
condition: '\b(?:Ecto\.Changeset\.)?cast\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Use `Ecto.Changeset.cast/3` at an external boundary—forms, APIs, CLI input—to filter permitted keys and convert values into schema types.

Use `Ecto.Changeset.change/2`, `put_change/3`, or explicit struct construction for values produced by trusted application code and already in the expected types. Do not merge server-owned values into params merely so they can pass through `cast/3`.

Ownership and tenancy values must come from the authenticated scope and remain outside the permitted cast fields. A context may combine an externally cast changeset with explicit trusted changes after the boundary is clear.
