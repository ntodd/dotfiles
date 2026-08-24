---
description: Preserve LiveView change tracking by using assigns rather than bare variables, assign spreading, or generic map updates.
globs: ["*.heex", "*.ex"]
condition: '(?s)<%\s*[a-z_]\w*\s*=|\{assigns\}|Map\.(?:put|merge)\(\s*assigns\b|\bdef\s+render\(assigns\)\s+do\s+(?!assigns\b)[a-z_]\w*\s*=.{0,1500}?~H'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

LiveView tracks changes through assigns. Avoid local variable assignments inside HEEx and avoid defining bare variables before a LiveView or LiveComponent `~H` render. Compute through a function or assign the derived value with `assign/2`, `assign_new/3`, or `update/3`.

Do not pass all assigns into a component with `{assigns}`; pass the exact attributes the child needs. Do not modify assigns with `Map.put/3` or `Map.merge/2`; those operations discard LiveView's change metadata.

Variables introduced by block constructs such as `for`, `case`, and `if` are supported. Rebinding `assigns = assign(assigns, ...)` before `~H` is also the correct component pattern.
