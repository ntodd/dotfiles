# Review instructions

## What to look for

- Review only behavior introduced or changed by the pull request.
- Establish what problem the PR claims to solve, who can actually reach it, and
  whether the benefit justifies the permanent code and operational surface.
- Correctness first: logic errors, reachable edge cases, error handling, data
  integrity, security boundaries, and concurrency.
- Check the changed code's callers and invariants when the diff alone cannot
  establish behavior.
- Apply a senior-engineering sniff test: proportional scope, the simplest correct
  design, fit with repository patterns, six-month maintainability, and technical
  debt created or retired.
- Evaluate production behavior at plausible scale: algorithmic work, allocations,
  queries and I/O, fan-out, concurrency/back-pressure, failure amplification,
  and resource lifetime. Do not invent traffic or hypothetical scale.
- Treat a disproportional solution, machinery for an unreachable state, duplicated
  source of truth, or a concrete long-term maintenance burden as a real design
  finding when the code supports it.
- Treat missing tests as a finding only when the PR introduces an observable
  contract or regression risk that existing coverage does not defend.
- Every finding must show the relevant code and explain the concrete trigger,
  control/data path, failure mode, and impact.

## What to suppress

- Do not report formatter, lint, import-order, or purely stylistic issues.
- Do not report pre-existing problems unless the PR makes them materially worse.
- Do not ask hypothetical “what if” questions without a reachable path.
- Do not request nice-to-have refactors, abstractions, logging, retries,
  validation, or documentation. This does not suppress a concrete fundamental
  value, proportionality, production, debt, or maintenance problem.
- Do not duplicate the same root cause across several findings.

## Voice and structure

- Be concise, direct, and author-friendly. State what the PR actually changes,
  whether it passes the senior-engineering gate, then summarize the merge
  decision and highest-impact concern.
- Keep actionable detail, code excerpts, and gate evidence in their structured
  fields rather than duplicating all of them in the summary. Render every
  code/data-flow diagram as valid Mermaid grounded in exact symbols and paths.
- Use plain technical language. No filler, generic praise, or performative tone.
- Prefer a short review that the author can act on in one pass.

## Verdict

- `changes_requested` when any confirmed blocker, critical, or major finding
  remains.
- `approve` when only minor/nit/style findings remain, or there are no findings.
- Never raise severity to force a verdict.
