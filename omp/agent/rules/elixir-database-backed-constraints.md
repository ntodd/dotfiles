---
description: Back uniqueness, references, and other concurrent invariants with database constraints and map them through changesets.
globs: ["*.ex", "*.exs"]
condition: '\bunsafe_validate_unique\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Application validations cannot guarantee invariants under concurrency. Add the corresponding database unique index, foreign key, check, or exclusion constraint, then map violations into changeset errors with `unique_constraint/3`, `foreign_key_constraint/3`, `check_constraint/3`, or the appropriate constraint function.

`unsafe_validate_unique/4` may provide earlier UI feedback, but it is race-prone and must always be paired with a database unique constraint and `unique_constraint/3`. Do not implement uniqueness as a `Repo.get_by` check followed by an insert.

The database is the source of truth for integrity; the changeset turns a safe database rejection into an application error.
