---
description: Prefer function components; use a LiveComponent only when it must encapsulate both state and event handling.
globs: ["*.ex"]
condition: '\buse\s+Phoenix\.LiveComponent\b|\buse\s+[A-Z][A-Za-z0-9_.]*Web\s*,\s*:live_component\b'
scope: [tool:edit(*.ex), tool:write(*.ex)]
---

Use a stateless function component by default. A LiveComponent is justified when a reusable unit must own both additional state and its own event handling.

Do not introduce a LiveComponent merely to split markup, organize a large file, handle an event that can remain in the parent LiveView, or optimize without evidence. Function components have a smaller lifecycle and coordination surface.

When a LiveComponent is warranted, give each instance a stable unique component ID, keep a single source of truth for its state, and use `update_many/1` if many instances would otherwise perform one query each.
