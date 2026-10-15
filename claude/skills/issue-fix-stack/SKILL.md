---
name: issue-fix-stack
description: >-
  Use when asked to work a set of GitHub issues to a finished state: "fix these
  issues", "fix the 13 remaining lessons-learned issues", "work this backlog",
  "one PR per issue", "turn these issues into PRs", "get these to done". Handles
  any count from 1 to 50. Drives each issue through triage, reproduction, TDD,
  a stacked PR chain, Codex adversarial review, review-thread disposition, and
  green CI. Pairs with the stacked-pr, git-workflow, code-review, and
  codex-discussion skills, and defers to the project's AGENTS.md for its gates.
---

# Issue Fix Stack

Take a list of issues and drive each one to a merged PR or a written refusal,
without ever leaving the tree in a state where a level does not stand on its
own.

The output is one commit per issue, one PR per issue, chained as a stack, every
level green, every review thread answered, and a report the user can act on.

## Invariants

These hold at every scale, including a single issue.

- **Triage before code.** An issue that does not reproduce on current `main` is
  corrected in the issue, not fixed in a PR. Reproducing first is what catches
  an issue whose diagnosis is wrong.
- **One issue per PR** unless two issues share a root cause, in which case one
  PR names both and `Fixes` both.
- **One commit per level.** A level's tests pass against its own base, not only
  against the top of the stack.
- **Every level is green before the next level exists.** The bottom of the stack
  can merge on its own at any time.
- **Any level of significant size or complexity gets a Codex adversarial review
  before it is pushed.** See Adversarial review for the threshold.
- **Every review thread gets a reply, then a resolution.** A refusal cites code
  or a run, never a preference.
- **A migration level gets `up` and `down` exercised on a real database**, both
  directions, including the case where `down` must refuse.
- **Done means merged, or refused with evidence.** An issue left in neither
  state is unfinished work, and saying nothing about it is not a refusal.

## Phase 0: intake and triage

Do this before writing any code, and before promising a count of PRs.

1. Enumerate the set. Record number, title, and labels for each issue.
2. Classify each one:
   - **bug**: reproduces on current `main`, fix is in-repo.
   - **feature**: new surface, needs a design decision. These do not belong in a
     bug stack.
   - **decision needed**: the fix depends on a product call (which default, which
     retention, which of two behaviours).
   - **data, not code**: the code is correct and the rows are wrong. This needs a
     backfill or a script, not a PR, and it is a separate deliverable.
   - **already fixed**: the bug is gone on `main`. Correct the issue and close it.
3. Reproduce each bug on current `main` and save the command and the observed
   failure. A reproduction that does not fail is a classification error, so
   revisit step 2 instead of writing a defensive test.
4. Check that a linked PR is real. `closedByPullRequestsReferences` counts a PR
   that closes the issue. A text mention is not a fix, and an unrelated branch
   can mention an issue number while doing something else entirely.
5. Ask the user once, up front, about every feature and every decision-needed
   item, with the exact decision stated. Then build the bug stack without
   waiting. Parking ten finished fixes behind one product question wastes the
   work and delays the feedback.

## Phase 1: stack design

Order levels bottom to top by dependency, so a level never changes behaviour its
own base depends on. The usual order:

| Layer | Contents |
|---|---|
| 1 | Schema, migrations, audit and write paths |
| 2 | Context rules: authorization, validation, state transitions |
| 3 | Read paths, queries, list and count fixes |
| 4 | LiveView and templates, browser-verified |
| 5 | Features held behind a decision |

Keep levels that touch the same files adjacent. A stack is rebased from the
bottom, so a change to a shared file low in the stack forces a rebuild of
everything above it.

Name branches `stack/<issue>-<slug>`. The bottom branches from `main` unless the
user names another base. If an open PR already touches the same files, say so and
let the user choose which side merges first.

Where the project is Elixir and Phoenix, the level's fix belongs in a context
function that takes a `%Scope{}` and authorizes inside, with a project-scoped
getter when the id came from the client, and a `*_for_system` variant for
workers. Read the project's `AGENTS.md` for its own version of this rule, since
it wins.

### Scale

- **1 to 5 issues**: one stack, no subagents. Coordination costs more than the
  work.
- **6 to 15 issues**: one stack. Parallel read-only triage is worth it; the
  implementation stays serial because levels share files.
- **16 to 50 issues**: split into two or three stacks by area, one integration
  owner for the tree. A single stack much past 20 levels gets expensive to
  rebase, and a mid-stack change rebuilds everything above it.

## Phase 2: the per-level loop

For each level, in order:

1. **Branch** from the level below.
2. **Reproduce first.** A failing test for a context bug, or a browser check
   against the running dev server for a UI bug. Keep the test when it pins the
   bug's contract; throw it away when it only pins the bug's shape.
3. **Fix at the right layer.** Not at the caller of the bug, and not with a
   guard that hides it.
4. **Run the gates**, cheapest first, and stop at the first failure:
   the project's focused test command, the formatter check, the full test suite,
   the linter, the project's own custom checks, the front-end tests if the
   change touches JS or CSS, and a browser check for anything user-visible.
   `mix precommit` where the project defines it, because it runs the checks a
   human would forget.
