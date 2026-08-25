// pr-review extension — a custom PR-review workflow for OMP.
//
// Surface:
//   /pr-review [n]   fetch a PR via `gh`, then prompt the session to review it
//                    and persist the findings via the pr_review_record tool.
//   pr_review_record  LLM-facing tool the review calls to store the summary,
//                    verdict, and structured findings in the session.
//   /pr-view         scrollable full-review viewer with Original and STE-style
//                    prose; exact recorded code and diagrams stay unchanged.
//   /pr-issues       interactive issue list: view the full review, flag issues
//                    for inline GitHub comments, attach notes, discuss, investigate,
//                    and submit one atomic review.
//
// Persistence: state lives in namespaced `custom` entries on the active session
// branch. The LLM-visible summary is a stable baseline for short issue
// diversions; returning to it never pays for branch summarization.

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Markdown, Text } from "@oh-my-pi/pi-tui";
import { getMarkdownTheme } from "@oh-my-pi/pi-coding-agent";
import type {
  CustomMessage,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  ExecOptions,
  ExecResult,
  Theme,
} from "@oh-my-pi/pi-coding-agent";
import { IssueList, type IssueListAction } from "./list-ui.ts";
import { ReviewViewer, type ReviewViewerAction } from "./view-ui.ts";
import {
  allowedReviewEvents,
  buildReviewBody,
  buildReviewSubmissionPlan,
  defaultReviewEvent,
  emptyState,
  fullReviewText,
  findReviewBaselineId,
  findingContextText,
  normalizeFindings,
  normalizeWalkthrough,
  parseSteReviewPresentation,
  qualityGateText,
  patchContainsNewLine,
  reviewEventLabel,
  reviewPresentationText,
  reviewSubmissionError,
  severityRank,
  type PrReviewState,
  type ReviewEvent,
  type ReviewPresentationMode,
  walkthroughText,
} from "./review-core.ts";
import {
  advanceWorkflowFromEvidence,
  advanceWorkflowFromFullOutput,
  createReviewWorkflow,
  bindWorkflowTaskLaunch,
  failRunningWorkflow,
  findLatestReviewWorkflow,
  recordCallCardLines,
  resultEvidenceForJob,
  recordResultCardLines,
  reviewWorkflowActive,
  severityCounts,
  transitionForWorkflowToolCall,
  textFromContent,
  workflowContinuationText,
  workflowProgressLines,
  workflowEvidenceAfter,
  type ReviewRecordDetails,
  type ReviewWorkflowState,
} from "./workflow-core.ts";

/** The `pi` surface the helpers need: exec + session writes. */
type PiExec = {
  exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
};

const STATE_TYPE = "com.nate.pr-review.state";
const SUMMARY_TYPE = "com.nate.pr-review.summary";
const WORKFLOW_TYPE = "com.nate.pr-review.workflow";
const PROGRESS_WIDGET = "pr-review-progress";
const PROGRESS_STATUS = "pr-review";
const REVIEW_EVENTS: Array<{ event: ReviewEvent; label: string; description: string }> = [
  { event: "COMMENT", label: "Comment", description: "Post feedback without an approval decision." },
  { event: "REQUEST_CHANGES", label: "Request changes", description: "Block merge until the findings are addressed." },
  { event: "APPROVE", label: "Approve", description: "Approve the pull request and post the review." },
];
const REVIEW_BODY_OPTIONS = [
  {
    label: "Inline comments only",
    description: "Leave the overall review body blank. This is the default.",
  },
  {
    label: "Generate review body",
    description: "Pre-fill a summary from the recorded review, then open it for editing.",
  },
] as const;


interface QuickChatRuntime {
  activeTools?: string[];
}


type AnyState = PrReviewState | null;

type SessionEntry = {
  type?: string;
  customType?: string;
  data?: unknown;
  id?: string;
  message?: { role?: string; content?: unknown };
};

// ============================================================================
// State persistence
// ============================================================================


function hydrateState(data: Partial<PrReviewState>): PrReviewState {
  const state: PrReviewState = {
    ...emptyState(),
    ...data,
    presentationMode: data.presentationMode === "ste" ? "ste" : "original",
    walkthrough: normalizeWalkthrough(data.walkthrough),
    findings: normalizeFindings(data.findings),
    stePresentation: undefined,
  };
  if (data.stePresentation) {
    try {
      state.stePresentation = parseSteReviewPresentation(JSON.stringify(data.stePresentation), state);
    } catch {
      state.stePresentation = undefined;
    }
  }
  return state;
}

/** Rebuild state from the newest `com.nate.pr-review.state` entry on the branch. */
function stateFromBranch(sm: { getBranch(leafId?: string | null): unknown[] }): AnyState {
  const branch = sm.getBranch();
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = branch[i] as SessionEntry | null;
    if (entry && entry.type === "custom" && entry.customType === STATE_TYPE && entry.data) {
      return hydrateState(entry.data as Partial<PrReviewState>);
    }
  }
  return null;
}


interface WorkflowBranchContext {
  stored: ReviewWorkflowState;
  current: ReviewWorkflowState;
}


