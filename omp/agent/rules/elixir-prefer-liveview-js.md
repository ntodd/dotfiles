---
description: Prefer `Phoenix.LiveView.JS` commands over a custom hook for simple DOM behavior and transitions.
globs: ["*.heex", "*.ex"]
condition: 'phx-hook\s*=\s*(?:"[^.][^"]*"|\{[^}]+\})'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Before adding an external `phx-hook`, check whether `Phoenix.LiveView.JS` already expresses the behavior. Prefer `JS.show`, `hide`, `toggle`, class and attribute operations, transitions, focus helpers, `dispatch`, and composed `JS.push` commands for ordinary UI interactions. These commands are aware of LiveView DOM patches.

Use a hook when the behavior requires a browser API, third-party JavaScript library, persistent client-side state, or lifecycle integration that JS commands cannot provide. If a hook is still warranted, follow the hook ID and DOM-ownership contract.
