---
description: Use Mox and behaviour-based dependency injection for mocks instead of patching module internals.
globs: ["*.ex", "*.exs"]
condition: '\b(?:import|use|alias)\s+(?:Mock|Mimic|Patch)\b|\b(?:Mock|Mimic|Patch)\.|:(?:meck|mock|mimic|patch)\b'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Use Mox for test doubles. Put the collaborator behind a behaviour, define the mock for that behaviour, and inject the implementation through arguments or application configuration.

```elixir
Mox.defmock(MyApp.ExternalServiceMock, for: MyApp.ExternalService)
```

In tests, set expectations with Mox and verify them on exit:

```elixir
import Mox
setup :verify_on_exit!

expect(MyApp.ExternalServiceMock, :fetch, fn id -> {:ok, id} end)
```

Do not patch arbitrary module internals or introduce `Mock`, `Mimic`, `Patch`, or `:meck` when Mox can model the boundary explicitly.