function workflowBranchContext(
  sm: { getBranch(leafId?: string | null): unknown[]; getEntries(): unknown[] },
): WorkflowBranchContext | null {
  const branch = sm.getBranch();
  const located = findLatestReviewWorkflow(branch, sm.getEntries(), WORKFLOW_TYPE);
  if (!located) return null;
  if (located.branchIndex === -1) {
    return { stored: located.stored, current: located.stored };
  }

  const evidence = workflowEvidenceAfter(branch, located.branchIndex, located.stored);

  return {
    stored: located.stored,
    current: advanceWorkflowFromEvidence(located.stored, evidence),
  };
}

function refreshWorkflowProgress(ctx: ExtensionContext, workflowOverride?: ReviewWorkflowState | null): void {
  const workflow =
    workflowOverride === undefined ? (workflowBranchContext(ctx.sessionManager)?.current ?? null) : workflowOverride;
  if (!ctx.hasUI) return;

  if (!workflow) {
    ctx.ui.setWidget(PROGRESS_WIDGET, undefined);
    ctx.ui.setStatus(PROGRESS_STATUS, undefined);
    ctx.ui.setWorkingMessage();
    return;
  }

  if (workflow.stage === "completed") {
    ctx.ui.setWidget(PROGRESS_WIDGET, undefined);
    ctx.ui.setWorkingMessage();
    const findings = workflow.findingCount === undefined ? "" : ` · ${workflow.findingCount} findings`;
    ctx.ui.setStatus(PROGRESS_STATUS, `PR #${workflow.pr} recorded${findings}`);
    return;
  }

  ctx.ui.setWidget(PROGRESS_WIDGET, workflowProgressLines(workflow, ctx.getAsyncJobSnapshot()), {
    placement: "aboveEditor",
  });
  if (workflow.stage === "failed") {
    ctx.ui.setWorkingMessage();
    ctx.ui.setStatus(PROGRESS_STATUS, `PR #${workflow.pr} review failed`);
  } else {
    const stage = workflow.stage.replaceAll("_", " ");
    ctx.ui.setWorkingMessage(`PR review: ${stage}`);
    ctx.ui.setStatus(PROGRESS_STATUS, `PR #${workflow.pr} · ${stage}`);
  }
}

function renderRecordCard(lines: string[], theme: Theme, completed: boolean): Text {
  const rendered = lines.map((line, index) => {
    if (index === 0) return theme.fg(completed ? "success" : "toolTitle", theme.bold(line));
    if (index === 1) return theme.fg("muted", line);
    return theme.fg("dim", line);
  });
  return new Text(rendered.join("\n"), 0, 0);
}


// ============================================================================
// PR metadata via gh
// ============================================================================

async function fetchPrMeta(
  pi: PiExec,
  cwd: string,
  pr: string,
): Promise<{ repo: string; pr: number; title: string } | null> {
  const repoRes = await pi.exec("gh", ["repo", "view", "--json", "owner,name"], { cwd, timeout: 30_000 });
  if (repoRes.code !== 0) return null;
  let repo: string;
  try {
    const parsed = JSON.parse(repoRes.stdout) as { owner: { login: string }; name: string };
    repo = `${parsed.owner.login}/${parsed.name}`;
  } catch {
    return null;
  }

  const number = /^\d+$/.test(pr) ? Number(pr) : 0;
  const viewArgs = number ? ["pr", "view", String(number), "--json", "number,title"] : ["pr", "view", "--json", "number,title"];
  const listRes = await pi.exec("gh", viewArgs, {
    cwd,
    timeout: 30_000,
  });
  if (listRes.code !== 0) return null;
  try {
    const parsed = JSON.parse(listRes.stdout) as { number: number; title: string };
    return { repo, pr: parsed.number, title: parsed.title };
  } catch {
    return null;
  }
}


// ============================================================================
// Submission via gh api
// ============================================================================

type PrFile = { filename: string; patch?: string };
type ReviewAuthorship = { reviewerLogin: string; authorLogin: string };

function isPrFile(value: unknown): value is PrFile {
  return (
    value !== null &&
    typeof value === "object" &&
    "filename" in value &&
    typeof value.filename === "string" &&
    (!("patch" in value) || value.patch === undefined || typeof value.patch === "string")
  );
}

async function fetchPrFiles(pi: PiExec, cwd: string, repo: string, pr: number): Promise<PrFile[] | null> {
  const result = await pi.exec(
    "gh",
    ["api", `repos/${repo}/pulls/${pr}/files`, "--paginate", "--slurp"],
    { cwd, timeout: 60_000 },
  );
  if (result.code !== 0) return null;

  try {
    const pages: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(pages) || !pages.every(Array.isArray)) return null;
    const files: unknown[] = pages.flat();
    return files.every(isPrFile) ? files : null;
  } catch {
    return null;
  }
}

