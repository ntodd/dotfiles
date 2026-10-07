---
description: Keep production data operations in callable application modules rather than Mix task-only implementations.
globs: ["lib/mix/**/*.ex"]
condition: '(?m)^\s*(?:use\s+Mix\.Task|@behaviour\s+Mix\.Task)\b|\bdefmodule\s+Mix\.Tasks\.'
scope: [tool:edit(lib/mix/**/*.ex), tool:write(lib/mix/**/*.ex)]
---

A Mix task is a CLI adapter, not the only production execution boundary. Before adding one under `lib/mix`, decide whether it is developer-only tooling or a production operation.

If it can mutate production data—such as a backfill, repair, reconciliation, reindex, or post-deploy data migration—the implementation must live in a public application module or context function (`def`, not `defp`) that is compiled into the release and callable from an attached production IEx session over SSH. Do not require a source checkout, recompilation, or the Mix task itself to be present in order to run the operation in production.

Keep the Mix task, when useful, thin: parse CLI arguments and delegate to the public function. The public function owns the domain operation and should be the path used from both the task and a release shell, for example:

```elixir
# Public application API
MyApp.Reports.backfill_statuses(opts)
```

From the deployed release's remote shell:

```console
bin/my_app remote
```

Then invoke the same public function:

```elixir
MyApp.Reports.backfill_statuses([])
```

A release task or Mix task may remain as a convenience wrapper, but it must not contain the only implementation of a production backfill. A task that is genuinely local or build-time-only can keep task-specific logic; do not force a remote-callable API for tooling that cannot or should not run against the deployed application.
