---
description: Define one production module per `.ex` file; move nested or sibling modules into files matching their names.
globs: ["lib/**/*.ex"]
condition: '(?s)\bdefmodule\s+[A-Z][A-Za-z0-9_.]*\b.{0,20000}\bdefmodule\s+[A-Z][A-Za-z0-9_.]*\b'
scope: [tool:edit(lib/**/*.ex), tool:write(lib/**/*.ex)]
---

Keep one production module in each `.ex` file and name the file after that module. Move nested helpers and sibling modules into their own files and namespaces.

This makes compilation dependencies, code ownership, navigation, test placement, and module discovery predictable, and avoids surprising compile cycles from several unrelated module definitions sharing one source file.

`defimpl` protocol implementations and deliberately generated code follow their own conventions. A migration-local historical schema can also be an explicit exception because it must remain coupled to that migration rather than current application code.
