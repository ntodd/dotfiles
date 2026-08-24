---
description: Use streams for large or incrementally changing LiveView collections; use keyed assigns for small retained collections.
globs: ["*.heex", "*.ex"]
condition: '\s:for=\{'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Choose the collection representation from its behavior:

- Use a LiveView stream for large, long-lived, append/prepend/delete-heavy collections such as tables, feeds, chats, and infinite scrolling.
- Use a normal assign with a stable `:key` for small collections that must remain enumerable on the server for counting, grouping, sorting, indexing, or derived state.
- Use `stream(..., reset: true)` when filtering or replacing a streamed result set, and `stream_insert`/`stream_delete` for individual changes.
- Never treat `@streams.name` as an enumerable.

A stream container needs a unique ID and `phx-update="stream"` on the immediate parent; each item must use the generated DOM ID unchanged. Do not force a stream onto a small static list when it adds ceremony without memory or incremental-update value, unless a project-local convention explicitly requires streams.
