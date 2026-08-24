---
description: Use LiveView key bindings on supported elements, include fallback handling, and throttle held keydown events.
globs: ["*.heex", "*.ex"]
condition: '<(?=[^>]*\sphx-key(?:down|up)\s*=)(?:\.input|input|textarea)\b[^>]+>|<(?=[^>]*\sphx-(?:window-)?keydown\s*=)(?![^>]*\sphx-throttle\s*=)[^>]+>'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

`phx-keydown` and `phx-keyup` are not supported on input controls; use form bindings such as `phx-change` there. Bind key events to an appropriate focusable element or use `phx-window-keydown`/`phx-window-keyup` for page-level shortcuts.

Prefer keyup when held-key repetition is unnecessary. When keydown repetition is intentional, always add `phx-throttle` to bound event volume.

Browser features such as autofill can emit key events without a `"key"` value. Define specific clauses for supported keys and a final catch-all `handle_event/3` clause that leaves the socket unchanged.
