---
description: Use LiveView's complete upload contract: allow, validate, render errors, cancel, and consume entries safely.
globs: ["*.heex", "*.ex"]
condition: '<\.live_file_input\b'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Configure uploads with `allow_upload/3`, normally in mount, including accepted types, maximum entries, and maximum size. Render `<.live_file_input upload={@uploads.name}>` inside a uniquely identified form that has both `phx-change` and `phx-submit`; upload validation depends on the change binding.

Render friendly errors from `upload_errors/1` and `upload_errors/2`, support `cancel_upload/3` where appropriate, and call `consume_uploaded_entries/3` from the submit callback after uploads complete.

Treat client filenames, content types, and other metadata as untrusted. Server-side chunk limits are enforced, but storage naming and authorization remain application responsibilities. Do not rely on one node's local filesystem for durable uploads in a multi-instance deployment; use shared storage or direct external uploads.
