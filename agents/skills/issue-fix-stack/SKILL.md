---
name: issue-fix-stack
description: >-
  Use when asked to work a set of GitHub issues to a finished state: "fix these
  issues", "fix the 13 remaining lessons-learned issues", "work this backlog",
  "one PR per issue", "turn these issues into PRs", "get these to done". Handles
  any count from 1 to 50. Drives each issue through triage, reproduction, TDD,
  a stacked PR chain, Codex adversarial review, review-thread disposition, and
  green CI. Pairs with the stacked-pr, git-workflow, code-review,
  codex-discussion, pr-feedback, and humanizer skills, and defers to the
  project's CLAUDE.md or AGENTS.md for its gates.
---

# Issue Fix Stack

Take a list of issues and drive each one to a merge-ready PR or a written
refusal, without ever leaving the tree in a state where a level does not stand
on its own. The user decides when to merge.

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
- **Every level passes its local gates before the next level is branched.** The
  bottom of the stack can merge on its own at any time.
- **Any level of significant size or complexity gets a Codex adversarial review
  before its first push.** See Phase 3 for the threshold.
- **Every review thread gets a reply.** Resolve it only once the fix is pushed
  or the refutation is posted with its evidence. A refusal cites code or a run,
  never a preference.
- **A migration level gets `up` and `down` exercised on a real database**, both
  directions, including the case where `down` must refuse.
- **Everything written under the user's name goes through the humanizer skill
  before a reviewer sees it**: PR titles and bodies, review replies,
  refutations, and issue corrections.
- **Done means merge-ready, or refused with evidence.** An issue left in neither
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
4. Check that a linked PR actually closes the issue.
   `closedByPullRequestsReferences` counts a PR that closes the issue. A text mention is not a fix, and an unrelated branch
   can mention an issue number while doing something else entirely.
5. Ask the user once, up front, about every feature and every decision-needed
   item, with the exact decision stated. Then start the bug stack while those
   answers are pending. Parking ten finished fixes behind one product question wastes the
   work and delays the feedback.

## Phase 1: stack design

Order levels bottom to top by dependency: a level may rely on the levels below
it, never on a level above it. The usual order:

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
workers. Read the project's `CLAUDE.md` or `AGENTS.md` for its own version of
this rule, since that version takes precedence.

### Scale

- **1 to 5 issues**: one stack, no subagents. Coordination costs more than the
  work.
- **6 to 15 issues**: one stack. Parallel read-only triage is worth it; the
  implementation stays serial because levels share files.
- **16 to 50 issues**: split into two or three stacks by area. Each stack gets
  its own subagent in its own worktree; the main session owns integration and
  the report. A single stack much past 20 levels gets expensive to
  rebase, and a mid-stack change rebuilds everything above it.

## Phase 2: the per-level loop

For each level, in order:

1. **Branch** with the stack tool so the level is tracked: `gh stack init
   <branch>` for the bottom level, `gh stack add <branch>` for each level
   above. A plain `git checkout -b` leaves the branch out of the stack.
2. **Reproduce first.** A failing test for a context bug, or a browser check
   against the running dev server for a UI bug (the browser-verification skill,
   where the project has one). Keep the test when it pins the bug's contract;
   throw it away when it only pins the bug's shape. Name the test for the
   behaviour, never the issue number, and keep issue numbers out of code
   comments too.
3. **Fix at the right layer.** Not at the caller of the bug, and not with a
   guard that hides it.
4. **Run the gates**, cheapest first, and stop at the first failure. Iterate on
   the focused test file. Before the level is final, run the project's
   precommit (`mix precommit` where defined), or, without one, the formatter
   check, the full suite, the linter, and the project's custom checks. Add the
   front-end tests when the change touches JS or CSS, and a browser check for
   anything user-visible.
5. **Exercise migrations both ways** when the level adds one.
6. **Commit** with an imperative summary under 50 characters, a body of three
   bullets or none, and `Fixes #<n>` (both numbers when one PR covers two
   issues). The summary becomes the PR's generated title, so write it for a
   reviewer.

If a level turns out to be two independent changes, split it. A small fix still
gets its own level; fold two levels together only when they share a root cause.

## Phase 3: adversarial review

