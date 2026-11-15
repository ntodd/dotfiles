---
description: Implement a spec or GitHub issue in this repo with the team-implement DAG
argument-hint: "<spec-path-or-issue> \"<verify command>\""
---

Implement `$1` in this repository with the team-implement DAG. The second argument, `$2`, is the verify command; the caller quoted it.

1. Read `skill://team-implement`.
2. Load the driver in one eval cell: `%load "~/.omp/agent/skills/team-implement/driver.py"`, or `.omp/skills/team-implement/driver.py` when the repository ships its own copy.
3. In the next eval cell: `team_implement(spec="$1", verify="$2", cwd=".")`
4. Report `verify_exit`, `verdict`, `repair_rounds`, `changed`, and `rundir` from the returned dict.
5. If the call raises, report the error message and the last lines of `<rundir>/verify.log`. Do not restart the run.
6. Read `git diff` and `<rundir>/review.md` before reporting success. The change stays uncommitted.
