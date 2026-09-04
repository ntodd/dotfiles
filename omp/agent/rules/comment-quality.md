---
description: Require comments to name a concrete non-obvious constraint and its consequence.
condition:
  - >-
      (?im)(?:^[ \t]*(?://+|(?!#\{)#|--|;|%)\s*\S|[ \t](?://+|--)\s*\S|^[ \t]*@(?:moduledoc|doc|typedoc)\b\s*\S|/\*[\s\S]*?\*/|\x3c!--[\s\S]*?--\x3e|"""[\s\S]*?"""|'''[\s\S]*?'''|^\s*\*\s+\S)
  - >-
      (?im)^(?:(?!#\{)[^\r\n])*\b(?:elid\w*|gat(?:e|ed|es|ing)|load[- ]bearing|seam\w*|surface\s+area|blast\s+radius|spine|scaffold\w*|heavy\s+lifting|earn\w*\s+its\s+(?:place|keep)|pay\w*\s+for\s+itself|robust|comprehensive|seamless|leverag\w*|utili[sz]\w*|delv\w*|holistic|elegant|powerful|thoughtful|meaningful|crucial|pivotal|fundamentally|importantly|at\s+its\s+core|worth\s+noting|significant\w*|transformative|unlock\w*|streamlin\w*|orchestr\w*|synergy|paradigm|nuanc\w*)\b
scope: ["text", "tool:edit(*)", "tool:write(*)"]
interruptMode: always
---

Apply this rule to every new or modified source comment, module or function doc comment, generated code-review comment, and explanatory code prose.

A comment is allowed only when it explains a concrete, non-obvious reason that the code does not reveal: an external API requirement, security invariant, ordering constraint, compatibility workaround, resource limit, performance constraint, or business rule. Delete comments that restate code, label blocks, narrate a diff, explain syntax, speculate, or give motivation without its mechanism.

Prefer one short sentence naming the exact constraint and its consequence. Do not add a comment merely to satisfy this rule.

Warn with `TTSR-COMMENT-SLOP` when a comment contains any vague AI-style filler or metaphorical terminology from the trigger list. Treat those terms and inflections as banned unless they are unavoidable literal API or domain vocabulary; rewrite around literal technical vocabulary whenever possible. Instruct the writer to delete the comment or replace it with a precise explanation of the non-obvious constraint. Do not merely soften the wording.
