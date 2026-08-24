---
description: Prefer iodata over repeated binary concatenation when constructing output for an API that accepts iodata.
globs: ["*.ex", "*.exs"]
condition: '\b(?:acc|output|buffer|body)\s*<>\s*'
scope: [tool:edit(*.ex), tool:write(*.ex), tool:edit(*.exs), tool:write(*.exs)]
---

When incrementally building output for IO, sockets, hashing, encoding, or another API that accepts iodata, return nested binaries/byte lists instead of repeatedly allocating larger binaries with `<>`.

Pass iodata directly to the accepting API. Call `IO.iodata_to_binary/1` only at a boundary that specifically requires one binary, and do not `List.flatten/1` iodata prematurely.

A small fixed interpolation or a couple of binary concatenations is clearer and not a problem. This guidance applies to repeated accumulation or large output construction, where intermediate copies matter.
