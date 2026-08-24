---
description: Check for existing function components before adding raw form controls or tables in HEEx.
globs: ["*.heex"]
condition: '<(?:input|select|button|form|table)(?=[\s/>])'
scope: [tool:edit(*.heex), tool:write(*.heex)]
---

Before adding a raw `<input>`, `<select>`, `<button>`, `<form>`, or `<table>`, search the template's imported components and the project's component modules, typically defined in `.ex` files. Reuse an existing function component when its contract supports the required behavior. Shared components preserve the application's styling, accessibility, validation, and interaction conventions.

Do not replace native elements mechanically. Keep the raw HTML when no suitable component exists or when a component cannot preserve the required semantics, attributes, or behavior.
