import { createHash } from "node:crypto";

export type ReviewWorkflowStage =
  | "awaiting_reviewer"
  | "reviewer_running"
  | "awaiting_writer"
  | "writer_running"
  | "awaiting_record"
  | "recording"
  | "completed"
  | "failed";

export type ReviewerAgentName = "pr-reviewer" | "pr-reviewer-fast";

export interface ReviewWorkflowState {
  repo: string;
  pr: number;
  title: string;
  stage: ReviewWorkflowStage;
  startedAt: number;
  reviewerAgent?: ReviewerAgentName;
  findingCount?: number;
  reviewerOutputDigest?: string;
  reviewerRecordDigest?: string;
  writerRecordDigest?: string;
  activeTaskCallId?: string;
  activeAgentId?: string;
  activeJobId?: string;
  pendingOutputUri?: string;
  failure?: string;
}

export interface WorkflowDecision {
  ok: boolean;
  workflow: ReviewWorkflowState;
  reason?: string;
}

export interface LocatedReviewWorkflow {
  stored: ReviewWorkflowState;
  branchIndex: number;
}

export interface AsyncJobSummary {
  running: Array<{
    id: string;
    type: string;
    status: string;
    label?: string;
    startTime: number;
  }>;
  recent: Array<{
    id: string;
    type: string;
    status: string;
    label?: string;
    startTime: number;
  }>;
}

export interface ReviewRecordDetails {
  recorded: number;
  repo: string;
  pr: number;
  title: string;
  verdict: string;
  qualityGate: string;
  severityCounts: Record<string, number>;
}

type ReviewTask = {
  name?: unknown;
  agent?: unknown;
  schemaMode?: unknown;
  task?: unknown;
};

const TERMINAL_STAGE: Partial<Record<ReviewWorkflowStage, true>> = { completed: true, failed: true };
const SEVERITY_ORDER = ["blocker", "critical", "major", "minor", "nit", "style", "praise"];
const SAFE_AGENT_ID = /^[A-Za-z0-9_-]+$/;

function reviewerAgentFor(workflow: ReviewWorkflowState): ReviewerAgentName {
  return workflow.reviewerAgent ?? "pr-reviewer";
}

function runningAgentFor(workflow: ReviewWorkflowState): ReviewerAgentName | "review-writer" | null {
  if (workflow.stage === "reviewer_running") return reviewerAgentFor(workflow);
  if (workflow.stage === "writer_running") return "review-writer";
  return null;
}

type WorkflowSessionEntry = {
  type?: string;
  customType?: string;
  id?: string;
  data?: unknown;
  content?: unknown;
  message?: {
    role?: string;
    content?: unknown;
    toolName?: string;
    toolCallId?: string;
    details?: unknown;
  };
  details?: unknown;
};

function workflowEntry(value: unknown, workflowType: string): WorkflowSessionEntry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as WorkflowSessionEntry;
  if (entry.type !== "custom" || entry.customType !== workflowType || !entry.data) return null;
  return entry;
}

function sameWorkflowRun(left: ReviewWorkflowState, right: ReviewWorkflowState): boolean {
  return (
    left.repo === right.repo &&
    left.pr === right.pr &&
    left.title === right.title &&
    left.startedAt === right.startedAt
  );
}

export function findLatestReviewWorkflow(
  branch: unknown[],
  entries: unknown[],
  workflowType: string,
): LocatedReviewWorkflow | null {
  let branchEntry: WorkflowSessionEntry | null = null;
  let branchIndex = -1;
  for (let i = branch.length - 1; i >= 0; i--) {
    const entry = workflowEntry(branch[i], workflowType);
    if (entry) {
      branchEntry = entry;
      branchIndex = i;
      break;
    }
  }
  if (!branchEntry) return null;

  const branchWorkflow = branchEntry.data as ReviewWorkflowState;
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = workflowEntry(entries[i], workflowType);
    if (!entry) continue;
    const candidate = entry.data as ReviewWorkflowState;
    if (!sameWorkflowRun(branchWorkflow, candidate)) continue;
    const entryOnBranch =
      (entry.id !== undefined && entry.id === branchEntry.id) ||
      (entry.id === undefined && entry.data === branchEntry.data);
    return {
      stored: candidate,
      branchIndex: entryOnBranch ? branchIndex : -1,
    };
  }

  return { stored: branchWorkflow, branchIndex };
}

