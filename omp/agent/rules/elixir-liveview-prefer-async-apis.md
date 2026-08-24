---
description: Prefer LiveView's high-level async APIs over raw Tasks; use `assign_async` by default for data-loading assigns.
globs: ["lib/**/*_web/**/*.ex"]
condition: '\bstart_async\s*\(|\b(?:Task\.(?:async|start|start_link)|Task\.Supervisor\.(?:async|async_nolink|start_child)|spawn(?:_link)?)\s*\('
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

Choose the highest-level LiveView async abstraction that matches the result:

- Use `assign_async/3` when the operation fetches one or more values that become assigns. It manages `AsyncResult`, errors, rendering state, connection deferral, and LiveView lifecycle automatically.
- Use `stream_async/3` when the result is a collection intended for a LiveView stream.
- Use `start_async/3` only for a named workflow whose arbitrary result genuinely needs custom `handle_async/3` logic, cancellation, or state merging that does not map cleanly to async assigns or a stream.

Do not hand-roll UI-scoped async loading with `Task`, `spawn`, `send(self(), ...)`, and `handle_info/2` when `assign_async` or `stream_async` solves it directly. Work that must survive navigation, restart independently, or retry durably belongs in a background job, not a LiveView-owned task.
