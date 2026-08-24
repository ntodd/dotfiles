---
description: Handle validation changes at the form level by default; use input-level `phx-change` only for a distinct event.
globs: ["*.heex", "*.ex"]
condition: '<(?:\.input|input|select|textarea)\b[^>]*\sphx-change\s*='
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Put the normal validation event on `<.form phx-change="validate">` so every change sends the complete form params and the context can rebuild one coherent changeset/form.

An individual input may define `phx-change` only when it intentionally sends a separate event with different behavior or targets a different component. Such an input must still be inside a form, and only that input's params are sent to its callback.

Do not scatter ordinary field validation across many input-specific events; it fragments form state, duplicates changeset work, and makes recovery harder to reason about.
