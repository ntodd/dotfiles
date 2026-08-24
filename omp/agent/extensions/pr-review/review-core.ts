export const SEVERITY_ORDER = ["blocker", "critical", "major", "minor", "nit", "style", "praise"] as const;

export type ReviewEvent = "COMMENT" | "REQUEST_CHANGES" | "APPROVE";
export type ReviewThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "auto";
export interface ReviewComment {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
}

export interface CreateReviewPayload {
  body?: string;
  event?: ReviewEvent;
  comments: ReviewComment[];
}

export interface ReviewSubmissionPlan {
  create: CreateReviewPayload;
  submit?: { event: ReviewEvent };
}

export interface CodeMapEntry {
  file: string;
  lines: string;
  symbol: string;
  role: string;
}

export interface DataFlow {
  name: string;
  steps: string[];
}

export interface PrWalkthrough {
  problem: string;
  behavior: string;
  codeMap: CodeMapEntry[];
  dataFlows: DataFlow[];
  mermaid: string;
  blastRadius: string;
}

export interface GateCheck {
  name: string;
  rating: string;
  explanation: string;
}

export interface QualityGate {
  verdict: string;
  rationale: string;
  checks: GateCheck[];
}


export interface Finding {
  file: string;
  line?: number;
  severity: string;
  title: string;
  issue: string;
  explanation: string;
  codeExcerpt: string;
  flagged: boolean;
  note: string;
}

export interface PrReviewState {
  repo: string;
  pr: number;
  title: string;
  summary: string;
  verdict: string;
  walkthrough: PrWalkthrough;
  qualityGate: QualityGate;
  findings: Finding[];
  notes: string;
  editedBody: string;
  submitted: boolean;
  baselineId?: string;
  returnModel?: string;
  returnThinking?: ReviewThinkingLevel;
}

export function emptyState(): PrReviewState {
  return {
    repo: "",
    pr: 0,
    title: "",
    summary: "",
    verdict: "",
    walkthrough: {
      problem: "",
      behavior: "",
      codeMap: [],
      dataFlows: [],
      mermaid: "",
      blastRadius: "",
    },
    qualityGate: {
      verdict: "",
      rationale: "",
      checks: [],
    },
    findings: [],
    notes: "",
    editedBody: "",
    submitted: false,
  };
}

type ReviewSessionEntry = {
  type?: string;
  customType?: string;
  id?: string;
  parentId?: string;
  details?: unknown;
  data?: unknown;
};

function matchesReviewSummary(
  value: unknown,
  state: Pick<PrReviewState, "repo" | "pr" | "title" | "summary" | "verdict">,
  summaryType: string,
): value is ReviewSessionEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as ReviewSessionEntry;
  if (entry.type !== "custom_message" || entry.customType !== summaryType || !entry.id) return false;
  if (!entry.details || typeof entry.details !== "object") return false;
  const details = entry.details as Partial<PrReviewState>;
  return (
    details.repo === state.repo &&
    details.pr === state.pr &&
    details.title === state.title &&
    details.summary === state.summary &&
    details.verdict === state.verdict
  );
}

function matchesReviewState(
  value: unknown,
  state: Pick<PrReviewState, "repo" | "pr" | "title" | "summary" | "verdict">,
  stateType: string,
): value is ReviewSessionEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as ReviewSessionEntry;
  if (entry.type !== "custom" || entry.customType !== stateType || !entry.id) return false;
  if (!entry.data || typeof entry.data !== "object") return false;
  const data = entry.data as Partial<PrReviewState>;
  return (
    data.repo === state.repo &&
    data.pr === state.pr &&
    data.title === state.title &&
    data.summary === state.summary &&
    data.verdict === state.verdict
  );
}

function persistedBaselineId(
  baselineId: string,
  values: unknown[],
  state: Pick<PrReviewState, "repo" | "pr" | "title" | "summary" | "verdict">,
  summaryType: string,
): string | null {
  for (const value of values) {
    const entry = value as ReviewSessionEntry | null;
    if (!entry || entry.id !== baselineId) continue;
    if (entry.type !== "custom_message") return baselineId;
    if (matchesReviewSummary(entry, state, summaryType)) return entry.parentId ?? null;
  }
  return null;
}

function matchingSummaryParentId(
  values: unknown[],
  state: Pick<PrReviewState, "repo" | "pr" | "title" | "summary" | "verdict">,
  summaryType: string,
): string | null {
  for (let i = values.length - 1; i >= 0; i--) {
    const value = values[i];
    if (matchesReviewSummary(value, state, summaryType) && value.parentId) return value.parentId;
  }
  return null;
}

/**
 * Find an entry that can serve as the stable leaf for issue-discussion branches.
 *
 * `navigateTree` treats an ordinary custom message as editable content and
 * lands on its parent. The review summary is therefore not itself a navigable
 * baseline: every discussion becomes its sibling. We persist and return the
 * summary's parent instead, and migrate previously persisted summary IDs.
 * A matching state entry on the active branch is the legacy fallback.
 */