export function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const value of content) {
    if (!value || typeof value !== "object") continue;
    const type = "type" in value ? value.type : undefined;
    const text = "text" in value ? value.text : undefined;
    if (type === "text" && typeof text === "string") parts.push(text);
  }
  return parts.join("\n");
}

interface JobDeliveryMatch {
  job: object;
  jobCount: number;
}

function jobDeliveryMatch(details: unknown, jobId: string | undefined): JobDeliveryMatch | null {
  if (!jobId || !details || typeof details !== "object") return null;
  const jobs = "jobs" in details ? details.jobs : undefined;
  if (!Array.isArray(jobs)) return null;

  let matchingJob: object | null = null;
  let matchingCount = 0;
  for (const value of jobs) {
    if (!value || typeof value !== "object") continue;
    const id = "id" in value ? value.id : undefined;
    const persistedJobId = "jobId" in value ? value.jobId : undefined;
    if (id === jobId || persistedJobId === jobId) {
      matchingJob = value;
      matchingCount += 1;
    }
  }
  if (matchingCount !== 1 || !matchingJob) return null;
  return { job: matchingJob, jobCount: jobs.length };
}

export function resultEvidenceForJob(
  details: unknown,
  jobId: string | undefined,
  fallbackContent: unknown,
): string {
  const match = jobDeliveryMatch(details, jobId);
  if (!match) return "";
  const resultText = "resultText" in match.job ? match.job.resultText : undefined;
  if (typeof resultText === "string") return resultText;
  const errorText = "errorText" in match.job ? match.job.errorText : undefined;
  if (typeof errorText === "string") return errorText;
  return match.jobCount === 1 ? textFromContent(fallbackContent) : "";
}

function batchedAsyncFullOutputEvidence(details: unknown, workflow: ReviewWorkflowState): string {
  const match = jobDeliveryMatch(details, workflow.activeJobId);
  if (!match || match.jobCount <= 1 || !workflow.activeAgentId) return "";
  const resultText = "resultText" in match.job ? match.job.resultText : undefined;
  const errorText = "errorText" in match.job ? match.job.errorText : undefined;
  if (typeof resultText === "string" || typeof errorText === "string") return "";
  const status = "status" in match.job && typeof match.job.status === "string" ? match.job.status : "completed";
  const agent = runningAgentFor(workflow) ?? "review-writer";
  if (status !== "completed") {
    return `<task-result id="${workflow.activeAgentId}" agent="${agent}" status="${status}"></task-result>`;
  }
  return (
    `<task-result id="${workflow.activeAgentId}" agent="${agent}" status="completed">` +
    `<preview full-output="agent://${workflow.activeAgentId}"></preview></task-result>`
  );
}

export function workflowEvidenceAfter(
  branch: unknown[],
  branchIndex: number,
  workflow: ReviewWorkflowState,
): string {
  const evidence: string[] = [];
  for (let i = branchIndex + 1; i < branch.length; i++) {
    const entry = branch[i] as WorkflowSessionEntry | null;
    const message = entry?.message;
    const synchronousTaskResult =
      message?.role === "toolResult" &&
      message.toolName === "task" &&
      message.toolCallId === workflow.activeTaskCallId;
    if (synchronousTaskResult) {
      const text = textFromContent(message.content);
      if (text) evidence.push(text);
      continue;
    }
    if (message?.role === "toolResult" && message.toolName === "hub") {
      const text = resultEvidenceForJob(message.details, workflow.activeJobId, message.content);
      if (text) evidence.push(text);
      continue;
    }
    if (entry?.type === "custom_message" && entry.customType === "async-result") {
      const text =
        resultEvidenceForJob(entry.details, workflow.activeJobId, entry.content) ||
        batchedAsyncFullOutputEvidence(entry.details, workflow);
      if (text) evidence.push(text);
    }
  }
  return evidence.join("\n");
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!value || typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) normalized[key] = canonicalValue(source[key]);
  return normalized;
}

function digestValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalValue(value))).digest("hex");
}

function digestText(value: string): string {
  return createHash("sha256").update(value.replaceAll("\r\n", "\n").trim()).digest("hex");
}