async function fetchReviewAuthorship(
  pi: PiExec,
  cwd: string,
  repo: string,
  pr: number,
): Promise<ReviewAuthorship | null> {
  const [owner, name] = repo.split("/", 2);
  if (!owner || !name) return null;

  const query =
    "query($owner:String!,$name:String!,$number:Int!){" +
    "viewer{login} repository(owner:$owner,name:$name){pullRequest(number:$number){author{login}}}}";
  const result = await pi.exec(
    "gh",
    [
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
      "-F",
      `number=${pr}`,
    ],
    { cwd, timeout: 30_000 },
  );
  if (result.code !== 0) return null;

  try {
    const response: unknown = JSON.parse(result.stdout);
    if (!response || typeof response !== "object" || !("data" in response)) return null;
    const data = response.data;
    if (!data || typeof data !== "object" || !("viewer" in data) || !("repository" in data)) return null;
    const viewer = data.viewer;
    const repository = data.repository;
    if (!viewer || typeof viewer !== "object" || !("login" in viewer)) return null;
    if (!repository || typeof repository !== "object" || !("pullRequest" in repository)) return null;
    const pullRequest = repository.pullRequest;
    if (!pullRequest || typeof pullRequest !== "object" || !("author" in pullRequest)) return null;
    const author = pullRequest.author;
    if (!author || typeof author !== "object" || !("login" in author)) return null;
    return typeof viewer.login === "string" && typeof author.login === "string"
      ? { reviewerLogin: viewer.login, authorLogin: author.login }
      : null;
  } catch {
    return null;
  }
}

async function submitReview(
  pi: PiExec,
  cwd: string,
  state: PrReviewState,
  event: ReviewEvent,
  body: string,
  authorship: ReviewAuthorship,
): Promise<{ ok: boolean; message: string }> {
  const { repo, pr } = state;
  const inline = state.findings.filter(finding => finding.flagged && finding.line);
  const validationError = reviewSubmissionError(
    event,
    body,
    inline.length,
    authorship.reviewerLogin,
    authorship.authorLogin,
  );
  if (validationError) return { ok: false, message: validationError };

  if (inline.length > 0) {
    const files = await fetchPrFiles(pi, cwd, repo, pr);
    if (!files) {
      return { ok: false, message: "Could not load the PR patches to validate inline comment locations." };
    }

    const invalid = inline.filter(finding => {
      const patch = files.find(file => file.filename === finding.file)?.patch;
      return !patch || !patchContainsNewLine(patch, finding.line!);
    });
    if (invalid.length > 0) {
      const locations = invalid.map(finding => `${finding.file}:${finding.line}`).join(", ");
      return {
        ok: false,
        message: `These inline locations are not commentable in the current diff: ${locations}. Unflag them or re-record the review with current line numbers.`,
      };
    }
  }

  const plan = buildReviewSubmissionPlan(state, event, body);
  const tempDirectory = await mkdtemp(join(tmpdir(), "omp-pr-review-"));
  const payloadPath = join(tempDirectory, "review.json");

  try {
    await Bun.write(payloadPath, JSON.stringify(plan.create));
    const createResult = await pi.exec(
      "gh",
      ["api", "--method", "POST", `repos/${repo}/pulls/${pr}/reviews`, "--input", payloadPath],
      { cwd, timeout: 60_000 },
    );
    if (createResult.code !== 0) {
      const details = [createResult.stderr.trim(), createResult.stdout.trim()].filter(Boolean).join("\n");
      return { ok: false, message: `GitHub rejected the review: ${details}` };
    }

    if (plan.submit) {
      let reviewId: number;
      try {
        const response: unknown = JSON.parse(createResult.stdout);
        if (!response || typeof response !== "object" || !("id" in response)) {
          throw new Error("missing review id");
        }
        reviewId = Number(response.id);
        if (!Number.isSafeInteger(reviewId) || reviewId <= 0) throw new Error("invalid review id");
      } catch {
        return {
          ok: false,
          message: "GitHub created a pending review but did not return its ID. Check the PR before retrying.",
        };
      }

      await Bun.write(payloadPath, JSON.stringify(plan.submit));
      const submitResult = await pi.exec(
        "gh",
        [
          "api",
          "--method",
          "POST",
          `repos/${repo}/pulls/${pr}/reviews/${reviewId}/events`,
          "--input",
          payloadPath,
        ],
        { cwd, timeout: 60_000 },
      );
      if (submitResult.code !== 0) {
        const cleanupResult = await pi.exec(
          "gh",
          ["api", "--method", "DELETE", `repos/${repo}/pulls/${pr}/reviews/${reviewId}`],
          { cwd, timeout: 30_000 },
        );
        const details = [submitResult.stderr.trim(), submitResult.stdout.trim()].filter(Boolean).join("\n");
        const cleanup =
          cleanupResult.code === 0 ? "" : " The pending review could not be removed; check the PR before retrying.";
        return { ok: false, message: `GitHub rejected the review: ${details}.${cleanup}` };
      }
    }
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }

  return {
    ok: true,
    message: `${reviewEventLabel(event)} review posted on #${pr} with ${inline.length} inline comment(s).`,
  };
}

// ============================================================================
// Summary rendering
// ============================================================================

function renderSummary(
  message: CustomMessage<PrReviewState>,
  _options: { expanded: boolean },
  _theme: Theme,
) {
  const raw = (message.details ?? null) as Partial<PrReviewState> | null;
  const state = raw ? hydrateState(raw) : null;
  if (!state) return new Text("", 1, 0);
  return new Markdown(reviewPresentationText(state, "original"), 1, 0, getMarkdownTheme());
}

