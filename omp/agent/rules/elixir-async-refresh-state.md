---
description: Choose explicit refresh semantics for repeated async loads; use `reset: true` when loading and failure should replace stale results.
globs: ["lib/**/*_web/**/*.ex"]
condition: '(?s)\bdef\s+(?:handle_event|handle_params|handle_info)\b.{0,4000}?\bassign_async\s*\('
scope: [tool:edit(lib/**/*_web/**/*.ex), tool:write(lib/**/*_web/**/*.ex)]
---

On a subsequent `assign_async` call, the prior successful result is preserved by default and takes precedence in `<.async_result>`. This gives stale-while-revalidate behavior, so the first-load `:loading` and `:failed` slots do not replace the existing result.

Choose deliberately:

- Keep the default when stale content should remain visible during refresh; optionally render a lightweight refresh indicator from the loading metadata inside the success UI.
- Pass `reset: true` when the UI should return to the loading state and a refresh failure should replace the previous result.
- For a multi-key operation, `reset` may be a list of keys.

Prefer the `assign_async` reset option over hand-assembling `AsyncResult` state. With lower-level `start_async`, update state through `AsyncResult.loading/1`, `ok/2`, and `failed/2` consistently.