function reviewerContract(output: string): { outputDigest: string; recordDigest: string } | null {
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    if (parsed.walkthrough === undefined || parsed.quality_gate === undefined || parsed.findings === undefined) {
      return null;
    }
    return {
      outputDigest: digestText(output),
      recordDigest: digestValue({
        walkthrough: parsed.walkthrough,
        quality_gate: parsed.quality_gate,
        findings: parsed.findings,
      }),
    };
  } catch {
    return null;
  }
}

function writerContract(output: string): string | null {
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    if (
      parsed.summary === undefined ||
      parsed.verdict === undefined ||
      parsed.ste_presentation === undefined
    ) {
      return null;
    }
    return digestValue({
      summary: parsed.summary,
      verdict: parsed.verdict,
      ste_presentation: parsed.ste_presentation,
    });
  } catch {
    return null;
  }
}

export function createReviewWorkflow(
  meta: { repo: string; pr: number; title: string },
  now = Date.now(),
  reviewerAgent: ReviewerAgentName = "pr-reviewer",
): ReviewWorkflowState {
  return {
    repo: meta.repo,
    pr: meta.pr,
    title: meta.title,
    stage: "awaiting_reviewer",
    startedAt: now,
    reviewerAgent,
  };
}

export function reviewWorkflowActive(workflow: ReviewWorkflowState): boolean {
  return TERMINAL_STAGE[workflow.stage] !== true;
}

function expectedTask(
  workflow: ReviewWorkflowState,
): { name: string; agent: string; next: ReviewWorkflowStage } | null {
  if (workflow.stage === "awaiting_reviewer") {
    return { name: "PrReviewer", agent: reviewerAgentFor(workflow), next: "reviewer_running" };
  }
  if (workflow.stage === "awaiting_writer") {
    return { name: "ReviewWriter", agent: "review-writer", next: "writer_running" };
  }
  return null;
}

function validateTaskInput(
  workflow: ReviewWorkflowState,
  input: Record<string, unknown>,
  expected: { name: string; agent: string; next: ReviewWorkflowStage },
): string | null {
  const tasks = input.tasks;
  if (!Array.isArray(tasks) || tasks.length !== 1) {
    return `The PR workflow requires exactly one ${expected.agent} task at this stage.`;
  }

  const task = tasks[0] as ReviewTask | null;
  if (!task || task.name !== expected.name || task.agent !== expected.agent || task.schemaMode !== "strict") {
    return (
      `Expected task name=${expected.name}, agent=${expected.agent}, schemaMode=strict. ` +
      "Do not substitute a generic agent or change the task contract."
    );
  }

  if (expected.agent === "review-writer") {
    if (!workflow.reviewerOutputDigest || typeof task.task !== "string") {
      return "The ReviewWriter task must contain the completed pr-reviewer output verbatim.";
    }
    const evidence = task.task.match(
      /--- PR_REVIEWER_RESULT_BEGIN ---\r?\n([\s\S]*?)\r?\n--- PR_REVIEWER_RESULT_END ---/,
    );
    if (!evidence?.[1] || digestText(evidence[1]) !== workflow.reviewerOutputDigest) {
      return (
        "The ReviewWriter task must include the exact pr-reviewer output between " +
        "PR_REVIEWER_RESULT_BEGIN and PR_REVIEWER_RESULT_END markers."
      );
    }
  }

  return null;
}

function sameReviewTarget(workflow: ReviewWorkflowState, input: Record<string, unknown>): boolean {
  return input.repo === workflow.repo && input.pr === workflow.pr && input.title === workflow.title;
}

function recordMatchesAgentOutputs(workflow: ReviewWorkflowState, input: Record<string, unknown>): boolean {
  if (!workflow.reviewerRecordDigest || !workflow.writerRecordDigest) return false;
  const reviewerDigest = digestValue({
    walkthrough: input.walkthrough,
    quality_gate: input.quality_gate,
    findings: input.findings,
  });
  const writerDigest = digestValue({
    summary: input.summary,
    verdict: input.verdict,
    ste_presentation: input.ste_presentation,
  });
  return reviewerDigest === workflow.reviewerRecordDigest && writerDigest === workflow.writerRecordDigest;
}

