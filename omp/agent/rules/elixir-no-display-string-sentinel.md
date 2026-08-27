---
description: Never compare against a display string as a sentinel; use nil or a dedicated flag and gate markup with `:if`.
globs: ["*.heex", "*.ex"]
condition: '(?:==|!=)\s*"[A-Z][a-z]|"[A-Z][a-z][^"]*"\s*(?:==|!=)'
scope:
  [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Comparing against user-facing copy, such as `@group != "Other"`, turns a display string into a control-flow sentinel: the next copy edit silently changes behavior, and the coupling is invisible from the call site that renders the string.

Represent the special case in data — `nil`, a dedicated boolean, or an atom the domain layer owns — and derive the display string from it, not the other way around. In templates, gate markup with `:if={@group}` rather than an inequality against wording.

Comparing against protocol or format constants such as `"GET"` or fixed external API values is fine; this rule targets strings a user reads.