export function findReviewBaselineId(
  state: Pick<PrReviewState, "repo" | "pr" | "title" | "summary" | "verdict" | "baselineId">,
  branch: unknown[],
  entries: unknown[],
  summaryType: string,
  stateType: string,
): string | null {
  if (state.baselineId) {
    const fromBranch = persistedBaselineId(state.baselineId, branch, state, summaryType);
    if (fromBranch) return fromBranch;

    const fromEntries = persistedBaselineId(state.baselineId, entries, state, summaryType);
    if (fromEntries) return fromEntries;
  }

  const branchSummaryParent = matchingSummaryParentId(branch, state, summaryType);
  if (branchSummaryParent) return branchSummaryParent;

  const storedSummaryParent = matchingSummaryParentId(entries, state, summaryType);
  if (storedSummaryParent) return storedSummaryParent;

  for (const value of branch) {
    if (matchesReviewState(value, state, stateType)) return value.id!;
  }

  return null;
}

type RawFinding = {
  file: string;
  severity: string;
  issue: string;
  line?: number;
  explanation?: string;
  code_excerpt?: string;
  codeExcerpt?: string;
  title?: string;
  flagged?: boolean;
  note?: string;
};

function isFinding(value: unknown): value is RawFinding {
  if (!value || typeof value !== "object") return false;
  const finding = value as Record<string, unknown>;
  return (
    typeof finding.file === "string" &&
    typeof finding.severity === "string" &&
    typeof finding.issue === "string"
  );
}

export function normalizeFindings(raw: unknown): Finding[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter(isFinding).map(finding => ({
    file: finding.file,
    line:
      typeof finding.line === "number" && Number.isInteger(finding.line) && finding.line > 0
        ? finding.line
        : undefined,
    severity: finding.severity.toLowerCase(),
    title:
      typeof finding.title === "string" && finding.title.trim()
        ? finding.title.trim()
        : finding.issue.split("\n")[0].slice(0, 80),
    issue: finding.issue,
    explanation: typeof finding.explanation === "string" ? finding.explanation.trim() : "",
    codeExcerpt:
      typeof finding.code_excerpt === "string"
        ? finding.code_excerpt.trim()
        : typeof finding.codeExcerpt === "string"
          ? finding.codeExcerpt.trim()
          : "",
    flagged: finding.flagged === true,
    note: typeof finding.note === "string" ? finding.note.trim() : "",
  }));
}

export function severityRank(severity: string): number {
  const index = SEVERITY_ORDER.indexOf(severity.toLowerCase() as (typeof SEVERITY_ORDER)[number]);
  return index === -1 ? SEVERITY_ORDER.length : index;
}

export function buildReviewBody(state: PrReviewState): string {
  const lines: string[] = [state.summary.trim()];

  if (state.verdict) {
    lines.push("", `**Verdict:** ${state.verdict.replaceAll("_", " ")}`);
  }

  const otherFindings = state.findings.filter(
    finding =>
      !(finding.flagged && finding.line) &&
      finding.severity.toLowerCase() !== "praise",
  );
  if (otherFindings.length > 0) {
    lines.push("", "### Other observations", "");
    for (const finding of otherFindings) {
      const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
      lines.push(`- **[${finding.severity.toUpperCase()}] ${finding.title}** — \`${location}\``);
      lines.push(`  ${finding.issue}`);
      if (finding.explanation) lines.push(`  Why this occurs: ${finding.explanation}`);
      if (finding.note) lines.push(`  Reviewer note: ${finding.note}`);
    }
  }

  const praise = state.findings.filter(finding => finding.severity.toLowerCase() === "praise");
  if (praise.length > 0) {
    lines.push("", "### What looks good", "");
    for (const finding of praise) lines.push(`- ${finding.title}`);
  }

  if (state.notes.trim()) lines.push("", "### Reviewer notes", "", state.notes.trim());

  return `${lines.join("\n").trim()}\n`;
}

export function walkthroughText(
  state: PrReviewState,
  options: { includeMermaid?: boolean } = {},
): string {
  const { walkthrough } = state;
  const lines = [
    "PR walkthrough:",
    `- Problem and reachability: ${walkthrough.problem || "Not established"}`,
    `- Actual behavior change: ${walkthrough.behavior || "Not established"}`,
  ];

  if (walkthrough.codeMap.length > 0) {
    lines.push("- Code map:");
    for (const entry of walkthrough.codeMap) {
      const location = entry.lines ? `${entry.file}:${entry.lines}` : entry.file;
      const symbol = entry.symbol ? ` \`${entry.symbol}\`` : "";
      lines.push(`  - \`${location}\`${symbol} — ${entry.role}`);
    }
  }

  if (walkthrough.mermaid) {
    if (options.includeMermaid !== false) {
      lines.push("- Code and data-flow diagram:", "```mermaid", walkthrough.mermaid.trim(), "```");
    }
  } else if (walkthrough.dataFlows.length > 0) {
    lines.push("- Data flows:");
    for (const flow of walkthrough.dataFlows) {
      lines.push(`  - ${flow.name}: ${flow.steps.join(" → ")}`);
    }
  }

  lines.push(`- Blast radius: ${walkthrough.blastRadius || "Not established"}`);
  return lines.join("\n");
}

