---
description: Keep `with ... else` clauses simple; normalize distinct errors close to the operation that produced them.
globs: ["*.ex", "*.exs"]
condition: '(?s)\bwith\b.{0,3000}?\belse\b'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

A `with` expression should make the success path linear. Avoid a large `else` block that must guess which clause produced a shared or ambiguous error shape.

Normalize errors in small private functions near their source, then let `with` return the normalized error directly. A short `else` remains appropriate when it handles one or two unambiguous patterns that are clearer at the call site.

If several branches require unrelated recovery logic, use explicit `case` expressions or split the workflow rather than concentrating every failure in one catch-all `else`.
