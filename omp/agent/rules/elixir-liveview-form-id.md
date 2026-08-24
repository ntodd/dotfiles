---
description: Give every LiveView form a stable, unique DOM ID for recovery, testing, and client state tracking.
globs: ["*.heex", "*.ex"]
condition: '<(?:\.form|form)\b(?![^>]*\sid\s*=)[^>]*>'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Every `<.form>` or LiveView-managed `<form>` needs a stable, unique `id`. LiveView uses form identity for client synchronization, test diagnostics, and automatic recovery after crashes or reconnects:

```heex
<.form for={@form} id="profile-form" phx-change="validate" phx-submit="save">
  ...
</.form>
```

Forms with both `phx-change` and an ID recover current client input automatically after remount. Do not generate an ID that changes as fields are edited, and do not reuse one ID for multiple rendered forms. Stateful wizard forms may add `phx-auto-recover` for specialized reconstruction.
