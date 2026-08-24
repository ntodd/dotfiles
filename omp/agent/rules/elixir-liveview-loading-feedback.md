---
description: Prefer LiveView's built-in async and event loading states over hand-managed boolean loading assigns.
globs: ["lib/**/*_web/**/*.ex"]
condition: '\bassign\s*\(\s*(?:socket\s*,\s*)?(?::[a-z_]*loading[a-z_]*\??|[a-z_]*loading[a-z_]*\??\s*:)'
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

Do not add a `loading?` assign merely to model work LiveView already tracks:

- For data loading, use `assign_async` or `stream_async` and render the resulting `AsyncResult` with `<.async_result>`.
- For events, use the automatic `phx-click-loading`, `phx-change-loading`, `phx-submit-loading`, and other event loading classes.
- Use `phx-disable-with` for simple submit text or `JS.push(..., loading: selector)` when another element should receive the loading state.

A custom loading/progress assign is appropriate when the state outlives one event acknowledgement, represents multiple workflow stages, or reports durable background-job progress. Otherwise, manual booleans add race-prone server state and an unnecessary round trip.
