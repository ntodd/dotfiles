---
description: Use OTP processes for runtime properties, encapsulate their interfaces, and supervise long-lived work.
globs: ["lib/**/*.ex"]
condition: '\buse\s+GenServer\b|\b(?:GenServer\.(?:call|cast)|Agent\.(?:get|update|get_and_update)|spawn(?:_link)?\s*\(|Task\.start(?:_link)?\s*\()'
scope: [tool:edit(lib/**/*.ex), tool:write(lib/**/*.ex)]
---

Introduce a GenServer, Agent, or process only to model a runtime property such as state ownership, serialization, concurrency, a resource lifecycle, timers, or failure isolation. Keep ordinary calculations and domain transitions in pure modules/functions so a process does not become a needless bottleneck.

Encapsulate `GenServer.call/3`, `GenServer.cast/2`, and Agent operations behind the owning module's public API. Direct calls inside that owner are expected; scattering them across callers leaks the protocol and state representation.

Start long-lived processes under a supervision tree. Use a `Task.Supervisor` or an appropriate supervised child for managed background work. A short-lived, deliberately unlinked task can be valid, but its ownership, failure behavior, and shutdown semantics must be explicit.