async function runReviewViewer(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  stateOverride?: PrReviewState,
): Promise<void> {
  const state = stateOverride ?? stateFromBranch(ctx.sessionManager);
  if (!state || !state.repo || !state.pr) {
    ctx.ui.notify("No recorded review is available. Run /pr-review <n> first.", "warning");
    return;
  }
  if (ctx.mode !== "tui") {
    ctx.ui.notify("The review viewer needs the TUI.", "error");
    return;
  }

  let mode: ReviewPresentationMode = state.presentationMode;
  for (;;) {
    if (mode === "ste" && !state.stePresentation) {
      ctx.ui.notify(
        "This review has no STE-style presentation. Run /pr-review again to generate it.",
        "warning",
      );
      mode = "original";
      state.presentationMode = mode;
      pi.appendEntry(STATE_TYPE, state);
      continue;
    }

    const text = reviewPresentationText(state, mode);
    const action = await ctx.ui.custom<ReviewViewerAction>(
      (tui, theme, _keybindings, done) => new ReviewViewer(tui, theme, mode, text, done),
    );
    if (action.kind === "close") return;

    mode = action.mode;
    state.presentationMode = mode;
    pi.appendEntry(STATE_TYPE, state);
  }
}

// ============================================================================
// Interactive issue loop
// ============================================================================

function rowsFromState(state: PrReviewState) {
  const sorted = [...state.findings].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
  return sorted.map(f => ({
    index: state.findings.indexOf(f),
    severity: f.severity,
    location: f.line ? `${f.file}:${f.line}` : f.file,
    title: f.title,
    flagged: f.flagged,
    noted: f.note.length > 0,
  }));
}

