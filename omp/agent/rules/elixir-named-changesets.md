---
description: Prefer operation-specific changeset functions in schemas over generic changeset construction in contexts.
globs: ["*.ex"]
condition: '(?m)\b(?:defp?\s+changeset|(?:[A-Z][A-Za-z0-9_.]*\.)?changeset|Ecto\.Changeset\.[a-z_]\w*)\s*\('
scope: [tool:edit(*.ex), tool:write(*.ex)]
---

When a context exposes a domain operation, keep that operation's changeset in the schema and give it a domain-specific name. Prefer `Report.update_changeset(report, attrs)` for an update and `Report.approve_changeset(report)` for an approval over a generic `Report.changeset(...)` or a direct `Ecto.Changeset.*` pipeline assembled in the context.

Name changesets after the operation and its intent: `create_changeset`, `update_changeset`, `approve_changeset`, `archive_changeset`, or `publish_changeset`. The schema owns casting, validation, transformations, and constraint annotations for that operation; the context owns scope checks, authorization, loading, orchestration, and `Repo` calls.

```elixir
# In the schema

def approve_changeset(report) do
  report
  |> change(status: :approved)
  |> validate_required([:approved_at])
end

# In the context

def approve_report(scope, report) do
  report
  |> Report.approve_changeset()
  |> Repo.update()
end
```

Keep shared casting and validation in private schema helpers when operations overlap; do not duplicate pipelines merely to produce different names. A generic `changeset/2` is reasonable only when one operation-agnostic pipeline truly serves every caller. This rule does not prohibit `Ecto.Changeset` APIs inside schema modules or deliberate context-level transformations of an already-built changeset.