The point of this step is to find the failure the author cannot see while it
is still cheap to fix. Ask for breakage, never for approval.

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

`NOT_INSTALLED` or `NOT_AUTHENTICATED` ends the step. Note the skipped review
in the report and continue the stack without it.

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
Say explicitly if you find none, and name any part of the diff that needs
more context to judge.
EOF
)"
```

`CODEX_CONTEXT_DIR=/path/to/repo` gives it the tree to read when the diff alone
is not enough.

**Disposition every finding** into one of three buckets, and record which:

- **Fixed**: amend the fix into the level's commit, rerun the level's gates,
  restack and re-verify the levels above, and mention it in the PR body.
- **Refuted**: record the evidence (the code path, the failing test, the run
  output) for the report. It goes on the PR as a comment once Phase 4 opens it.
- **Out of scope**: name it, and say who owns it.

A finding is never dropped silently. A silent drop is indistinguishable from a
missed one.

## Phase 4: review loop

1. Open the PRs with `gh stack submit --auto`, following the stacked-pr skill.
   `--auto` creates drafts with generated titles. While they are drafts, set
   each title and body with `gh pr edit`: the project's PR template,
   `Fixes #<n>`, and the humanizer pass. Post any Phase 3 refutations then.
   Push later changes with `gh stack push`.
2. Wait for CI on **every** level, not just the top. A lower level that fails
   independently of the stack is the whole reason the levels are separate.
3. Read the CI run, not the check name. A superseded run that was cancelled
   reports its checks as failed, and those are not failures. The live run's
   status on the same commit is the answer.
   A failure that passes on rerun is a flake: file an issue with the output and
   the likely cause, then rerun.
4. List and classify unresolved threads with the pr-feedback skill. For each
   one, reply with what changed or with the evidence for the refusal, then
   resolve it with the `resolveReviewThread` GraphQL mutation. A thread that
   needs a decision or an unfinished fix gets a reply and stays open, and its
   PR is reported as blocked.
5. Re-check every thread after each push. A fix at a higher level re-triggers
   findings on the levels below it, and a stale unresolved thread blocks a merge
   quietly.
6. Mark the PRs ready with `gh stack submit --open` once every level is green
   and every body is final.

## Phase 5: integration

- **Amending a lower level** means rebuilding the tail: amend the level's
  commit, run `gh stack rebase --upstack`, run the gates on the amended level
  and every level above it, and only then `gh stack push`.
- **After a squash merge lower in the stack**, `gh stack rebase` replays main
  and conflicts. Before syncing, record the merged level's old tip, then move
  the lowest unmerged level with `git rebase --onto origin/main <old-tip>
  <branch>` and restack the rest from there. Never rewrite a level whose PR is
  merged or queued.
- **Grep for conflict markers before every push.** A marker committed during a
  cherry-pick or rebase survives into the PR and into the merge. Check the
  whole tree, not just the conflicted file.
- **Verify the chain**: each level's parent is the level below, and each has
  exactly one commit.
- **Run the full suite at the top of the stack**, and the project's precommit,
  before asking for a final review.
- **Merge only when the user asks, and only as far as they named.** `gh stack
  merge <pr-number> --yes` with the project's merge method merges that PR and
  every level below it, so confirm that set with the user first. A bare number
  resolves as a stack number before a PR number, so check which one it hit.
  After the merge, confirm each issue shows closed.

## Phase 6: the report

Lead with the count and the state. Then:

- a table of levels: PR number, issue number, title
- every review finding and how it was dispositioned, including refutations
- the verification actually run, with the commands and the observed result
- blockers, with what was tried
- asks: the product decisions still open, and anything that needs a human

Report only what you ran, with its output. An unverified claim is worse than a
missing one.

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

- Every issue in the set has a merge-ready PR that `Fixes` it, or is refused in
  writing with the evidence for the refusal.
- Every level has one commit, the correct base, and its own passing run.
- Every review thread has a reply. Threads are resolved where the fix or the
  refutation landed; any still open are listed as blockers.
- Every PR is out of draft.
- CI is green on every level.
- The full suite passes at the top of the stack.
- Migration levels are exercised up and down on a real database.
- The report names every decision still open.
