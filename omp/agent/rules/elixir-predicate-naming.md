---
description: Name ordinary boolean functions with `?`; reserve the `is_` prefix for guard-compatible checks.
globs: ["*.ex", "*.exs"]
condition: '\bdefp?\s+is_[a-z_]\w*\??\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

An ordinary function returning a boolean should end in `?`, such as `active?/1` or `authorized?/2`. Reserve `is_foo` names for type checks and macros/functions that are valid in guards.

Do not combine both conventions as `is_active?/1`, and do not give a non-guard function an `is_` name that implies callers can use it in a guard. When a custom predicate truly belongs in guards, define an appropriate `defguard`/`defguardp` expression from guard-safe operations.