export function transitionForWorkflowToolCall(
  workflow: ReviewWorkflowState,
  toolName: string,
  input: Record<string, unknown>,
): WorkflowDecision {
  if (!reviewWorkflowActive(workflow)) return { ok: true, workflow };

  if (toolName === "task") {
    const expected = expectedTask(workflow);
    if (!expected) {
      return {
        ok: false,
        workflow,
        reason: `The PR workflow is at ${workflow.stage}; another agent task is not allowed yet.`,
      };
    }

    const validationError = validateTaskInput(workflow, input, expected);
    if (validationError) return { ok: false, workflow, reason: validationError };

    return { ok: true, workflow: { ...workflow, stage: expected.next } };
  }

  if (toolName === "pr_review_record") {
    if (workflow.stage !== "awaiting_record") {
      return {
        ok: false,
        workflow,
        reason: "The review cannot be recorded until the review-writer agent has completed successfully.",
      };
    }
    if (!sameReviewTarget(workflow, input)) {
      return {
        ok: false,
        workflow,
        reason: `Record ${workflow.repo}#${workflow.pr} with its exact repository, PR number, and title.`,
      };
    }
    if (!recordMatchesAgentOutputs(workflow, input)) {
      return {
        ok: false,
        workflow,
        reason:
          "pr_review_record must use the reviewer walkthrough, quality gate, and findings plus the writer summary, verdict, and STE presentation verbatim.",
      };
    }
    return { ok: true, workflow: { ...workflow, stage: "recording" } };
  }

  return { ok: true, workflow };
}

export function bindWorkflowTaskLaunch(
  workflow: ReviewWorkflowState,
  toolCallId: string,
  details: unknown,
): ReviewWorkflowState {
  if (
    (workflow.stage !== "reviewer_running" && workflow.stage !== "writer_running") ||
    workflow.activeTaskCallId !== toolCallId
  ) {
    return workflow;
  }

  const expectedAgent = runningAgentFor(workflow);
  if (!expectedAgent) return workflow;
  if (!details || typeof details !== "object") {
    return {
      ...workflow,
      stage: "failed",
      failure: `${expectedAgent} returned no task launch details.`,
    };
  }

  const results = "results" in details ? details.results : undefined;
  if (Array.isArray(results) && results.length > 0) {
    if (results.length !== 1) {
      return {
        ...workflow,
        stage: "failed",
        failure: `${expectedAgent} returned an unexpected synchronous result count.`,
      };
    }
    const result = results[0];
    const validResult =
      result &&
      typeof result === "object" &&
      "agent" in result &&
      result.agent === expectedAgent &&
      "id" in result &&
      typeof result.id === "string" &&
      SAFE_AGENT_ID.test(result.id) &&
      "exitCode" in result &&
      result.exitCode === 0;
    if (!validResult) {
      return {
        ...workflow,
        stage: "failed",
        failure: `The synchronous task did not complete as the expected ${expectedAgent} agent.`,
      };
    }
    return {
      ...workflow,
      activeAgentId: result.id,
      activeJobId: undefined,
    };
  }

  const progress = "progress" in details ? details.progress : undefined;
  if (!Array.isArray(progress) || progress.length !== 1) {
    return {
      ...workflow,
      stage: "failed",
      failure: `${expectedAgent} did not return a single launched-agent record.`,
    };
  }

  const launched = progress[0];
  const validLaunch =
    launched &&
    typeof launched === "object" &&
    "agent" in launched &&
    launched.agent === expectedAgent &&
    "id" in launched &&
    typeof launched.id === "string" &&
    SAFE_AGENT_ID.test(launched.id) &&
    "status" in launched &&
    typeof launched.status === "string";
  if (!validLaunch) {
    return {
      ...workflow,
      stage: "failed",
      failure: `The task launch did not produce the expected ${expectedAgent} agent identity.`,
    };
  }
  if (launched.status === "failed" || launched.status === "aborted") {
    return {
      ...workflow,
      stage: "failed",
      failure: `${expectedAgent} ended with status ${launched.status} during launch.`,
    };
  }

  const asyncDetails = "async" in details ? details.async : undefined;
  const asyncJobId =
    asyncDetails &&
    typeof asyncDetails === "object" &&
    "jobId" in asyncDetails &&
    typeof asyncDetails.jobId === "string"
      ? asyncDetails.jobId
      : undefined;
  if ((launched.status === "pending" || launched.status === "running") && !asyncJobId) {
    return {
      ...workflow,
      stage: "failed",
      failure: `${expectedAgent} returned no synchronous result and registered no async job.`,
    };
  }

  return {
    ...workflow,
    activeAgentId: launched.id,
    activeJobId: asyncJobId,
  };
}

interface AgentTaskResult {
  id: string;
  status: string;
  output?: string;
  fullOutputUri?: string;
}

