---
description: Keep `Repo` calls and Ecto query construction in contexts, not controllers, LiveViews, or components.
globs: ["lib/**/*_web/**/*.ex"]
condition: '\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.(?:all|all_by|one|one!|get|get!|get_by|get_by!|exists\?|insert|insert!|update|update!|delete|delete!|insert_all|update_all|delete_all|preload|transact)\s*\('
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

The Phoenix web layer is an adapter into the application. Controllers, LiveViews, LiveComponents, and function components should call public context functions rather than invoke `Repo` or build Ecto queries directly.

Keep data access, preloads, scope filtering, constraints, and authorization in a context or context-owned query module. Expose an explicit use-case function or a narrowly allowlisted option instead of leaking arbitrary Repo options into the web layer.

This is an architectural boundary, not a requirement that every context be one giant module. Split focused context-owned query modules when useful while preserving a stable public application API.
