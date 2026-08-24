---
description: Use `action_fallback` to translate context errors consistently across Phoenix JSON controller actions.
globs: ["lib/**/*_web/controllers/**/*_controller.ex"]
condition: '\bdef\s+(?:create|update|delete)\s*\('
scope: [tool:edit(lib/**/*_web/controllers/**/*_controller.ex), tool:write(lib/**/*_web/controllers/**/*_controller.ex)]
---

For a JSON API whose context functions return regular `{:ok, value}` / `{:error, reason}` tuples, register one `action_fallback` plug and let actions return unhandled error tuples from `with`.

Centralize translation of changeset errors, not-found results, authorization failures, and domain errors into stable HTTP status codes and response shapes. Do not duplicate slightly different error rendering in every action.

An HTML controller with action-specific redirects and flash behavior may reasonably handle errors locally. Even then, keep domain decisions in the scope-aware context and limit the controller to HTTP translation.
