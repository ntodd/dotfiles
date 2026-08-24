---
description: Load stable LiveView data in `mount/3`; reserve `handle_params/3` for URL state that can change through patches.
globs: ["lib/**/*_web/**/*.ex"]
condition: '\bdef\s+handle_params\s*\('
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

`handle_params/3` runs after mount and after every live patch. Load data that is stable for the LiveView lifecycle in `mount/3`; load or recompute only path/query-driven state expected to change through `patch` in `handle_params/3`.

Validate every parameter against an explicit allowlist or parser before using it. Pass the current scope to context functions so authorization remains at the data boundary.

Avoid loading the same stable resource in both callbacks or rerunning unrelated expensive queries on every sort/page/filter patch. A router path identity may be loaded in mount while pagination, sorting, or filter params are handled in `handle_params/3`.
