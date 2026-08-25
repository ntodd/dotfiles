---
description: Give LiveView submissions immediate latency feedback with `phx-disable-with` or built-in loading-state styling.
globs: ["*.heex", "*.ex"]
condition: '<(?:\.button|button)\b(?=[^>]*\stype\s*=\s*(?:"submit"|\{\s*:submit\s*\}))(?![^>]*\sphx-disable-with(?:\s|=|>))[^>]+>'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Every user-visible LiveView submission should acknowledge latency immediately. For a text-only submit button, use `phx-disable-with="Saving..."`. If the button contains icons or nested markup, style alternate content through the form's built-in `phx-submit-loading` class instead because `phx-disable-with` replaces `innerText`.

LiveView already makes form inputs readonly, disables submit buttons, and suppresses duplicate in-flight clicks until acknowledgement. Do not add a separate server round-trip merely to set a `loading?` assign for submission feedback; use the client loading state that LiveView provides.
