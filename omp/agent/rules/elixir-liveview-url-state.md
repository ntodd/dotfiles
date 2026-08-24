---
description: Put shareable and recoverable LiveView UI state in the URL and drive it through patch navigation.
globs: ["lib/**/*_web/**/*.ex"]
condition: '(?i)\bdef\s+handle_event\(\s*"(?:select[-_]?tab|tab|filter|sort|search|page|paginate|next[-_]?page|prev(?:ious)?[-_]?page)"'
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

Tabs, filters, sorting, search terms, and pagination that users should bookmark, share, or recover after reconnect belong in path/query parameters. Change them with `<.link patch>` or `push_patch/2`, validate them in `handle_params/3`, and derive the rendered state from the URL.

This reduces fragile server-only state, preserves state across crashes and deployments, supports browser back/forward navigation, and makes links meaningful.

Keep truly ephemeral UI state—an open tooltip, temporary focus, a local animation—out of the URL. A search term may also remain local while the user types and be patched only when submitted; choose based on whether intermediate states deserve history entries.
