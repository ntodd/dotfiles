---
description: Keep Phoenix and LiveView sessions minimal: store an opaque session token, not structs, permissions, or sensitive data.
globs: ["lib/**/*_web/**/*.ex"]
condition: '\bput_session\s*\('
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

A browser session should normally contain only a random, revocable session token or similarly minimal opaque identifier. Fetch the current user and construct the Phoenix 1.8 scope from authoritative server-side data.

Do not store full user/account structs, current roles or permissions, OAuth/API credentials, password material, large mutable state, or confidential business data in the session. Cookie sessions are client-held, replayable, size-limited, and may be signed without encryption depending on configuration; even encrypted values can become stale.

Authorization must use current server-side scope data, not a role or ownership claim copied from the session. Rotate or delete session tokens on logout and security-sensitive account changes.
