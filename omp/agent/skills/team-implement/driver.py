"""team-implement: one repository change, gated by the caller's verify command.

team_implement(spec, verify, cwd) runs planner, two parallel designs, implementer,
reviewer, visual verifier and repairer as fresh-context subagents that share files
under <repo>/.omp/team-runs/<run_id>/. verify is the only pass condition. Repair
repeats until the gate is green, a round changes nothing, or max_rounds is reached;
a run that ends without verify exit 0, review PASS, and visual PASS (when the change
has a UI surface) raises instead of returning.

Helpers are nested so that loading this file next to another team driver in one
eval kernel cannot rebind the other driver's module-level names.
"""

import hashlib
import shlex
import time
from pathlib import Path

UI_SUFFIXES = {
    ".css", ".scss", ".sass", ".less", ".html", ".htm", ".tsx", ".jsx",
    ".vue", ".svelte", ".astro", ".heex", ".eex", ".erb", ".hbs", ".twig",
}
UI_MARKERS = ("/templates/", "/views/", "/components/", "/pages/", "/public/", "/assets/")


def team_implement(
    spec="spec.md",
    verify=None,
    cwd=".",
    repairs=None,
    max_rounds=3,
    verify_timeout=900,
    check_ledger=True,
    visual="auto",
    pr=False,
    pr_base=None,
    pr_title=None,
):
    rules = (
        "Fresh context: stage inputs are files on disk, not chat. Read {rundir}/spec.md, "
        "{rundir}/plan.md and {rundir}/notes.md before acting. Repository root: {repo}. "
        "Prefix every shell command with `cd {repo} &&`, because your process keeps the "
        "session's working directory. Do not commit, do not push, do not write outside that root."
    )
    scaffold = """# team run {run_id}

Spec: `spec.md`. Plan: `plan.md`. Review: `review.md`. Visual: `visual.md`.

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

    def verdict_of(text, keyword="VERDICT"):
        for line in text.splitlines():
            stripped = line.strip().lstrip("*`").rstrip("*`").strip()
            if stripped.upper().startswith(f"{keyword}:"):
                value = stripped.split(":", 1)[1].strip().upper()
                if value.startswith("PASS"):
                    return "PASS"
                if value.startswith("FAIL"):
                    return "FAIL"
                if value.startswith("SKIPPED"):
                    return "SKIPPED"
        return None

    def run_verify(repo, rundir, cmd, timeout, round_no):
        status, out = run_shell(cmd, repo, timeout)
        (rundir / "verify.log").write_text(out)
        (rundir / f"verify-{round_no}.log").write_text(out)
        return status, out

    def change_signature(repo):
        _, tracked = run_shell("git status --short", repo, 120)
        _, diff = run_shell("git diff HEAD", repo, 300)
        return hashlib.sha1((tracked + "\x00" + diff).encode()).hexdigest()[:12]

    def changed_paths(repo):
        _, out = run_shell("git status --short", repo, 120)
        paths = []
        for line in out.splitlines():
            entry = line[3:].strip()
            if " -> " in entry:
                entry = entry.split(" -> ", 1)[1]
            if entry:
                paths.append(entry)
        return paths

    def has_ui_surface(repo):
        for path in changed_paths(repo):
            lowered = f"/{path.lower()}"
            if Path(path).suffix.lower() in UI_SUFFIXES:
                return True
            if any(marker in lowered for marker in UI_MARKERS):
                return True
        return False

    def read_verdict(rundir, name, keyword):
        path = rundir / name
        return verdict_of(path.read_text(), keyword) if path.is_file() else None

    def stage(name, label, prompt, handles):
        handle = agent(prompt, agent=name, label=label)
        handles[label] = getattr(handle, "handle", None)
        wait([handle], raise_errors=False)
        return handle

    def run_visual(repo, rundir, header, handles, round_no):
        if visual == "off":
            return None
        if visual == "auto" and not has_ui_surface(repo):
            return None
        (rundir / "screenshots").mkdir(exist_ok=True)
        stage(
            "dev-visual",
            f"visual-{round_no}",
            f"{header}\nVerification command: {verify}\nDrive the app this change affects and write visual.md in {rundir}, with screenshots under {rundir}/screenshots.",
            handles,
        )
        if check_ledger and not (rundir / "visual.md").is_file():
            raise RuntimeError(f"visual stage wrote no visual.md in {rundir}")
        return read_verdict(rundir, "visual.md", "VISUAL")

    def gh(args, repo, timeout=300, drop_token=False):
        prefix = "env -u GH_TOKEN -u GITHUB_TOKEN " if drop_token else ""
        return run_shell(f"{prefix}gh {args}", repo, timeout)

    def open_pr(repo, rundir, branch, base, title, screenshots):
        body = rundir / "pr-body.md"

        def write_body(note=None):
            lines = [
                title,
                "",
                f"Spec: `{origin}`",
                f"Verify: `{verify}` (exit {status})",
                f"Review: {verdict}",
                f"Visual: {visual_verdict or 'not applicable'}",
                "",
            ]
            for shot in screenshots:
                lines.append(f"![{shot.stem}](screenshots/{shot.name})")
            if note:
                lines += ["", f"> {note}"]
            body.write_text("\n".join(lines) + "\n")

        write_body()
        base_arg = f"--base {shlex.quote(base)} " if base else ""
        attach = " ".join(f"--attach {shlex.quote(f'{shot}#{shot.stem}')}" for shot in screenshots)
        create = f"pr create --head {shlex.quote(branch)} {base_arg}--title {shlex.quote(title)} --body-file {shlex.quote(str(body))}"
        token_dropped = False
        last = ""

        def existing():
            st_list, listed = gh(f"pr list --head {shlex.quote(branch)} --json url -q '.[0].url'", repo, 120)
            return listed.strip() if st_list == 0 else None

        for args, drop in ([(f"{create} {attach}", False), (f"{create} {attach}", True)] if screenshots else []):
            st, out = gh(args, repo, 600, drop_token=drop)
            token_dropped = token_dropped or drop
            if st == 0:
                return out.strip().splitlines()[-1], None, token_dropped
            last = out.strip()[:400]
            url = existing()
            if url:
                return url, None, token_dropped

        if screenshots:
            first_line = last.splitlines()[0] if last else "upload failed"
            write_body(f"Screenshots could not be attached: {first_line}")
        for drop in (False, True):
            st, out = gh(create, repo, 600, drop_token=drop)
            token_dropped = token_dropped or drop
            if st == 0:
                note = f"screenshots not attached: {last.splitlines()[0]}" if screenshots and last else None
                return out.strip().splitlines()[-1], note, token_dropped
            url = existing()
            if url:
                return url, (f"screenshots not attached: {last.splitlines()[0]}" if screenshots and last else None), token_dropped
            last = out.strip()[:400]
        raise RuntimeError(f"gh pr create failed: {last}")

    repo = Path(cwd).resolve()
    if not repo.is_dir():
        raise RuntimeError(f"not a directory: {repo}")
    if not verify:
        raise RuntimeError("verify is required: pass the command whose exit 0 means the change is done")
    spec_text, origin = resolve_spec(spec, repo)

    baseline = ""
    if pr:
        _, baseline = run_shell("git status --porcelain", repo, 120)
        if baseline.strip():
            raise RuntimeError(f"pr=True needs a clean worktree; commit or stash first:\n{baseline[:600]}")

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

    status, log = run_verify(repo, rundir, verify, verify_timeout, 1)
    stage("dev-reviewer", "review-1", f"{header}\nVerification command: {verify}\nReview the working tree and write review.md in {rundir}.", handles)
    verdict = read_verdict(rundir, "review.md", "VERDICT")
    visual_verdict = run_visual(repo, rundir, header, handles, 1)

    def red():
        return status != 0 or verdict == "FAIL" or visual_verdict == "FAIL"

    limit = max_rounds if repairs is None else repairs
    rounds = 0
    stalled = False
    history = [{"stage": "initial", "verify_exit": status, "verdict": verdict, "visual": visual_verdict}]
    signature = change_signature(repo)
    while red() and rounds < limit:
        rounds += 1
        failed = (status, verdict, visual_verdict)
        stage(
            "dev-repairer",
            f"repair-{rounds}",
            f"{header}\nVerification command: {verify}\nApply the blocking findings in {rundir}/review.md and any defect in {rundir}/visual.md.",
            handles,
        )
        status, log = run_verify(repo, rundir, verify, verify_timeout, rounds + 1)
        stage("dev-reviewer", f"review-{rounds + 1}", f"{header}\nVerification command: {verify}\nRe-review the working tree and overwrite review.md in {rundir}.", handles)
        verdict = read_verdict(rundir, "review.md", "VERDICT")
        visual_verdict = run_visual(repo, rundir, header, handles, rounds + 1)
        next_signature = change_signature(repo)
        history.append(
            {
                "stage": f"repair-{rounds}",
                "verify_exit": status,
                "verdict": verdict,
                "visual": visual_verdict,
                "tree_changed": next_signature != signature,
            }
        )
        if next_signature == signature and (status, verdict, visual_verdict) == failed:
            stalled = True
            break
        signature = next_signature

    screenshots = sorted((rundir / "screenshots").glob("*.png")) if (rundir / "screenshots").is_dir() else []
    pr_url, pr_note, token_dropped, pr_branch = None, None, False, None
    if pr:
        if red():
            pr_note = "not opened: the run did not pass its gates"
        else:
            pr_branch = f"team/{run_id}"
            title = (pr_title or spec_text.strip().splitlines()[0].lstrip("# ").strip() or run_id)[:72]
            st, out = run_shell(f"git checkout -b {shlex.quote(pr_branch)}", repo, 120)
            if st != 0:
                raise RuntimeError(f"git checkout -b failed: {out.strip()[:300]}")
            st, out = run_shell('git add -A -- . ":(exclude).omp"', repo, 300)
            if st != 0:
                raise RuntimeError(f"git add failed: {out.strip()[:300]}")
            st_clean, _ = run_shell("git diff --cached --quiet", repo, 60)
            if st_clean == 0:
                raise RuntimeError("nothing to commit: the run produced no tree change outside .omp/")
            st, out = run_shell(f"git commit -m {shlex.quote(title)}", repo, 300)
            if st != 0:
                raise RuntimeError(f"git commit failed (check user.email/user.name and hooks): {out.strip()[:400]}")
            st, out = run_shell(f"git push -u origin {shlex.quote(pr_branch)}", repo, 600)
            if st != 0:
                raise RuntimeError(f"git push failed: {out.strip()[:400]}")
            pr_url, pr_note, token_dropped = open_pr(repo, rundir, pr_branch, pr_base, title, screenshots)

    _, change_out = run_shell("git status --short", repo, 60)
    summary = {
        "repo": str(repo),
        "run_id": run_id,
        "rundir": str(rundir),
        "spec": origin,
        "verify_exit": status,
        "verdict": verdict,
        "visual": visual_verdict,
        "repair_rounds": rounds,
        "stalled": stalled,
        "history": history,
        "handles": handles,
        "screenshots": [p.name for p in screenshots],
        "pr": pr_url,
        "pr_branch": pr_branch,
        "pr_note": pr_note,
        "token_dropped": token_dropped,
        "changed": change_out.strip().splitlines()[:40],
        "tail": log.strip().splitlines()[-5:],
    }
    if stalled:
        raise RuntimeError(f"repair stalled in round {rounds}: no tree change and the same failure: {summary}")
    if status != 0:
        raise RuntimeError(f"verify still failing after {rounds} repair round(s): {summary}")
    if verdict == "FAIL":
        raise RuntimeError(f"review still failing after {rounds} repair round(s): {summary}")
    if visual_verdict == "FAIL":
        raise RuntimeError(f"visual check still failing after {rounds} repair round(s): {summary}")
    if verdict is None:
        raise RuntimeError(f"review.md carries no VERDICT line: {summary}")
    return summary
