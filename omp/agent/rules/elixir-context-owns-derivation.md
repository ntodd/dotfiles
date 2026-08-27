---
description: Derivation rules belong in the domain module, not the LiveView; the LiveView keeps presentation only.
globs: ["*_live.ex", "**/live/**/*.ex"]
condition: '(?m)^\s*defp\s+[a-z_]\w*[?!]?\([^)\n]*%(?!Socket\{|Phoenix\.LiveView\.Socket\{)[A-Z]\w*(?:\.\w+)*\{'
scope:
  [
    tool:edit(*_live.ex),
    tool:write(*_live.ex),
    tool:edit(**/live/**/*.ex),
    tool:write(**/live/**/*.ex),
  ]
---

A private LiveView function that computes state or decisions from a schema struct — which step comes next, what is allowed, what a value becomes — is domain logic. Put it next to its siblings in the context or state module, where it is unit-testable without mounting a view, and call it from the LiveView.

The LiveView keeps presentation only: labels, option lists, formatting, and assign wiring. If the helper's answer would still be true in a controller, a job, or an API, it does not belong in the view.

Formatting helpers that match on structs purely to render them (dates, money, names) are presentation and can stay. Helpers matching on the socket are LiveView plumbing and are also fine.
