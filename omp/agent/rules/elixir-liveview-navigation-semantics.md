---
description: Choose LiveView patch, navigate, or HTTP navigation according to lifecycle semantics rather than interchangeably.
globs: ["*.heex", "*.ex"]
condition: '<\.link\b[^>]*\s(?:href|navigate|patch)\s*=|\bpush_(?:navigate|patch)\s*\('
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Use the navigation primitive that matches the intended lifecycle:

- `<.link patch>` / `push_patch` updates the current router-mounted LiveView, invokes `handle_params/3`, preserves scroll position, and sends a minimal diff.
- `<.link navigate>` / `push_navigate` dismounts the current LiveView and mounts another LiveView in the same `live_session` while retaining the layout.
- `<.link href>` or an HTTP redirect performs a full page load and works for non-LiveView, external, download, or cross-session destinations.

Do not use `href` for same-LiveView filters or pagination, and do not use `navigate` where a patch should preserve the current LiveView process. Only LiveViews mounted directly by the router participate in live navigation.
