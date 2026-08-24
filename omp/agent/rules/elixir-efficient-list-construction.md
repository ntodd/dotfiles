---
description: Do not repeatedly append single items while constructing a list; map or prepend and reverse once.
globs: ["*.ex", "*.exs"]
condition: '\b(?:acc|result|results|items|list)\s*\+\+\s*\['
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Appending with `acc ++ [item]` traverses the entire accumulator on every iteration and can turn a linear operation into quadratic work.

Prefer `Enum.map/2` when producing one output per input. For a custom reduction, prepend with `[item | acc]` and call `Enum.reverse/1` once at the end. Use difference lists or iodata for specialized append-heavy output only when their contract warrants it.

Concatenating a few already-built lists can be perfectly reasonable; this rule targets repeated single-item appends during construction, not every use of `++`.
