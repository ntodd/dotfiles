---
description: Make LiveView absence assertions provable; pair attribute-filtered refutes with a bare-selector assert and refute only producible selectors.
globs: ["test/**/*.exs", "*_test.exs"]
condition: '\brefute\s+has_element\?\(|\brefute\s+render\(\s*[a-z_]\w*\s*\)\s*=~|\brefute\s+[a-z_]\w*\s*\|>\s*element\('
scope:
  [
    tool:edit(test/**/*.exs),
    tool:write(test/**/*.exs),
    tool:edit(*_test.exs),
    tool:write(*_test.exs),
  ]
---

A refuted selector passes vacuously when the template could never emit it. Before refuting absence, trace the template's id/class expression and confirm the string is one the template can produce from some input — ideally by asserting the same selector present in a state where it must exist.

Attribute-filtered refutes cannot distinguish "element gone" from "present with the attribute off": `refute has_element?(view, "#opt-in[checked]")` passes in both cases. Pair it with `assert has_element?(view, "#opt-in")` unless absence of the whole element is the behavior under test.

When asserting a row was filtered out of a collection, prefer asserting the surviving rows — for example, count elements matching a stable `data-role` — over refuting a speculative id for the missing row.
