---
description: Do not use exceptions for expected control flow; prefer tuple-returning APIs and pattern matching.
globs: ["*.ex", "*.exs"]
astCondition:
  - "try do $$$B rescue $$$R end"
  - "try do $$$B rescue $$$R after $$$A end"
  - "try do $$$B rescue $$$R catch $$$C end"
  - "def $F do $$$B rescue $$$R end"
  - "def $F($$$P) do $$$B rescue $$$R end"
  - "defp $F do $$$B rescue $$$R end"
  - "defp $F($$$P) do $$$B rescue $$$R end"
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
interruptMode: never
---

Use `try/rescue` for genuinely exceptional failures, not expected branches such as missing input, validation errors, lookup misses, or normal service failures. Prefer a non-bang API returning `{:ok, value}` / `{:error, reason}` and handle it with pattern matching.

Bang functions and raised exceptions are appropriate when invalid state is a programmer error, when Phoenix deliberately converts a not-found exception into a response, and in tests or scripts where immediate failure is desired. Keep rescue clauses narrow and match the specific exception; never rescue every error merely to return a generic fallback.
