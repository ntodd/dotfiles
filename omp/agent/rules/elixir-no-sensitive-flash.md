---
description: Keep LiveView flash messages user-facing and non-sensitive because navigation may temporarily store them in the client.
globs: ["lib/**/*_web/**/*.ex"]
condition: '\bput_flash\s*\('
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

Use flash only for concise notifications intended to be displayed to the current user. During redirect or live navigation, flash data is signed and temporarily stored in the client.

Never place access tokens, reset tokens, credentials, private identifiers, raw exception messages, stack traces, internal query details, or other sensitive data in a flash. Log diagnostic detail on the server with appropriate metadata and show a safe, actionable message to the user.

Prefer the application's supported flash kinds, normally `:info` and `:error`, and avoid treating flash as durable workflow state.
