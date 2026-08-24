---
description: Use the imported `<.icon name="hero-...">` component for icons — never the `Heroicons` modules.
globs: ["*.heex", "*.ex"]
condition: 'Heroicons\.'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Always use the imported `<.icon>` component from `core_components.ex` for icons — never render `Heroicons` modules directly:

```heex
<.icon name="hero-x-mark" class="w-5 h-5" />
```
