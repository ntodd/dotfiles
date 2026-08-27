---
description: Before writing a new flash message, grep for existing user-facing wording for the same condition and reuse it.
globs: ["*.ex"]
condition: '\bput_flash\('
scope: [tool:edit(*.ex), tool:write(*.ex)]
---

Before writing new flash copy, grep the context and web layer for existing user-facing wording for the same condition. If the condition is already worded somewhere, reuse that wording verbatim; two phrasings for one failure confuse users and fork the tests that assert on copy.

The inverse check matters too: if a condition you are about to handle silently already has user-facing wording elsewhere, surface that same message rather than no-op'ing. A branch that swallows a failure the app describes to users in another flow is a bug, not a style choice.

If no prior wording exists, write the message once in terms of what the user can do next, and keep it where sibling conditions in the same context keep theirs.
