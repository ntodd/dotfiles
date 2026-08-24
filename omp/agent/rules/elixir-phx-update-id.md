---
description: Every `phx-update` container needs a unique DOM ID; streams also require generated IDs on every item.
globs: ["*.heex", "*.ex"]
condition: '<(?=[^>]*\sphx-update\s*=)(?![^>]*\sid\s*=)[^>]+>'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

A container using `phx-update="stream"` or `phx-update="ignore"` must have a stable, unique `id` so LiveView can track its patching contract.

For streams, put `phx-update="stream"` on the immediate parent and use the generated stream DOM ID unchanged on every direct item element. Do not prefix, replace, or omit those IDs.

For `ignore`, the ID anchors the client-owned subtree across patches. Use ignore only when client code owns that content; ordinary server-rendered elements should keep the default replace behavior.
