---
description: Keep runtime secrets and deployment configuration in `runtime.exs`; avoid accidental compile-time capture.
globs: ["config/**/*.exs", "lib/**/*.ex", "mix.exs"]
condition: '\b(?:System\.(?:get_env|fetch_env!)|Application\.(?:get_env|fetch_env!|compile_env!?))\s*\('
scope: [tool:edit(config/**/*.exs), tool:write(config/**/*.exs), tool:edit(lib/**/*.ex), tool:write(lib/**/*.ex), tool:edit(mix.exs), tool:write(mix.exs)]
---

Load production secrets and deployment-specific values in `config/runtime.exs`, normally with `System.fetch_env!/1` so missing required configuration fails startup. Never commit a production secret or provide an insecure production fallback.

Read ordinary application configuration at runtime from inside functions with `Application.fetch_env!/2` or `get_env/3`. Reading runtime configuration into a module attribute freezes it at compilation.

Use `Application.compile_env/3` only for a value that genuinely changes compilation behavior. Compile-time configuration should be rare, must not contain runtime secrets, and cannot be changed later with `Application.put_env/3`. Prefer runtime configuration whenever possible.
