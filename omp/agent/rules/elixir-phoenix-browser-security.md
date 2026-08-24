---
description: Preserve Phoenix browser-pipeline session, LiveView flash, CSRF, and secure-header protections.
globs: ["lib/**/*_web/router.ex"]
condition: '\bpipeline\s+:browser\s+do\b'
scope: [tool:edit(lib/**/*_web/router.ex), tool:write(lib/**/*_web/router.ex)]
---

The standard browser pipeline should retain `fetch_session`, `fetch_live_flash`, `protect_from_forgery`, and `put_secure_browser_headers`, along with the application's accepted formats and root layout. Use `fetch_live_flash` rather than the controller-only flash plug when LiveViews participate.

Do not disable CSRF protection to make a form, integration, or test easier. Cookie-authenticated mutations must use non-GET routes and carry valid CSRF protection; GET and HEAD routes remain safe and idempotent.

Keep stateless API authentication in a separate pipeline rather than accidentally enabling cookie sessions or browser CSRF assumptions for every API request. Any removal of a generated protection requires an explicit threat-model reason.
