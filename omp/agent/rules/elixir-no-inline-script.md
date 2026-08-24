---
description: Never write raw inline `<script>` tags in HEEx — use a colocated JS hook script tag instead.
globs: ["*.heex", "*.ex"]
condition: '<script\b(?![^>]*:type\s*=\s*\{Phoenix\.LiveView\.ColocatedHook\})'
scope: [tool:edit(*.heex), tool:write(*.heex), tool:edit(*.ex), tool:write(*.ex)]
---

Raw embedded `<script>` tags are incompatible with LiveView — never write them in HEEx.

Use a colocated JS hook instead. Colocated hook names MUST start with a `.` prefix:

```heex
<input type="text" id="user-phone-number" phx-hook=".PhoneNumber" />
<script :type={Phoenix.LiveView.ColocatedHook} name=".PhoneNumber">
  export default {
    mounted() {
      // ...
    }
  }
</script>
```

External `phx-hook` objects must live in `assets/js/` and be passed to the LiveSocket constructor — never inline.