export function qualityGateText(state: PrReviewState): string {
  const { qualityGate } = state;
  const verdict = qualityGate.verdict ? qualityGate.verdict.toUpperCase() : "UNKNOWN";
  const lines = [`Senior-engineering gate: ${verdict}`];
  if (qualityGate.rationale) lines.push(`- ${qualityGate.rationale}`);
  for (const check of qualityGate.checks) {
    lines.push(`- ${check.name.replaceAll("_", " ")} [${check.rating.toUpperCase()}]: ${check.explanation}`);
  }
  return lines.join("\n");
}

export function findingContextText(finding: Finding): string {
  const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
  const lines = [
    `[${finding.severity}] ${finding.title}`,
    `File: ${location}`,
    `Issue: ${finding.issue}`,
  ];
  if (finding.explanation) lines.push(`Why this occurs: ${finding.explanation}`);
  if (finding.codeExcerpt) {
    lines.push(
      "Relevant code from the PR head:",
      ...finding.codeExcerpt.split("\n").map(line => `    ${line}`),
    );
  }
  return lines.join("\n");
}

export function fullReviewText(state: PrReviewState): string {
  const lines = [
    `PR ${state.repo}#${state.pr}: ${state.title}`,
    "",
    state.summary.trim(),
    "",
    walkthroughText(state),
    "",
    qualityGateText(state),
  ];
  if (state.verdict) lines.push("", `Verdict: ${state.verdict}`);
  if (state.findings.length > 0) {
    lines.push("", "Findings:");
    for (const finding of state.findings) lines.push("", findingContextText(finding));
  }
  return lines.join("\n");
}

export function inlineCommentBody(finding: Finding): string {
  const lines = [`[${finding.severity.toUpperCase()}] ${finding.title}`, "", finding.issue];
  if (finding.explanation) lines.push("", `Why this occurs: ${finding.explanation}`);
  if (finding.note) lines.push("", `Reviewer note: ${finding.note}`);
  return lines.join("\n");
}

export function allowedReviewEvents(reviewerLogin?: string, authorLogin?: string): ReviewEvent[] {
  const ownPullRequest =
    reviewerLogin !== undefined &&
    authorLogin !== undefined &&
    reviewerLogin.toLowerCase() === authorLogin.toLowerCase();
  return ownPullRequest ? ["COMMENT"] : ["COMMENT", "REQUEST_CHANGES", "APPROVE"];
}

export function reviewSubmissionError(
  event: ReviewEvent,
  body: string,
  inlineCount: number,
  reviewerLogin?: string,
  authorLogin?: string,
): string | null {
  if (!allowedReviewEvents(reviewerLogin, authorLogin).includes(event)) {
    return "GitHub only allows comment reviews on your own pull requests. Choose Comment instead.";
  }
  if (event !== "APPROVE" && !body.trim() && inlineCount === 0) {
    return "A comment or change-request review needs at least one inline comment or a generated body.";
  }
  return null;
}

export function buildReviewSubmissionPlan(
  state: PrReviewState,
  event: ReviewEvent,
  body: string,
): ReviewSubmissionPlan {
  const comments = state.findings
    .filter(finding => finding.flagged && finding.line)
    .map(finding => ({
      path: finding.file,
      line: finding.line!,
      side: "RIGHT" as const,
      body: inlineCommentBody(finding),
    }));
  const reviewBody = body.trim();

  if (!reviewBody && event !== "APPROVE") {
    return {
      create: { comments },
      submit: { event },
    };
  }

  return {
    create: {
      ...(reviewBody ? { body: reviewBody } : {}),
      event,
      comments,
    },
  };
}

export function patchContainsNewLine(patch: string, targetLine: number): boolean {
  let newLine = 0;
  let inHunk = false;

  for (const line of patch.split("\n")) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      newLine = Number(hunk[1]);
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;

    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (newLine === targetLine) return true;
      newLine += 1;
    } else if (line.startsWith(" ")) {
      if (newLine === targetLine) return true;
      newLine += 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      continue;
    }
  }

  return false;
}

export function defaultReviewEvent(verdict: string): ReviewEvent {
  if (verdict === "changes_requested") return "REQUEST_CHANGES";
  if (verdict === "approve") return "APPROVE";
  return "COMMENT";
}

export function reviewEventLabel(event: ReviewEvent): string {
  if (event === "REQUEST_CHANGES") return "Request changes";
  if (event === "APPROVE") return "Approve";
  return "Comment";
}
