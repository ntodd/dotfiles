---
description: Preload associations before callers or templates access them, and batch repeated component loads to avoid N+1 queries.
globs: ["lib/**/*.ex"]
condition: '\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.(?:all|all_by|one|one!|get|get!|get_by|get_by!)\s*\('
scope: [tool:edit(lib/**/*.ex), tool:write(lib/**/*.ex)]
---

A context function must return data with every association its caller will access already loaded. Express the preload in the query or with `Repo.preload/2` inside the context; do not make templates, controllers, or LiveViews discover missing associations.

Avoid querying once per item in an `Enum` loop, render path, or LiveComponent `update/2`. Batch the query with a preload, an `IN` query, or `update_many/1` for repeated LiveComponent instances.

Choose separate-query or join preloads based on the query: separate preloads are a sound default, while a joined binding is useful when the association is already needed for filtering. Preload nested associations explicitly when downstream code uses them.
