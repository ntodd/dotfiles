---
description: When a numbered plan step ships, update remaining step references in the files you touched.
globs: ["*.ex", "*.exs", "*.heex", "*.md"]
condition: '(?im)^[ \t]*(?:#+|<!--).*\bsteps?\s+\d+|\bin\s+(?:a\s+)?(?:later|future|subsequent)\s+step\b'
scope:
  [
    tool:edit(*.ex),
    tool:write(*.ex),
    tool:edit(*.exs),
    tool:write(*.exs),
    tool:edit(*.heex),
    tool:write(*.heex),
    tool:edit(*.md),
    tool:write(*.md),
  ]
---

Comments and docs that reference a numbered plan ("step 3 of 5", "wired up in a later step") go stale the moment a step ships. After implementing step N, grep the modules and docs you touched for step-number references and update them: drop N from any "later steps" range, mark shipped steps done, and renumber if the plan changed.

A stale "will be added in step 4" comment above code that step 4 already added is worse than no comment; the next reader may re-implement the work or skip validation believing it is pending.

Once work ships, prefer replacing plan-relative comments with a statement of what the code does now; plan position belongs in the plan document, not the code.
