---
description: Declare public function-component inputs with `attr/3` and `slot/3` for compile-time validation.
globs: ["*.ex"]
condition: '(?s)\bdef\s+(?!render\b)[a-z_]\w*\(assigns\)\s+do\s*.{0,500}?~H'
scope: [tool:edit(*.ex), tool:write(*.ex)]
---

Before each public function component, declare its input contract with `attr/3` and `slot/3`. Specify types, required values, defaults, allowed values, and `:global` passthrough attributes where appropriate:

```elixir
attr :report, MyApp.Reports.Report, required: true
attr :class, :any, default: nil
slot :inner_block

def report_card(assigns) do
  ~H"""
  ...
  """
end
```

These declarations give callers compile-time warnings for missing, mistyped, or unknown inputs and document the component API. Private one-off rendering helpers may use a lighter contract, but reusable public components should be explicit.