5. **Exercise migrations both ways** when the level adds one.
6. **Commit** with an imperative summary under 50 characters, a body of three
   bullets or none, and `Fixes #<n>` (both numbers when one PR covers two
   issues).

If a level turns out to be two independent changes, split it. If it turns out to
be smaller than a commit, fold it into a neighbour rather than shipping a PR
nobody needs to read.

## Phase 3: adversarial review

The point of this step is to find the failure the author cannot see, before a
reviewer does. It is not an approval step.

**Threshold.** A level gets an adversarial review when any of these is true:

- more than one file of real logic, or more than roughly 150 changed lines
- a migration, a backfill, or a data-shaped change
- an authorization, tenancy, or permission boundary
- concurrency: a lock, a transaction, a channel, a race between read and write
- a change to a public contract other code or an integration depends on

Below the threshold, a focused self-review is enough. Above it, run the review.
When in doubt, run it, because the cost is one command.

**Preflight.**

```bash
~/.claude/skills/codex-discussion/scripts/check-codex.sh
```

`NOT_INSTALLED` or `NOT_AUTHENTICATED` ends the step. Say so in the report and
keep going; do not block the stack on a missing tool.

**Run it** with the diff and the invariants, and ask for the failure rather than
for a verdict:

```bash
~/.claude/skills/codex-discussion/scripts/discuss.sh "$(cat <<'EOF'
Adversarial review of one commit. Find what breaks, not what is fine.

Repo: <repo>, branch <branch>, base <base>.
Diff:
<diff>

Context that the diff does not show:
- <callers, invariants, data quirks>

For each finding: the trigger, the consequence, and the smallest correct fix.
Say explicitly if you find none, and say which part of the diff you could not
judge from what I gave you.
EOF
)"
```

`CODEX_CONTEXT_DIR=/path/to/repo` gives it the tree to read when the diff alone
is not enough.

**Disposition every finding** into one of three buckets, and record which:

- **Fixed**: change the code and mention it in the PR body.
- **Refuted**: post the evidence (the code path, the failing test, the run
  output) as a reply on the PR.
- **Out of scope**: name it, and say who owns it.

A finding is never dropped silently. A silent drop is indistinguishable from a
missed one.

## Phase 4: review loop

1. Push with `--force-with-lease`, then re-run the stack tool's metadata step so
   bases stay correct.
2. Wait for CI on **every** level, not just the top. A lower level that fails
   independently of the stack is the whole reason the levels are separate.
3. Read the CI run, not the check name. A superseded run that was cancelled
   reports its checks as failed, and those are not failures. The live run's
   status on the same commit is the answer.
4. For each unresolved review thread: reply with what changed, or with the
   evidence for the refusal, then resolve it. Automate the fetch and the reply;
   never mass-resolve without a reply.
5. Re-check every thread after each push. A fix at a higher level re-triggers
   findings on the levels below it, and a stale unresolved thread blocks a merge
   quietly.

## Phase 5: integration

- **Amending a lower level** means rebuilding the tail: cherry-pick each level
  above onto the new base, re-set each branch, and re-verify.
- **Grep for conflict markers before every push.** A marker committed during a
  cherry-pick survives into the PR and into the merge. Check the whole tree, not
  just the file that conflicted.
- **Verify the chain**: each level's parent is the level below, and each has
  exactly one commit.
- **Run the full suite at the top of the stack**, and the project's precommit,
  before asking for a final review.
- **Never merge without being asked.** Report readiness and let the user decide.

## Phase 6: the report

Lead with the count and the state. Then:

- a table of levels: PR number, issue number, title
- every review finding and how it was dispositioned, including refutations
- the verification actually run, with the commands and the observed result
- blockers, with what was tried
- asks: the product decisions still open, and anything that needs a human

Report only what was run. An unverified claim is worse than a missing one.

## Failure modes seen in practice

- **An issue whose only "PR" is an unrelated mention.** Checking text mentions
  instead of closing references hides a whole unfixed issue.
- **A committed conflict marker** from a hand-resolved cherry-pick. Grep for it.
- **A level's change invalidating a lower level's test.** Removing a handler that
  looks unused deleted a guard an authorization test pinned. Search for tests
  that exercise a symbol before deleting it.
- **A new validation blocking a deliberate existing behaviour.** The test that
  pins the old behaviour is the specification; narrow the new rule instead of
  rewriting the test.
- **A migration whose `down` silently discards audit rows.** Refuse to run, name
  the table and the row count, and leave the schema unchanged.
- **A review complaint that contradicts the framework's contract.** Cast errors
  on client-supplied ids are handled by the framework in Phoenix; fixing them
  adds noise. Check the project's review rules before acting on one.
- **Trusting a check name over a run id** and chasing a failure that was a
  cancelled duplicate run.
- **Discovering mid-stack that two levels are one change.** Fold them and rebuild
  the tail, rather than shipping a level that only makes sense with the one above.

## Definition of done

- Every issue in the set is closed by a merged PR, or refused in writing with the
  evidence for the refusal.
- Every level has one commit, the correct base, and its own passing run.
- Every review thread has a reply and is resolved.
- CI is green on every level.
- The full suite passes at the top of the stack.
- Migration levels are exercised up and down on a real database.
- The report names every decision still open.
