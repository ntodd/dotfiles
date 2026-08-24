---
description: Bound potentially growing `Repo.all` queries with pagination, a limit, or streaming on user-facing paths.
globs: ["lib/**/*.ex"]
condition: '\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.all\s*\(\s*[A-Z][A-Za-z0-9_.]*\s*\)'
scope: [tool:edit(lib/**/*.ex), tool:write(lib/**/*.ex)]
---

A bare `Repo.all(Schema)` assumes the table will remain small forever. For user-facing or operationally growing data, add current-scope filters and an explicit limit, cursor/keyset pagination, or another bounded query. Use `Repo.stream/2` inside a transaction for offline incremental processing of a genuinely large result set.

Avoid offset pagination for very deep or rapidly changing datasets when stable keyset pagination fits the ordering. Return total counts only when the UI actually needs them.

A bare `Repo.all` is acceptable for a deliberately tiny, bounded reference table; document that invariant rather than relying on today's row count.
