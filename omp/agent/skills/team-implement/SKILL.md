---
name: team-implement
description: Implement a spec or GitHub issue in the current repository with a team — plan, two parallel designs, implement, verify with your command, review the diff, one repair round. Use for a feature, bug fix, or issue that touches real code; not for reading code or answering questions.
---

# team-implement

One repository change, six role agents, each in a fresh context, handoffs through files under `<repo>/.omp/team-runs/<run_id>/`, and your verify command as the only pass condition.

```
plan ──┬── design-a ──┬── implement ── verify ── review ── repair ── verify ── review
       └── design-b ──┘
```

| stage | agent | reads | writes |
|---|---|---|---|
| plan | `dev-planner` | spec, repo | `<run>/plan.md` |
| design-a / design-b | `dev-designer-a`, `dev-designer-b` | plan, notes | one anchored section of `<run>/notes.md` |
| implement | `dev-implementer` | spec, plan, both designs | source, tests, `<run>/notes.md` |
| verify | `bash` | — | `<run>/verify.log` |
| review | `dev-reviewer` | spec, diff, verify log | `<run>/review.md` (`VERDICT: PASS\|FAIL`) |
| repair | `dev-repairer` | review findings | source, `<run>/notes.md` |

## Run

Slash command, second argument quoted:

```
/team-implement src/specs/durations.md "python3 -m unittest discover -q"
/team-implement #412 "mise run check"
```

Or in the eval kernel:

```python
%load "~/.omp/agent/skills/team-implement/driver.py"
team_implement("docs/specs/durations.md", verify="python3 -m unittest discover -q", cwd=".")
```

A project copy at `.omp/skills/team-implement/driver.py` takes precedence when present; load that path instead.

| argument | meaning |
|---|---|
| `spec` | repo-relative path, issue number (`"412"`, `"#412"`), or GitHub issue URL; `gh issue view` resolves an issue to title, body, comments, and labels |
| `verify` | required shell command run from `cwd`; exit 0 is the only pass condition |
| `cwd` | repository root the team works in (default: session cwd) |
| `repairs` | `None` repeats repair→verify→review until the gate is green; an integer caps the rounds at that value |
| `max_rounds` | hard cap applied when `repairs` is `None` (default 10) |
| `verify_timeout` | seconds per verify run (default 900) |

Returns `verify_exit`, `verdict`, `repair_rounds`, `stalled`, `history` (one entry per stage with its exit code, verdict, and whether the tree changed), `handles` (`agent://<id>` per stage), `changed`, `tail`, `rundir`. A nonzero verify, `VERDICT: FAIL`, or a stalled round raises instead of returning.

Each verify run writes `verify-<n>.log`; `verify.log` always holds the latest. A round that changes nothing in the tree and reproduces the same exit code and verdict stops the loop with `RuntimeError: repair stalled in round <n>`, which is what an environmental failure such as a stale test database produces on the first repair.

## Shared test databases (Ecto)

Applies to `mix`/Ecto projects whose `verify` command opens a database that other checkouts also open. Stacks with in-memory or per-process fixtures (pytest, XCTest, Node) need nothing here. Ecto, one database per run:

```bash
export MIX_TEST_PARTITION=_verify$(date +%s)   # suffixes the test DB name
MIX_ENV=test mix ecto.create
MIX_ENV=test mix ecto.migrate                  # applies this tree's priv/repo/migrations
mix precommit
MIX_ENV=test mix ecto.drop                     # after the run
```

Pass that as the gate: `verify="MIX_TEST_PARTITION=_verify1 MIX_ENV=test mix precommit"`, with `ecto.create` and `ecto.migrate` run for the same partition first.

Signs the database and not the diff is at fault:

- many failures sharing one SQLSTATE (`23502`, `42P01`) and the same relation or column;
- `schema_migrations` rows whose timestamps have no file under `priv/repo/migrations` — another checkout applied them to the shared database;
- `stalled: true` on the first repair round, which is the driver reporting that repair changed nothing and the failure reproduced.

## Boundaries

`verify` passing plus `VERDICT: PASS` is the whole contract. The reviewer is an agent, so its verdict can be wrong, and a verify command can be too narrow to observe a semantic break. Read `<run>/review.md` and `git diff` before merging. Nothing is committed, pushed, or branched; aborting the eval cell or `proc://<agent id>/kill` stops a run and leaves the working tree and ledger as written.

## Model routing

`dev-reviewer` sets `model: "@reviewer"`, which resolves through `modelRoles.reviewer` — with this dotfiles config, `openai-codex/gpt-6.1-sol:high`. The other five roles inherit the calling session's model. To move any role:

```yaml
modelRoles:
  dev_implementer: openai-codex/gpt-6.1-sol:high
task:
  agentModelOverrides:
    dev-implementer: "@dev_implementer"
```

`task.agentModelOverrides` beats the agent's own `model:` line, so a single entry per role repo-wide moves that stage without editing the agent files. A role that cannot resolve (unknown alias, unavailable model) fails preflight rather than falling back to the session model.
