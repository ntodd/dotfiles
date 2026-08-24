---
description: Pair `assign_async` with `<.async_result>` so loading, failure, and success states are explicit and consistent.
globs: ["*.ex", "*.heex"]
condition: '\bassign_async\s*\(|@\w+\.(?:(?:loading|failed|result)\b|ok\?)'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.heex), tool:write(*.heex)]
---

`assign_async/3` stores an `AsyncResult` under every requested key. Render it with the built-in component instead of manually branching on `.loading`, `.failed`, `.ok?`, and `.result`:

```heex
<.async_result :let={report} assign={@report}>
  <:loading>Loading report...</:loading>
  <:failed :let={_reason}>Unable to load the report.</:failed>
  <.report_panel report={report} />
</.async_result>
```

The callback must return `{:ok, %{key: value}}` with every requested key, or `{:error, reason}`. When values must be fetched together, pass the related key list to one `assign_async` call and return one map. The `:let` result exists only in the success block; the failure slot receives the reason separately.
