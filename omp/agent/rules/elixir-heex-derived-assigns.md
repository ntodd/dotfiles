---
description: Move template values read more than once, and per-render list transforms, into derived assigns.
globs: ["*.heex", "*.ex"]
condition: '(?s)((?:[A-Z]\w*\.)*[a-z_]\w*[?!]?\(@[a-z_]\w*[^()]*\)).*?\1|\bEnum\.(?:sort|sort_by|filter|reject|group_by|split_with|uniq|uniq_by|frequencies|flat_map|dedup)\(\s*@[a-z_]\w*'
scope:
  [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

When a template reads the same derived value more than once — the same `Mod.fun(@assign)` or private-helper call appearing twice, or a list transform such as `Enum.sort_by(@items, ...)` running per render — compute it once in the LiveView and read an assign:

```elixir
socket = assign(socket, :visible_items, Enum.reject(items, & &1.archived))
```

Recomputation in HEEx runs on every render and defeats change tracking, since LiveView diffs only what lives in assigns. Funnel derivation through one function that `mount`, `handle_params`, and event handlers all call, so the template stays a pure projection of assigns.

A cheap single read, such as formatting one field inline, is fine. Module attributes referenced from plain (non-template) code are compile-time constants outside this rule.
