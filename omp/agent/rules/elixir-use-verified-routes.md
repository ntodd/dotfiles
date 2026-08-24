---
description: Use Phoenix verified routes (`~p`) for internal paths instead of hardcoded route strings or legacy helpers.
globs: ["*.ex", "*.exs", "*.heex"]
condition: '\b(?:redirect|push_navigate|push_patch)\s*\([^)]*\bto:\s*"/|(?:href|navigate|patch)\s*=\s*"/|\b[A-Za-z_]\w*_(?:path|url)\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs), tool:edit(*.heex), tool:write(*.heex)]
---

Generate internal Phoenix paths with `~p` so the compiler verifies the route and encodes interpolated parameters:

```heex
<.link navigate={~p"/reports/#{@report}"}>View report</.link>
```

```elixir
push_patch(socket, to: ~p"/reports?#{%{page: page}}")
```

Do not use hardcoded internal path strings or legacy `*_path`/`*_url` helpers when a verified route can express the route. Literal external URLs and genuinely dynamic routes that cannot be statically verified are exceptions.
