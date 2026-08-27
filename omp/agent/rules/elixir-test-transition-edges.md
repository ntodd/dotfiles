---
description: When adding states to a state machine, enumerate the new transition edges and cover each edge with a behavior test.
globs: ["*.ex"]
condition: '\buse\s+Fsmx|\btransitions:\s*%\{|@transitions\s+%\{'
scope: [tool:edit(*.ex), tool:write(*.ex)]
---

Adding a state to an Fsmx or hand-rolled transition map adds edges, not just a node. Enumerate every new edge — including clear/reset edges back to earlier states — and write one behavior test per edge, not one per state.

Exercise each transition through the public surface that triggers it (context function, event handler, or DOM interaction) and assert the observable outcome of the move, including that illegal transitions are rejected. A test per state that only checks rendering in that state misses invalid-transition and reset bugs entirely.

Edges intentionally unreachable from the UI still need coverage at the context level.
