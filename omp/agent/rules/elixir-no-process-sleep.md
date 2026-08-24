---
description: Avoid `Process.sleep/1` and `Process.alive?/1` in tests — use `Process.monitor/1` DOWN assertions or `:sys.get_state/1`.
globs: ["test/**/*.exs", "*_test.exs"]
condition: 'Process\.sleep\(|Process\.alive\?\('
scope: [tool:edit(test/**/*.exs), tool:write(test/**/*.exs), tool:edit(*_test.exs), tool:write(*_test.exs)]
---

Avoid `Process.sleep/1` and `Process.alive?/1` in tests.

To wait for a process to finish, monitor it and assert on the DOWN message:

```elixir
ref = Process.monitor(pid)
assert_receive {:DOWN, ^ref, :process, ^pid, :normal}
```

To synchronize before the next call (instead of sleeping), use `_ = :sys.get_state(pid)` to ensure the process handled prior messages.
