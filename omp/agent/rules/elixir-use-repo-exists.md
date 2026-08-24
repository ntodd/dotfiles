---
description: Use `Repo.exists?/2` when only existence matters instead of counting or loading matching rows.
globs: ["lib/**/*.ex", "test/**/*.exs"]
condition: '(?s)\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.aggregate\s*\(.{0,1000}?:count\b|\blength\s*\(\s*(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.all\s*\(|\b(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.one\s*\(.{0,1000}?\bcount\s*\('
scope: [tool:edit(lib/**/*.ex), tool:write(lib/**/*.ex), tool:edit(test/**/*.exs), tool:write(test/**/*.exs)]
---

When the answer is only yes or no, call `Repo.exists?(query)` so the query communicates intent and the database can stop after the first match.

Do not load rows and call `length/1`, or execute a count aggregate and compare it with zero, merely to establish existence. Keep `Repo.aggregate(query, :count)` when the actual count is part of the returned or rendered contract.

The query must still be filtered through the current scope before checking existence; existence of an out-of-scope row is sensitive information.