async function runIssuesLoop(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  quickChat: QuickChatRuntime,
): Promise<void> {
  const state = stateFromBranch(ctx.sessionManager);
  if (!state || state.findings.length === 0) {
    ctx.ui.notify("No review in progress. Run /pr-review <n> first.", "warning");
    return;
  }
  if (!ctx.hasUI) {
    ctx.ui.notify("Interactive issue list needs the TUI.", "error");
    return;
  }

  let restoredQuickChat = false;
  if (state.returnModel) {
    const returnModel = ctx.models.resolve(state.returnModel);
    if (returnModel) await pi.setModel(returnModel);
    delete state.returnModel;
    restoredQuickChat = true;
  }
  if (state.returnThinking) {
    pi.setThinkingLevel(state.returnThinking);
    delete state.returnThinking;
    restoredQuickChat = true;
  }
  if (quickChat.activeTools) {
    await pi.setActiveTools(quickChat.activeTools);
    delete quickChat.activeTools;
    restoredQuickChat = true;
  }
  ctx.ui.setWidget("pr-review-chat", undefined);
  if (restoredQuickChat) pi.appendEntry(STATE_TYPE, state);

  for (;;) {
    const rows = rowsFromState(state);
    const flagged = rows.filter(row => row.flagged).length;
    const header = `PR #${state.pr} — ${state.title}  (${flagged}/${rows.length} flagged)`;
    const action = await ctx.ui.custom<IssueListAction>(
      (tui, theme, keybindings, done) => new IssueList(tui, theme, keybindings, rows, header, done),
    );

    if (action.kind === "close") return;

    if (action.kind === "view") {
      await runReviewViewer(pi, ctx, state);
      continue;
    }

    if (action.kind === "toggle-flag") {
      const finding = state.findings[action.index];
      if (finding) finding.flagged = !finding.flagged;
      state.editedBody = "";
    } else if (action.kind === "edit-note") {
      const finding = state.findings[action.index];
      if (!finding) continue;
      const note = await ctx.ui.editor(`Note for: ${finding.title}`, finding.note);
      if (note === undefined) continue;
      finding.note = note.trim();
      state.editedBody = "";
    } else if (action.kind === "overview" || action.kind === "chat" || action.kind === "investigate") {
      const finding = action.kind === "overview" ? undefined : state.findings[action.index];
      if (action.kind !== "overview" && !finding) continue;
      const base = findReviewBaselineId(
        state,
        ctx.sessionManager.getBranch(),
        ctx.sessionManager.getEntries(),
        SUMMARY_TYPE,
        STATE_TYPE,
      );
      if (!base) {
        ctx.ui.notify("No review baseline is available. Re-record the review first.", "warning");
        continue;
      }
      state.baselineId = base;

      const nav = await ctx.navigateTree(base, { summarize: false });
      if (nav.cancelled) continue;

      if (action.kind === "overview" || action.kind === "chat") {
        const currentModel = ctx.models.current();
        if (currentModel) state.returnModel = `${currentModel.provider}/${currentModel.id}`;
        const currentThinking = pi.getThinkingLevel();
        if (currentThinking) state.returnThinking = currentThinking;
        pi.appendEntry(STATE_TYPE, state);

        const chatModel = ctx.models.resolve("@default");
        if (chatModel) await pi.setModel(chatModel);
        pi.setThinkingLevel("low");
        quickChat.activeTools = pi.getActiveTools();
        await pi.setActiveTools([]);

        const overview = action.kind === "overview";
        const subject = overview ? "PR walkthrough and senior-engineering gate" : finding!.title;
        ctx.ui.setWidget(
          "pr-review-chat",
          [`Quick discussion: ${subject}`, "The recorded code evidence is loaded. Run /pr-back to return to the list."],
          { placement: "belowEditor" },
        );

        const context = overview
          ? `${walkthroughText(state)}\n\n${qualityGateText(state)}`
          : findingContextText(finding!);
        const prompt =
          `Have a quick, conversational discussion about this recorded ${overview ? "PR assessment" : "PR finding"}:\n\n` +
          `${context}\n\n` +
          `Start by orienting the user in the relevant code or flow, then answer exactly why the behavior or assessment ` +
          `holds. Whenever you present a code or data flow, render the recorded Mermaid source as a fenced Mermaid ` +
          `block rather than converting it to prose arrows. Use only the recorded review context already provided. Do ` +
          `not call tools, delegate, or start a new investigation. If deeper code research is needed, say what is ` +
          `missing and suggest returning with /pr-back and choosing investigate. The user can continue this discussion, ` +
          `then run /pr-back to return to the list.`;
        pi.sendUserMessage(prompt);
        ctx.ui.notify(`Quick discussion opened for "${subject}".`, "info");
      } else {
        delete state.returnModel;
        delete state.returnThinking;
        pi.appendEntry(STATE_TYPE, state);
        const prompt =
          `Investigate this PR finding deeply:\n\n${findingContextText(finding!)}\n\n` +
          `Delegate exactly one focused pass to the \`issue-digger\` agent. Have it confirm or refute the finding, ` +
          `show the exact relevant code, trace the trigger and data/control flow to the outcome, identify the root ` +
          `cause, and propose a concrete fix with evidence. Report its result conversationally with the code first, ` +
          `then render its \`mermaid\` source as a fenced Mermaid block before explaining the verdict. Do not duplicate ` +
          `its research in the parent session. When done, run /pr-back to return to the list.`;
        pi.sendUserMessage(prompt);
        ctx.ui.notify(`Deep investigation opened for "${finding!.title}".`, "info");
      }
      return;
    } else if (action.kind === "submit") {
      const bodyChoice = await ctx.ui.select(
        "Review body",
        REVIEW_BODY_OPTIONS.map(option => ({ label: option.label, description: option.description })),
        { initialIndex: 0 },
      );
      if (!bodyChoice) continue;

      let body = "";
      if (bodyChoice === "Generate review body") {
        const notes = await ctx.ui.editor("Personal notes for the review (optional)", state.notes);
        if (notes !== undefined && notes.trim() !== state.notes) {
          state.notes = notes.trim();
          state.editedBody = "";
        }
        const generatedBody = state.editedBody || buildReviewBody(state);
        const preview = await ctx.ui.editor("Review body — edit before submission", generatedBody);
        if (preview === undefined) continue;
        state.editedBody = preview.trim();
        body = state.editedBody;
      }

      const authorship = await fetchReviewAuthorship(pi, ctx.cwd, state.repo, state.pr);
      if (!authorship) {
        ctx.ui.notify("Could not verify the PR author and signed-in GitHub reviewer.", "error");
        continue;
      }
      const allowedEvents = allowedReviewEvents(authorship.reviewerLogin, authorship.authorLogin);
      const reviewEvents = REVIEW_EVENTS.filter(option => allowedEvents.includes(option.event));
      const recommended = defaultReviewEvent(state.verdict);
      const recommendedEvent = allowedEvents.includes(recommended) ? recommended : "COMMENT";
      const eventLabel = await ctx.ui.select(
        reviewEvents.length === 1
          ? "Review decision — GitHub only permits comments on your own PR"
          : "Review decision",
        reviewEvents.map(option => ({ label: option.label, description: option.description })),
        { initialIndex: reviewEvents.findIndex(option => option.event === recommendedEvent) },
      );
      if (!eventLabel) continue;
      const event = reviewEvents.find(option => option.label === eventLabel)?.event;
      if (!event) continue;

      const inlineCount = state.findings.filter(finding => finding.flagged && finding.line).length;
      const preflightError = reviewSubmissionError(
        event,
        body,
        inlineCount,
        authorship.reviewerLogin,
        authorship.authorLogin,
      );
      if (preflightError) {
        ctx.ui.notify(preflightError, "warning");
        continue;
      }
      const ok = await ctx.ui.confirm(
        `${reviewEventLabel(event)} on PR #${state.pr}?`,
        `Posts one atomic review with ${inlineCount} inline comment(s) and ${body ? "an overall body" : "no overall body"}. Nothing is submitted if validation fails.`,
      );
      if (!ok) continue;

      const result = await submitReview(pi, ctx.cwd, state, event, body, authorship);
      ctx.ui.notify(result.message, result.ok ? "info" : "error");
      if (result.ok) {
        state.submitted = true;
        pi.appendEntry(STATE_TYPE, state);
        return;
      }
    }

    pi.appendEntry(STATE_TYPE, state);
  }
}

// ============================================================================
// Extension factory
// ============================================================================

