---
description: Every `handle_event/3` clause needs a test that reaches it through the rendered DOM.
globs: ["*.ex"]
condition: '\bdef\s+handle_event\('
scope: [tool:edit(*.ex), tool:write(*.ex)]
---

Each `handle_event/3` clause you add or change needs a test that reaches it through the DOM: build the interaction with `element/3` or `form/3`, drive it with `render_click/1`, `render_change/1`, or `render_submit/1`, and assert the observable outcome. This proves the markup actually binds the event and sends the params the clause expects: the failure mode that unit-calling the callback can never catch.

A clause with multiple heads matching different param shapes needs a test per head, each reached through markup that produces that shape.

If no test can reach a clause through the DOM, either the template is missing the binding or the clause is dead; fix whichever is true rather than testing the callback directly.
