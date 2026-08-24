---
description: Give every `phx-hook` a unique DOM ID; external hooks that own their subtree also require `phx-update="ignore"`.
globs: ["*.heex", "*.ex"]
condition: '<(?=[^>]*\sphx-hook\s*=)(?![^>]*\sid\s*=)[^>]+>|<(?=[^>]*\sphx-hook\s*=\s*"[^.][^"]*")(?![^>]*\sphx-update\s*=\s*"ignore")[^>]+>'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Every element with `phx-hook` must have a stable, unique DOM ID:

```heex
<div id="sales-chart" phx-hook="SalesChart">
  ...
</div>
```

When an external hook renders or otherwise owns the element's subtree, prevent LiveView from patching that subtree:

```heex
<div id="sales-chart" phx-hook="SalesChart" phx-update="ignore"></div>
```

Do not add `phx-update="ignore"` merely because a hook exists. If the hook only observes events or augments an element while LiveView still owns its children, keep normal LiveView patching. Colocated hook names start with `.` and still require a unique ID.
