---
description: Do not spawn another Task inside a LiveView async callback; the LiveView API already owns the task lifecycle.
globs: ["lib/**/*_web/**/*.ex"]
condition: '(?s)\b(?:assign_async|start_async|stream_async)\s*\(.{0,2500}?fn\s*->.{0,2500}?\b(?:Task\.(?:async|start|start_link)|Task\.Supervisor\.(?:async|async_nolink|start_child))\s*\('
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

The function passed to `assign_async`, `start_async`, or `stream_async` already runs in a task managed with the LiveView lifecycle. Do not wrap its work in `Task.async/1`, `Task.start/1`, or another task merely to make it asynchronous again.

A nested linked task can propagate exits through the link chain and crash the LiveView. An unlinked or separately supervised task may continue after the user navigates away, defeating LiveView's cancellation behavior.

If the work needs bounded concurrency internally, use an intentional abstraction such as `Task.async_stream/3` with explicit limits and failure semantics. If it must outlive the LiveView, move it to a durable background job rather than detaching it inside the callback.
