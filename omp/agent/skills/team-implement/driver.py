"""team-implement: one repository change, gated by the caller's verify command.

team_implement(spec, verify, cwd) runs planner, two parallel designs, implementer,
reviewer and repairer as fresh-context subagents that share files under
<repo>/.omp/team-runs/<run_id>/. verify is the only pass condition: a run that still
exits nonzero, or whose review.md verdict is FAIL, raises instead of returning.

Helpers are nested so that loading this file next to another team driver in one
eval kernel cannot rebind the other driver's module-level names.
"""

import time
from pathlib import Path


def team_implement(spec="spec.md", verify=None, cwd=".", repairs=1, verify_timeout=900, check_ledger=True):
    rules = (
        "Fresh context: stage inputs are files on disk, not chat. Read {rundir}/spec.md, "
        "{rundir}/plan.md and {rundir}/notes.md before acting. Repository root: {repo}. "
        "Prefix every shell command with `cd {repo} &&`, because your process keeps the "
        "session's working directory. Do not commit, do not push, do not write outside that root."
    )
    scaffold = """# team run {run_id}

Spec: `spec.md`. Plan: `plan.md`. Review: `review.md`.

## Design A
<!-- design-a -->

## Design B
<!-- design-b -->

## Implementation

## Repair log
"""

    def run_shell(cmd, workdir, timeout):
        try:
            return 0, sh(cmd, cwd=str(workdir), timeout=timeout)
        except Exception as exc:
            return int(getattr(exc, "exit_code", 1) or 1), (getattr(exc, "output", None) or str(exc))

    def resolve_spec(value, repo):
        candidate = Path(value)
        if not candidate.is_absolute():
            candidate = repo / value
        if candidate.is_file():
            return candidate.read_text(), str(candidate)
        ref = value.strip()
        if not (ref.lstrip("#").isdigit() or "github.com/" in ref):
            raise RuntimeError(
                f"no spec file at {candidate}; pass a path, an issue number, or a GitHub issue URL"
            )
        status, out = run_shell(f"gh issue view {ref} --json number,title,body,comments,labels", repo, 180)
        if status != 0:
            raise RuntimeError(f"gh issue view {ref} failed: {out.strip()[:400]}")
        return out, f"issue {ref}"

    def verdict_of(text):
        for line in text.splitlines():
            stripped = line.strip().lstrip("*`").rstrip("*`").strip()
            if stripped.upper().startswith("VERDICT:"):
                value = stripped.split(":", 1)[1].strip().upper()
                if value.startswith("PASS"):
                    return "PASS"
                if value.startswith("FAIL"):
                    return "FAIL"
        return None

    def run_verify(repo, rundir, cmd, timeout):
        status, out = run_shell(cmd, repo, timeout)
        (rundir / "verify.log").write_text(out)
        return status, out

    def stage(name, label, prompt, handles):
        handle = agent(prompt, agent=name, label=label)
        handles[label] = getattr(handle, "handle", None)
        wait([handle], raise_errors=False)
        return handle

    repo = Path(cwd).resolve()
    if not repo.is_dir():
        raise RuntimeError(f"not a directory: {repo}")
    if not verify:
        raise RuntimeError("verify is required: pass the command whose exit 0 means the change is done")
    spec_text, origin = resolve_spec(spec, repo)

    run_id = time.strftime("%Y%m%d-%H%M%S")
    rundir = repo / ".omp" / "team-runs" / run_id
    rundir.mkdir(parents=True, exist_ok=True)
    (rundir / "spec.md").write_text(spec_text)
    (rundir / "notes.md").write_text(scaffold.format(run_id=run_id))

    header = rules.format(rundir=rundir, repo=repo)
    handles = {}

    stage("dev-planner", "plan", f"{header}\nSpec source: {origin}. Write plan.md in {rundir}.", handles)
    if check_ledger and not (rundir / "plan.md").is_file():
        raise RuntimeError(f"plan stage wrote no plan.md in {rundir}")

    # A failed designer is reported in its handle, not raised, so the other design still lands.
    left = agent(f"{header}\nWrite Design A under <!-- design-a --> in {rundir}/notes.md.", agent="dev-designer-a", label="design-a")
    right = agent(f"{header}\nWrite Design B under <!-- design-b --> in {rundir}/notes.md.", agent="dev-designer-b", label="design-b")
    handles["design-a"] = getattr(left, "handle", None)
    handles["design-b"] = getattr(right, "handle", None)
    wait([left, right], raise_errors=False)

    stage("dev-implementer", "implement", f"{header}\nVerification command: {verify}\nImplement the spec in {repo}.", handles)

    status, log = run_verify(repo, rundir, verify, verify_timeout)
    stage("dev-reviewer", "review-1", f"{header}\nVerification command: {verify}\nReview the working tree and write review.md in {rundir}.", handles)
    verdict = verdict_of((rundir / "review.md").read_text()) if (rundir / "review.md").is_file() else None

    rounds = 0
    while (status != 0 or verdict == "FAIL") and rounds < repairs:
        rounds += 1
        stage("dev-repairer", f"repair-{rounds}", f"{header}\nVerification command: {verify}\nApply the blocking findings in {rundir}/review.md.", handles)
        status, log = run_verify(repo, rundir, verify, verify_timeout)
        stage("dev-reviewer", f"review-{rounds + 1}", f"{header}\nVerification command: {verify}\nRe-review the working tree and overwrite review.md in {rundir}.", handles)
        verdict = verdict_of((rundir / "review.md").read_text()) if (rundir / "review.md").is_file() else None

    _, change_out = run_shell("git status --short", repo, 60)
    summary = {
        "repo": str(repo),
        "run_id": run_id,
        "rundir": str(rundir),
        "spec": origin,
        "verify_exit": status,
        "verdict": verdict,
        "repair_rounds": rounds,
        "handles": handles,
        "changed": change_out.strip().splitlines()[:40],
        "tail": log.strip().splitlines()[-5:],
    }
    if status != 0:
        raise RuntimeError(f"verify still failing after {rounds} repair round(s): {summary}")
    if verdict == "FAIL":
        raise RuntimeError(f"review still failing after {rounds} repair round(s): {summary}")
    if verdict is None:
        raise RuntimeError(f"review.md carries no VERDICT line: {summary}")
    return summary
