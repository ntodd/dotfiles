---
description: Tests that mutate global state must run synchronously and restore the exact prior state in `on_exit/1`.
globs: ["test/**/*.exs", "*_test.exs"]
condition: '\b(?:Application\.(?:put_env|delete_env)|System\.(?:put_env|delete_env)|File\.cd!|:persistent_term\.(?:put|erase)|Logger\.(?:configure|add_backend|remove_backend))\s*\('
scope: [tool:edit(test/**/*.exs), tool:write(test/**/*.exs), tool:edit(*_test.exs), tool:write(*_test.exs)]
---

Application environment, OS environment, working directory, `:persistent_term`, and Logger configuration are global state. A test that mutates them must use `async: false`, capture whether the original value existed and what it was, and restore that exact state in `on_exit/1`.

Do not restore an assumed default: distinguish a missing key from a key whose value was `nil`, and delete it again when it was originally absent. Avoid persistent application-environment writes in tests.

Prefer injecting configuration or dependencies into the code under test when practical; isolation usually allows the test to remain asynchronous and removes cleanup risk.
