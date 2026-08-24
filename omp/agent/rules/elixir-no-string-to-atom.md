---
description: Do not pass dynamic/user input to `String.to_atom/1` — atoms are never garbage collected.
globs: ["*.ex", "*.exs"]
condition: 'String\.to_atom\('
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Do not use `String.to_atom/1` on user-provided or otherwise unbounded input — atoms are never garbage collected and this can exhaust the atom table.

Only use it with a known, fixed set of literal strings (e.g. normalizing a closed set of option names), and prefer an `Enum.member?/2` check or `case` match over dynamic atom construction.
