---
description: Test observable public behavior and outcomes rather than private functions, source text, or incidental implementation details.
globs: ["test/**/*.exs", "*_test.exs"]
condition: '(?m)^\s*(?:test|property)\s+"'
scope: [tool:edit(test/**/*.exs), tool:write(*_test.exs), tool:edit(*_test.exs), tool:write(test/**/*.exs)]
---

Exercise the public API or real application surface and assert observable outcomes: returned domain values, persisted state, rendered elements, messages, events, and externally visible errors.

Do not make private functions public for testing, call them through reflection, assert source-code text, or lock tests to internal helper calls and exact intermediate structs when those details are not the contract. Extract complex pure logic behind a meaningful public module when it deserves direct tests.

A useful test must fail for a plausible behavior regression while remaining stable under a correct refactor. Assert only the fields and effects relevant to that behavior.