export default function (pi: ExtensionAPI): void {
  const quickChat: QuickChatRuntime = {};

  pi.on("tool_call", async (event, ctx) => {
    const branch = workflowBranchContext(ctx.sessionManager);
    if (!branch) return;

    let workflow = branch.current;
    if (workflow !== branch.stored) pi.appendEntry(WORKFLOW_TYPE, workflow);

    const decision = transitionForWorkflowToolCall(workflow, event.toolName, event.input);
    if (!decision.ok) {
      refreshWorkflowProgress(ctx, workflow);
      return { block: true, reason: decision.reason };
    }

    if (decision.workflow !== workflow) {
      workflow =
        event.toolName === "task"
          ? {
              ...decision.workflow,
              activeTaskCallId: event.toolCallId,
              activeAgentId: undefined,
              activeJobId: undefined,
              pendingOutputUri: undefined,
            }
          : decision.workflow;
      pi.appendEntry(WORKFLOW_TYPE, workflow);
    }
    refreshWorkflowProgress(ctx, workflow);
  });

  pi.on("tool_result", async (event, ctx) => {
    const branch = workflowBranchContext(ctx.sessionManager);
    if (!branch) return;

    let workflow = branch.current;
    if (event.toolName === "task") {
      if (event.isError) {
        workflow = failRunningWorkflow(workflow, event.toolName, event.toolCallId);
      } else if (event.toolCallId === workflow.activeTaskCallId) {
        workflow = bindWorkflowTaskLaunch(workflow, event.toolCallId, event.details);
        workflow = advanceWorkflowFromEvidence(workflow, textFromContent(event.content));
      }
    } else if (
      event.toolName === "read" &&
      !event.isError &&
      workflow.pendingOutputUri &&
      event.input.path === `${workflow.pendingOutputUri}:raw`
    ) {
      workflow = advanceWorkflowFromFullOutput(workflow, textFromContent(event.content));
    } else if (event.isError && event.toolName === "pr_review_record" && workflow.stage === "recording") {
      workflow = {
        ...workflow,
        stage: "awaiting_record",
        failure: "pr_review_record failed. Retry the same verified review record.",
      };
    } else if (event.toolName === "hub") {
      const evidence = resultEvidenceForJob(event.details, workflow.activeJobId, event.content);
      if (evidence) workflow = advanceWorkflowFromEvidence(workflow, evidence);
    }

    if (workflow !== branch.stored) pi.appendEntry(WORKFLOW_TYPE, workflow);
    refreshWorkflowProgress(ctx, workflow);
  });

  pi.on("tool_execution_start", async (_event, ctx) => {
    refreshWorkflowProgress(ctx);
  });

  pi.on("tool_execution_update", async (_event, ctx) => {
    refreshWorkflowProgress(ctx);
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    const branch = workflowBranchContext(ctx.sessionManager);
    if (branch && event.toolName === "task" && event.isError) {
      const workflow = failRunningWorkflow(branch.current, event.toolName, event.toolCallId);
      if (workflow !== branch.stored) pi.appendEntry(WORKFLOW_TYPE, workflow);
      refreshWorkflowProgress(ctx, workflow);
      return;
    }
    refreshWorkflowProgress(ctx);
  });

  pi.on("session_start", async (_event, ctx) => {
    refreshWorkflowProgress(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    refreshWorkflowProgress(ctx);
  });

  pi.on("session_stop", async (event, ctx) => {
    if (event.signal.aborted) return;
    const branch = workflowBranchContext(ctx.sessionManager);
    if (!branch) return;
    if (branch.current !== branch.stored) pi.appendEntry(WORKFLOW_TYPE, branch.current);
    refreshWorkflowProgress(ctx, branch.current);
    if (!reviewWorkflowActive(branch.current)) return;
    return {
      continue: true,
      additionalContext: workflowContinuationText(branch.current),
    };
  });

  pi.registerMessageRenderer(SUMMARY_TYPE, renderSummary);

  pi.registerTool({
    name: "pr_review_record",
    label: "Record PR Review",
    strict: true,
    description:
      "Persist a code-backed PR walkthrough, senior-engineering quality gate, and structured findings. " +
      "Call this ONCE after reviewing a pull request. The result powers the interactive /pr-issues " +
      "workflow (inspect code, discuss, investigate, note, flag, and submit).",
    parameters: pi.zod.object({
      repo: pi.zod.string().describe("Repository owner/name, e.g. nate/todd"),
      pr: pi.zod.number().describe("PR number"),
      title: pi.zod.string().describe("PR title"),
      summary: pi.zod.string().describe("Review summary, written in the reviewer's voice exactly as the user wants it"),
      verdict: pi.zod.string().describe("Overall verdict, e.g. approve or changes_requested"),
      ste_presentation: pi.zod.object({
        summary: pi.zod.string().describe("STE-style rewrite of the final review summary"),
        walkthrough: pi.zod.object({
          problem: pi.zod.string().describe("STE-style rewrite of walkthrough.problem"),
          behavior: pi.zod.string().describe("STE-style rewrite of walkthrough.behavior"),
          code_map_roles: pi.zod
            .array(pi.zod.string())
            .describe("STE-style code-map roles in the exact original order"),
          data_flows: pi.zod.array(
            pi.zod.object({
              name: pi.zod.string(),
              steps: pi.zod.array(pi.zod.string()),
            }),
          ),
          blast_radius: pi.zod.string().describe("STE-style rewrite of walkthrough.blast_radius"),
        }),
        quality_gate: pi.zod.object({
          rationale: pi.zod.string().describe("STE-style rewrite of quality_gate.rationale"),
          check_explanations: pi.zod
            .array(pi.zod.string())
            .describe("STE-style check explanations in the exact original order"),
        }),
        findings: pi.zod.array(
          pi.zod.object({
            title: pi.zod.string(),
            issue: pi.zod.string(),
            explanation: pi.zod.string(),
          }),
        ),
      }),
      walkthrough: pi.zod.object({
        problem: pi.zod.string().describe("Problem being solved, who reaches it, and whether it is worth permanent code"),
        behavior: pi.zod.string().describe("What behavior the PR actually changes"),
        code_map: pi.zod.array(
          pi.zod.object({
            file: pi.zod.string(),
            lines: pi.zod.string().describe("Relevant line or range in the PR head, e.g. 42-68"),
            symbol: pi.zod.string().describe("Function, module, class, or other symbol"),
            role: pi.zod.string().describe("Why this location matters to the change"),
          }),
        ),
        data_flows: pi.zod.array(
          pi.zod.object({
            name: pi.zod.string().describe("Short flow name"),
            steps: pi.zod.array(pi.zod.string()).describe("Ordered code/data steps, each naming its relevant symbol"),
          }),
        ),
        mermaid: pi.zod.string().describe(
          "Valid Mermaid source for the PR's code and data flow; no Markdown fences",
        ),
        migration_erd: pi.zod.string().describe(
          "Non-empty valid Mermaid erDiagram source when any database migration changes; empty otherwise",
        ),
        blast_radius: pi.zod.string().describe("Affected callers, state, storage, APIs, jobs, or operational surfaces"),
      }),
      quality_gate: pi.zod.object({
        verdict: pi.zod.string().describe("One of: pass, caution, fail"),
        rationale: pi.zod.string().describe("Bottom-line senior-engineering assessment"),
        checks: pi.zod.array(
          pi.zod.object({
            name: pi.zod.string().describe(
              "One of: problem_value, correctness, scope, complexity, maintainability, technical_debt, production",
            ),
            rating: pi.zod.string().describe("One of: pass, concern, fail, unknown, not_applicable"),
            explanation: pi.zod.string().describe("Evidence-backed reason for the rating"),
          }),
        ),
      }),
      findings: pi.zod
        .array(
          pi.zod.object({
            file: pi.zod.string().describe("File path in the PR diff"),
            line: pi.zod.number().optional().describe("Line number on the new file, when it applies to a specific line"),
            severity: pi.zod.string().describe("One of: blocker, critical, major, minor, nit, style, praise"),
            title: pi.zod.string().describe("Short one-line issue title"),
            issue: pi.zod.string().describe("Full issue description: what is wrong and why it matters"),
            explanation: pi.zod.string().describe(
              "Exact trigger, control/data path, invariant violation, and resulting impact",
            ),
            code_excerpt: pi.zod.string().describe(
              "Small exact excerpt from the PR head with line numbers; enough code to understand the finding",
            ),
          }),
        )
        .describe("Structured findings, most severe first"),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const state: PrReviewState = {
        ...emptyState(),
        repo: params.repo,
        pr: params.pr,
        title: params.title,
        summary: params.summary,
        verdict: params.verdict,
        walkthrough: {
          problem: params.walkthrough.problem,
          behavior: params.walkthrough.behavior,
          codeMap: params.walkthrough.code_map,
          dataFlows: params.walkthrough.data_flows,
          mermaid: params.walkthrough.mermaid,
          migrationErd: params.walkthrough.migration_erd,
          blastRadius: params.walkthrough.blast_radius,
        },
        qualityGate: {
          verdict: params.quality_gate.verdict,
          rationale: params.quality_gate.rationale,
          checks: params.quality_gate.checks,
        },
        findings: normalizeFindings(params.findings),
      };
      state.stePresentation = parseSteReviewPresentation(
        JSON.stringify({
          summary: params.ste_presentation.summary,
          walkthrough: {
            problem: params.ste_presentation.walkthrough.problem,
            behavior: params.ste_presentation.walkthrough.behavior,
            codeMapRoles: params.ste_presentation.walkthrough.code_map_roles,
            dataFlows: params.ste_presentation.walkthrough.data_flows,
            blastRadius: params.ste_presentation.walkthrough.blast_radius,
          },
          qualityGate: {
            rationale: params.ste_presentation.quality_gate.rationale,
            checkExplanations: params.ste_presentation.quality_gate.check_explanations,
          },
          findings: params.ste_presentation.findings,
        }),
        state,
      );
      const details: ReviewRecordDetails = {
        recorded: state.findings.length,
        repo: state.repo,
        pr: state.pr,
        title: state.title,
        verdict: state.verdict,
        qualityGate: state.qualityGate.verdict,
        severityCounts: severityCounts(state.findings),
      };

      // State entry first, then the LLM-visible summary. The summary entry is
      // the baseline leaf for issue diversions; state stays its ancestor, so
      // every discussion fork can recover the original review.
      pi.appendEntry(STATE_TYPE, state);
      pi.sendMessage({
        customType: SUMMARY_TYPE,
        content: fullReviewText(state),
        display: true,
        details: state,
      });

      const workflow = workflowBranchContext(ctx.sessionManager)?.current;
      if (
        workflow?.stage === "recording" &&
        workflow.repo === state.repo &&
        workflow.pr === state.pr &&
        workflow.title === state.title
      ) {
        const completed: ReviewWorkflowState = {
          ...workflow,
          stage: "completed",
          findingCount: state.findings.length,
          failure: undefined,
        };
        pi.appendEntry(WORKFLOW_TYPE, completed);
        refreshWorkflowProgress(ctx, completed);
      }

      if (ctx.mode === "tui") await runReviewViewer(pi, ctx, state);

      return {
        content: [
          {
            type: "text",
            text:
              `Recorded ${state.findings.length} finding(s) for ${state.repo}#${state.pr}. ` +
              "The review viewer opened automatically; /pr-view reopens it and /pr-issues continues the workflow.",
          },
        ],
        details,
      };
    },
    renderCall(params, _options, theme) {
      return renderRecordCard(recordCallCardLines(params), theme, false);
    },
    renderResult(result, options, theme, params) {
      if (options.isPartial) {
        return new Text(theme.fg("warning", "Recording structured PR review..."), 0, 0);
      }
      const details = result.details as ReviewRecordDetails | undefined;
      if (result.isError || !details) {
        const message = textFromContent(result.content) || "The PR review could not be recorded.";
        return new Text(theme.fg("error", message), 0, 0);
      }
      return renderRecordCard(recordResultCardLines(details), theme, true);
    },
  });

  pi.registerCommand("pr-review", {
    description: "Start a PR review: /pr-review [n] (defaults to the current branch's PR)",
    handler: async (args, ctx) => {
      const pr = args.trim() || "head";
      const meta = await fetchPrMeta(pi, ctx.cwd, pr);
      if (!meta) {
        ctx.ui.notify(`Could not resolve PR '${pr}' in this repo. Is there an open PR?`, "error");
        return;
      }
      const workflow = createReviewWorkflow(meta);
      pi.appendEntry(WORKFLOW_TYPE, workflow);
      refreshWorkflowProgress(ctx, workflow);
      const prompt =
        `Review PR #${meta.pr} (${meta.title}) in ${meta.repo}.\n\n` +
        `Orchestrate only; do not review or rewrite the code in this parent session. The extension enforces this sequence.\n` +
        `1. Call \`task\` once with one item whose name is \`PrReviewer\`, whose agent is exactly ` +
        `\`pr-reviewer\`, and whose schemaMode is \`strict\`. Never omit or replace the agent with ` +
        `\`task\`, \`scout\`, or another generic agent. Ask it to review \`pr://${meta.repo}/${meta.pr}\` ` +
        `and \`pr://${meta.repo}/${meta.pr}/diff/all\` per its own instructions and return its structured output. ` +
        `If the custom agent is unavailable, stop with a clear error instead of substituting another agent.\n` +
        `If an agent result contains a \`preview full-output\` URI, call \`read\` on that URI with the \`:raw\` ` +
        `selector before continuing; only the full structured output satisfies the workflow.\n` +
        `2. After that result arrives, call \`task\` once with one item whose name is \`ReviewWriter\`, whose agent ` +
        `is exactly \`review-writer\`, and whose schemaMode is \`strict\`. In that task's \`task\` text, include the ` +
        `entire pr-reviewer structured output verbatim between lines containing exactly ` +
        `\`--- PR_REVIEWER_RESULT_BEGIN ---\` and \`--- PR_REVIEWER_RESULT_END ---\`. Ask the writer only for its ` +
        `structured final summary, verdict, and STE-style presentation; never substitute a generic agent or ask it ` +
        `to research the code.\n` +
        `3. Call \`pr_review_record\` exactly once with repo=${JSON.stringify(meta.repo)}, pr=${meta.pr}, ` +
        `title=${JSON.stringify(meta.title)}, the review-writer summary, verdict, and \`ste_presentation\`, plus the ` +
        `pr-reviewer walkthrough, quality_gate, and findings verbatim.\n` +
        `4. The extension opens the recorded review automatically. Do not restate or duplicate the review after ` +
        `\`pr_review_record\` returns. Tell the user that \`/pr-view\` reopens the viewer and \`/pr-issues\` opens ` +
        `the discussion and submission workflow.`;
      pi.sendUserMessage(prompt);
      ctx.ui.notify(`Reviewing PR #${meta.pr} — ${meta.title}`, "info");
    },
  });

  pi.registerCommand("pr-view", {
    description: "Read the recorded PR review and toggle Original or STE-style prose",
    handler: async (_args, ctx) => {
      await runReviewViewer(pi, ctx);
    },
  });

  pi.registerCommand("pr-issues", {
    description: "Open the interactive PR-issue list (view, flag, note, discuss, investigate, submit)",
    handler: async (_args, ctx) => {
      await runIssuesLoop(pi, ctx, quickChat);
    },
  });

  pi.registerCommand("pr-back", {
    description: "Return from a PR issue discussion to the interactive issue list",
    handler: async (_args, ctx) => {
      await runIssuesLoop(pi, ctx, quickChat);
    },
  });
}
