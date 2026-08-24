---
description: Compare calendar structs with their calendar APIs, not Elixir's structural ordering operators.
globs: ["*.ex", "*.exs"]
condition: '~[DTUN]\[[^\]]+\]\s*(?:<=|>=|<|>)\s*~[DTUN]\[[^\]]+\]|\b[a-z_]\w*(?:date|time|_at)\s*(?:<=|>=|<|>)\s*[a-z_]\w*(?:date|time|_at)\b'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Elixir's `<`, `>`, `<=`, and `>=` compare structs by term structure, not by calendar chronology. Use `Date.compare/2`, `Date.before?/2`, `Date.after?/2`, and the corresponding `Time`, `NaiveDateTime`, or `DateTime` functions.

For `Enum.min/2`, `Enum.max/2`, and sorting, pass the calendar module or an explicit comparator supported by the API. Normalize time zones and precision before comparing values whose semantics require it.

Structural equality may be acceptable for two values already normalized to the same calendar representation; ordering must use the calendar-aware API.