function taskResult(text: string, agent: string, agentId: string): AgentTaskResult | null {
  for (const match of text.matchAll(/<task-result\b[^>]*>/g)) {
    const tag = match[0];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const agentName = tag.match(/\bagent="([^"]+)"/)?.[1];
    if (id !== agentId || agentName !== agent) continue;
    const status = tag.match(/\bstatus="([^"]+)"/)?.[1];
    if (!status) return null;
    const bodyStart = (match.index ?? 0) + tag.length;
    const bodyEnd = text.indexOf("</task-result>", bodyStart);
    const body = bodyEnd === -1 ? "" : text.slice(bodyStart, bodyEnd);
    const output = body.match(/<output>\s*([\s\S]*?)\s*<\/output>/)?.[1]?.trim();
    const fullOutputUri = body.match(/<preview\b[^>]*\bfull-output="([^"]+)"[^>]*>/)?.[1];
    return { id, status, output, fullOutputUri };
  }
  return null;
}

export function advanceWorkflowFromFullOutput(workflow: ReviewWorkflowState, output: string): ReviewWorkflowState {
  if (workflow.stage === "reviewer_running") {
    const contract = reviewerContract(output);
    if (!contract) {
      return {
        ...workflow,
        stage: "failed",
        failure: `${reviewerAgentFor(workflow)} returned an invalid structured review payload.`,
      };
    }
    return {
      ...workflow,
      stage: "awaiting_writer",
      reviewerOutputDigest: contract.outputDigest,
      reviewerRecordDigest: contract.recordDigest,
      activeTaskCallId: undefined,
      activeAgentId: undefined,
      activeJobId: undefined,
      pendingOutputUri: undefined,
    };
  }

  if (workflow.stage === "writer_running") {
    const recordDigest = writerContract(output);
    if (!recordDigest) {
      return {
        ...workflow,
        stage: "failed",
        failure: "review-writer returned an invalid structured summary or STE presentation payload.",
      };
    }
    return {
      ...workflow,
      stage: "awaiting_record",
      writerRecordDigest: recordDigest,
      activeTaskCallId: undefined,
      activeAgentId: undefined,
      activeJobId: undefined,
      pendingOutputUri: undefined,
    };
  }

  return workflow;
}

export function advanceWorkflowFromEvidence(workflow: ReviewWorkflowState, text: string): ReviewWorkflowState {
  const expectedAgent = runningAgentFor(workflow);
  if (!expectedAgent || !workflow.activeAgentId) return workflow;

  const result = taskResult(text, expectedAgent, workflow.activeAgentId);
  if (!result) return workflow;
  if (result.status !== "completed") {
    return {
      ...workflow,
      stage: "failed",
      failure: `${expectedAgent} ended with status ${result.status}. Run /pr-review again after resolving the agent failure.`,
    };
  }
  if (result.output) return advanceWorkflowFromFullOutput(workflow, result.output);
  if (result.fullOutputUri === `agent://${workflow.activeAgentId}`) {
    return {
      ...workflow,
      pendingOutputUri: result.fullOutputUri,
    };
  }

  return {
    ...workflow,
    stage: "failed",
    failure: `${expectedAgent} completed without a readable structured output payload.`,
  };
}

export function failRunningWorkflow(
  workflow: ReviewWorkflowState,
  toolName: string,
  toolCallId?: string,
): ReviewWorkflowState {
  if (workflow.stage !== "reviewer_running" && workflow.stage !== "writer_running") return workflow;
  if (toolCallId && workflow.activeTaskCallId !== toolCallId) return workflow;
  const agent = runningAgentFor(workflow) ?? "review-writer";
  return {
    ...workflow,
    stage: "failed",
    failure: `${agent} could not be started because the ${toolName} call failed.`,
  };
}

