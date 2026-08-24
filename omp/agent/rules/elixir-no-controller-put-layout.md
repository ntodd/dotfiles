---
description: Phoenix 1.8 discourages controller-specific `put_layout/2`; compose page chrome with layouts and function components.
globs: ["lib/**/*_web/**/*.ex"]
condition: '\bput_layout\s*\('
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

Do not introduce controller-specific `put_layout/2` in Phoenix 1.8. Keep the application root layout in the router/browser pipeline and compose page-specific chrome through the shared layout component and regular function components.

This keeps controller and LiveView rendering on the same component model and avoids the older view/layout indirection. `put_root_layout/2` remains appropriate in router or controller pipelines when the root document layout genuinely differs.
