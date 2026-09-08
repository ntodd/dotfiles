---
description: Look for existing date helpers or local-time components before calling `Calendar.strftime` in HEEx.
globs: ["*.heex", "*.ex"]
condition: '(?m)(?:\{|<%=?)[^\n]*\bCalendar\.strftime\('
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Before rendering a date or time with `Calendar.strftime/3` in a template, LiveView, or function component, search the project for an existing formatting path. Look for function components such as `<.local_time>`, `<.datetime>`, or `<.date>`, formatting helpers in the web module's core components or a dedicated helpers module, and existing `Calendar.strftime` call sites that reveal the project's formats and time zone handling. Reuse what exists so formats, locale, and time zone conversion stay consistent across the application.

If no helper exists and the same date format is used or likely to be used in more than one place, add a centralized function component or helper and call it from the template instead of formatting inline.

Fall back to `Calendar.strftime` inline only when no existing component fits and the format is a one-off that does not justify a shared helper. When you do, prefer the project's established format strings and convert `DateTime` values to the user's time zone before formatting.
