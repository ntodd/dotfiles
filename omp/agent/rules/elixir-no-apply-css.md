---
description: Never use `@apply` in raw CSS — write plain CSS or use Tailwind utility classes in templates.
globs: ["*.css"]
condition: '@apply\b'
scope: [tool:edit(*.css), tool:write(*.css)]
---

Never use `@apply` when writing raw CSS in this project (Tailwind v4). Write plain CSS instead, or use Tailwind utility classes directly in HEEx templates.
