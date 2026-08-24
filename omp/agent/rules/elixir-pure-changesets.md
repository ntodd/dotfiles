---
description: Keep schema changeset functions deterministic and free of database queries, HTTP calls, email, jobs, and other side effects.
globs: ["*.ex"]
condition: '(?s)\bdef\s+\w*changeset\w*\([^)]*\)\s+do(?:(?!\n\s*end\b).){0,4000}\b(?:Req\.|(?:[A-Z][A-Za-z0-9_.]*\.)?Repo\.|[A-Z][A-Za-z0-9_.]*Mailer\.|deliver(?:_later|_now)?\s*\(|send_email\s*\(|Oban\.insert)'
scope: [tool:edit(*.ex), tool:write(*.ex)]
---

Schema changeset functions should deterministically cast, validate, transform, and annotate database constraints. Constructing the same changeset twice must not query a service, send anything, enqueue work, or otherwise change the world.

Move database lookups, remote validation, email, jobs, and orchestration into a scope-aware context function. Keep any deliberately impure validation isolated and explicitly named rather than hiding it in the ordinary schema changeset pipeline.

Constraint annotations such as `unique_constraint/3` remain appropriate because they describe how a later Repo operation maps a database rejection; they do not perform the side effect while the changeset is built.
