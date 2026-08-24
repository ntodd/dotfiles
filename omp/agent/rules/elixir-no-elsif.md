---
description: Elixir has no `elsif` or `elseif` clause — use `cond` or `case` for multiple branches.
globs: ["*.ex", "*.exs"]
condition: '(?i)\b(?:elsif|elseif)\b'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Elixir has no `elsif` or `elseif` clause. Use `cond` or `case` for clear multi-branch control flow.

Use `cond do` (with a `true ->` fallback clause) or `case expr do` for multiple branches:

```elixir
cond do
  condition -> ...
  other_condition -> ...
  true -> ...
end
```

