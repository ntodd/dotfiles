---
description: Allowlist client-selected Ecto fields, sort directions, and fragments before constructing a dynamic query.
globs: ["*.ex", "*.exs"]
condition: '\bfield\s*\([^,]+,\s*\^|\bfragment\s*\([^)]*\^(?:params|sort|field|column|order)\b|\border_by\s*:\s*\[\{\s*\^'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Map every client-provided field name, sort key, direction, grouping, or selected expression through a closed allowlist before building an Ecto query. Do not convert arbitrary strings to atoms or treat a parameter as a trusted identifier.

Use `field/2`, `dynamic/2`, and explicit clauses only after selecting a known schema field/expression. Interpolate data values with `^`; never splice raw user content into a fragment, identifier, or SQL ordering expression.

Reject or normalize unknown choices to a documented safe default. Apply current-scope filtering independently—the fact that a field is allowed for sorting does not authorize access to additional rows or columns.
