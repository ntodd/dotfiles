---
description: Consume SQL `Repo.stream/2` lazily inside `Repo.transact/2`; never return the stream past its transaction.
globs: ["*.ex", "*.exs"]
condition: '\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.stream\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

SQL adapters can enumerate `Repo.stream/2` only while a database transaction owns the connection. Create and fully consume the stream inside `Repo.transact/2`; do not return the lazy enumerable for later consumption.

Use streaming for genuinely large result sets whose rows can be processed incrementally. Select only required fields, choose `max_rows` deliberately, and keep per-row work bounded. Avoid calling `Enum.to_list/1` on a huge stream when that simply recreates the original memory problem.

Keep external network calls out of the transaction. For long exports or backfills, consider bounded batches or a background job so one connection is not held indefinitely.
