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
| `repairs` | review→repair→re-verify cycles (default 1) |
| `verify_timeout` | seconds per verify run (default 900) |

Returns `verify_exit`, `verdict`, `repair_rounds`, `handles` (`agent://<id>` per stage), `changed`, `tail`, `rundir`. A nonzero verify or `VERDICT: FAIL` raises instead of returning.

## Boundaries

`verify` passing plus `VERDICT: PASS` is the whole contract. The reviewer is an agent, so its verdict can be wrong, and a verify command can be too narrow to observe a semantic break. Read `<run>/review.md` and `git diff` before merging. Nothing is committed, pushed, or branched; aborting the eval cell or `proc://<agent id>/kill` stops a run and leaves the working tree and ledger as written.

## Model routing

Every role inherits the calling session's model. Per-stage routing goes through `modelRoles` plus `task.agentModelOverrides`:

```yaml
modelRoles:
  dev_implementer: openai-codex/gpt-6.1-sol:high
task:
  agentModelOverrides:
    dev-implementer: "@dev_implementer"
    dev-reviewer: "@reviewer"
```