export function workflowContinuationText(workflow: ReviewWorkflowState): string {
  if (workflow.pendingOutputUri) {
    return (
      `The enforced PR review workflow for ${workflow.repo}#${workflow.pr} needs the full structured agent output. ` +
      `Read ${workflow.pendingOutputUri}:raw now, then continue with that exact payload.`
    );
  }
  const reviewerAgent = reviewerAgentFor(workflow);
  const action =
    workflow.stage === "awaiting_reviewer"
      ? `Call the required ${reviewerAgent} task now.`
      : workflow.stage === "reviewer_running"
        ? `Wait for the ${reviewerAgent} result; do not start the writer early.`
        : workflow.stage === "awaiting_writer"
          ? "Call the required review-writer task with the reviewer output now."
          : workflow.stage === "writer_running"
            ? "Wait for the review-writer result; do not record early."
            : workflow.stage === "awaiting_record"
              ? "Call pr_review_record exactly once with the verified reviewer and writer outputs now."
              : workflow.stage === "recording"
                ? "Finish the in-progress pr_review_record call before presenting the review."
                : "";
  return `The enforced PR review workflow for ${workflow.repo}#${workflow.pr} is incomplete. ${action}`;
}

function phaseState(stage: ReviewWorkflowStage, phase: "reviewer" | "writer" | "record"): string {
  const positions: Record<ReviewWorkflowStage, number> = {
    awaiting_reviewer: 0,
    reviewer_running: 0,
    awaiting_writer: 1,
    writer_running: 1,
    awaiting_record: 2,
    recording: 2,
    completed: 3,
    failed: -1,
  };
  const phasePosition = phase === "reviewer" ? 0 : phase === "writer" ? 1 : 2;
  if (stage === "failed") return "failed";
  if (positions[stage] > phasePosition) return "done";
  if (positions[stage] < phasePosition) return "waiting";
  return stage.includes("running") || stage === "recording" ? "running" : "ready";
}

export function workflowProgressLines(
  workflow: ReviewWorkflowState,
  snapshot: AsyncJobSummary | null,
  now = Date.now(),
): string[] {
  const mode = reviewerAgentFor(workflow) === "pr-reviewer-fast" ? " (fast)" : "";
  const lines = [
    `PR review${mode} · ${workflow.repo}#${workflow.pr}`,
    `[${phaseState(workflow.stage, "reviewer")}] Reviewer  [${phaseState(workflow.stage, "writer")}] Writer  [${phaseState(workflow.stage, "record")}] Record`,
  ];

  let expectedLabel: string | null = null;
  if (workflow.stage === "reviewer_running") expectedLabel = "prreviewer";
  if (workflow.stage === "writer_running") expectedLabel = "reviewwriter";
  const taskJob = snapshot?.running.find(job => {
    if (job.type !== "task" || !expectedLabel || !job.label) return false;
    const normalizedLabel = job.label.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
    return normalizedLabel.startsWith(expectedLabel);
  });
  if (taskJob) {
    const elapsedSeconds = Math.max(0, Math.floor((now - taskJob.startTime) / 1000));
    lines.push(`Agent job: ${taskJob.label || taskJob.id} · ${elapsedSeconds}s · ${taskJob.status}`);
  } else if (workflow.pendingOutputUri) {
    lines.push(`Agent output: read ${workflow.pendingOutputUri}:raw`);
  } else if (workflow.stage === "reviewer_running" || workflow.stage === "writer_running") {
    lines.push("Agent job: waiting for async result delivery");
  }

  if (workflow.failure) lines.push(`Failure: ${workflow.failure}`);
  return lines;
}

export function severityCounts(findings: Array<{ severity: string }>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const finding of findings) {
    const severity = finding.severity.toLowerCase();
    counts[severity] = (counts[severity] ?? 0) + 1;
  }
  return counts;
}

export function severitySummary(counts: Record<string, number>): string {
  const parts: string[] = [];
  for (const severity of SEVERITY_ORDER) {
    const count = counts[severity];
    if (count) parts.push(`${count} ${severity}`);
  }
  return parts.length > 0 ? parts.join(" · ") : "no findings";
}

export function recordCallCardLines(input: {
  repo: string;
  pr: number;
  title: string;
  verdict: string;
  quality_gate: { verdict: string };
  findings: Array<{ severity: string }>;
}): string[] {
  return [
    `Record PR review · ${input.repo}#${input.pr}`,
    input.title,
    `${input.verdict} · gate ${input.quality_gate.verdict} · ${severitySummary(severityCounts(input.findings))}`,
  ];
}

export function recordResultCardLines(details: ReviewRecordDetails): string[] {
  return [
    `PR review recorded · ${details.repo}#${details.pr}`,
    details.title,
    `${details.verdict} · gate ${details.qualityGate} · ${severitySummary(details.severityCounts)}`,
    "Open /pr-issues to discuss, investigate, flag, or submit findings.",
  ];
}
