---
description: Use the included `Req` library for HTTP requests — avoid `HTTPoison`, `Tesla`, and `:httpc`.
globs: ["*.ex", "*.exs"]
condition: '\bHTTPoison\b|:httpoison\b|\bTesla\b|:httpc\b'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

Use the `:req` (`Req`) library for HTTP requests — it is already included and is the preferred client. Avoid `HTTPoison`, `Tesla`, and Erlang's `:httpc`.

```elixir
Req.get!("https://api.example.com/items")
```
