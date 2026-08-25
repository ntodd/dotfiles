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
  migrationErd: string;
  blastRadius: string;
}

export function normalizeWalkthrough(value?: Partial<PrWalkthrough>): PrWalkthrough {
  return {
    problem: "",
    behavior: "",
    codeMap: [],
    dataFlows: [],
    mermaid: "",
    migrationErd: "",
    blastRadius: "",
    ...value,
  };
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

export type ReviewPresentationMode = "original" | "ste";

export interface SteDataFlowPresentation {
  name: string;
  steps: string[];
}

export interface SteFindingPresentation {
  title: string;
  issue: string;
  explanation: string;
}

export interface SteReviewPresentation {
  summary: string;
  walkthrough: {
    problem: string;
    behavior: string;
    codeMapRoles: string[];
    dataFlows: SteDataFlowPresentation[];
    blastRadius: string;
  };
  qualityGate: {
    rationale: string;
    checkExplanations: string[];
  };
  findings: SteFindingPresentation[];
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
  stePresentation?: SteReviewPresentation;
  baselineId?: string;
  returnModel?: string;
  returnThinking?: ReviewThinkingLevel;
}
export interface ReviewViewDetails extends PrReviewState {
  viewMode: ReviewPresentationMode;
}

export interface ReviewViewMessage {
  content: "";
  display: true;
  details: ReviewViewDetails;
}


export function emptyState(): PrReviewState {
  return {
    repo: "",
    pr: 0,
    title: "",
    summary: "",
    verdict: "",
    walkthrough: normalizeWalkthrough(),
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
export function buildReviewViewMessage(
  state: PrReviewState,
  viewMode: ReviewPresentationMode,
): ReviewViewMessage {
  if (viewMode === "ste" && !state.stePresentation) {
    throw new Error("The STE-style review has not been generated.");
  }
  return {
    content: "",
    display: true,
    details: { ...state, viewMode },
  };
}


export type ReviewRunMode = "standard" | "fast";

export interface PrReviewCommand {
  pr: string;
  mode: ReviewRunMode;
}

export function parsePrReviewArgs(args: string): PrReviewCommand {
  const tokens = args.trim() ? args.trim().split(/\s+/) : [];
  const fast = tokens.at(-1)?.toLowerCase() === "fast";
  if (fast) tokens.pop();
  if (tokens.length > 1 || tokens.some(token => token.toLowerCase() === "fast")) {
    throw new Error("Usage: /pr-review [n] [fast]");
  }
  return {
    pr: tokens[0] ?? "head",
    mode: fast ? "fast" : "standard",
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

  if (walkthrough.migrationErd && options.includeMermaid !== false) {
    lines.push("- Database ERD:", "```mermaid", walkthrough.migrationErd.trim(), "```");
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

const CODE_LANGUAGE_BY_EXTENSION: Readonly<Record<string, string>> = {
  ".ex": "elixir",
  ".exs": "elixir",
  ".heex": "html",
  ".js": "javascript",
  ".jsx": "jsx",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".py": "python",
  ".rb": "ruby",
  ".rs": "rust",
  ".sh": "bash",
  ".sql": "sql",
  ".yml": "yaml",
  ".yaml": "yaml",
};

function codeLanguage(file: string): string {
  const extensionIndex = file.lastIndexOf(".");
  if (extensionIndex === -1) return "text";
  return CODE_LANGUAGE_BY_EXTENSION[file.slice(extensionIndex).toLowerCase()] ?? "text";
}
function fencedCodeLines(code: string, file: string): string[] {
  const backtickRuns = code.match(/`+/g) ?? [];
  const fenceLength = Math.max(3, ...backtickRuns.map(run => run.length + 1));
  const fence = "`".repeat(fenceLength);
  return [`${fence}${codeLanguage(file)}`, code, fence];
}

interface MarkdownCodeTheme {
  codeBlockBorder(text: string): string;
  highlightCode?: (code: string, language?: string) => string[];
}

export function reviewMarkdownTheme<T extends MarkdownCodeTheme>(
  base: T,
  styleRail: (text: string) => string,
): T {
  const highlightCode = base.highlightCode;
  return {
    ...base,
    codeBlockBorder: text => {
      const language = text.replace(/^`{3,}/, "").trim();
      return styleRail(language ? `┌─ ${language}` : "└─");
    },
    ...(highlightCode
      ? {
          highlightCode: (code: string, language?: string) =>
            highlightCode(code, language).map(line => `${styleRail("│")} ${line}`),
        }
      : {}),
  } as T;
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
    lines.push("Relevant code from the PR head:", ...fencedCodeLines(finding.codeExcerpt, finding.file));
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

export function reviewProseForSimplification(state: PrReviewState): SteReviewPresentation {
  return {
    summary: state.summary,
    walkthrough: {
      problem: state.walkthrough.problem,
      behavior: state.walkthrough.behavior,
      codeMapRoles: state.walkthrough.codeMap.map(entry => entry.role),
      dataFlows: state.walkthrough.dataFlows.map(flow => ({
        name: flow.name,
        steps: [...flow.steps],
      })),
      blastRadius: state.walkthrough.blastRadius,
    },
    qualityGate: {
      rationale: state.qualityGate.rationale,
      checkExplanations: state.qualityGate.checks.map(check => check.explanation),
    },
    findings: state.findings.map(finding => ({
      title: finding.title,
      issue: finding.issue,
      explanation: finding.explanation,
    })),
  };
}


function presentationRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`STE response field '${field}' must be an object.`);
  }
  return value as Record<string, unknown>;
}

function presentationText(value: unknown, source: string, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`STE response field '${field}' must be text.`);
  }
  const text = value.trim();
  if (source.trim() && !text) {
    throw new Error(`STE response field '${field}' cannot be empty.`);
  }
  return text;
}

function presentationArray(value: unknown, expected: number, singular: string): unknown[] {
  if (!Array.isArray(value) || value.length !== expected) {
    const noun = expected === 1 ? singular : `${singular}s`;
    throw new Error(`STE response must contain exactly ${expected} ${noun}.`);
  }
  return value;
}

function jsonResponseText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```") || !trimmed.endsWith("```")) return trimmed;
  const firstLineEnd = trimmed.indexOf("\n");
  if (firstLineEnd === -1) return trimmed;
  return trimmed.slice(firstLineEnd + 1, -3).trim();
}

export function parseSteReviewPresentation(text: string, state: PrReviewState): SteReviewPresentation {
  let value: unknown;
  try {
    value = JSON.parse(jsonResponseText(text));
  } catch {
    throw new Error("STE response must be valid JSON.");
  }

  const source = reviewProseForSimplification(state);
  const root = presentationRecord(value, "root");
  const rawWalkthrough = presentationRecord(root.walkthrough, "walkthrough");
  const rawQualityGate = presentationRecord(root.qualityGate, "qualityGate");
  const rawCodeMapRoles = presentationArray(
    rawWalkthrough.codeMapRoles,
    source.walkthrough.codeMapRoles.length,
    "code-map role",
  );
  const rawDataFlows = presentationArray(
    rawWalkthrough.dataFlows,
    source.walkthrough.dataFlows.length,
    "data flow",
  );
  const rawCheckExplanations = presentationArray(
    rawQualityGate.checkExplanations,
    source.qualityGate.checkExplanations.length,
    "quality-gate explanation",
  );
  const rawFindings = presentationArray(root.findings, source.findings.length, "finding");

  return {
    summary: presentationText(root.summary, source.summary, "summary"),
    walkthrough: {
      problem: presentationText(
        rawWalkthrough.problem,
        source.walkthrough.problem,
        "walkthrough.problem",
      ),
      behavior: presentationText(
        rawWalkthrough.behavior,
        source.walkthrough.behavior,
        "walkthrough.behavior",
      ),
      codeMapRoles: rawCodeMapRoles.map((role, index) =>
        presentationText(role, source.walkthrough.codeMapRoles[index]!, `walkthrough.codeMapRoles[${index}]`),
      ),
      dataFlows: rawDataFlows.map((flow, flowIndex) => {
        const rawFlow = presentationRecord(flow, `walkthrough.dataFlows[${flowIndex}]`);
        const sourceFlow = source.walkthrough.dataFlows[flowIndex]!;
        const rawSteps = presentationArray(
          rawFlow.steps,
          sourceFlow.steps.length,
          `step for data flow ${flowIndex + 1}`,
        );
        return {
          name: presentationText(
            rawFlow.name,
            sourceFlow.name,
            `walkthrough.dataFlows[${flowIndex}].name`,
          ),
          steps: rawSteps.map((step, stepIndex) =>
            presentationText(
              step,
              sourceFlow.steps[stepIndex]!,
              `walkthrough.dataFlows[${flowIndex}].steps[${stepIndex}]`,
            ),
          ),
        };
      }),
      blastRadius: presentationText(
        rawWalkthrough.blastRadius,
        source.walkthrough.blastRadius,
        "walkthrough.blastRadius",
      ),
    },
    qualityGate: {
      rationale: presentationText(
        rawQualityGate.rationale,
        source.qualityGate.rationale,
        "qualityGate.rationale",
      ),
      checkExplanations: rawCheckExplanations.map((explanation, index) =>
        presentationText(
          explanation,
          source.qualityGate.checkExplanations[index]!,
          `qualityGate.checkExplanations[${index}]`,
        ),
      ),
    },
    findings: rawFindings.map((finding, index) => {
      const rawFinding = presentationRecord(finding, `findings[${index}]`);
      const sourceFinding = source.findings[index]!;
      return {
        title: presentationText(rawFinding.title, sourceFinding.title, `findings[${index}].title`),
        issue: presentationText(rawFinding.issue, sourceFinding.issue, `findings[${index}].issue`),
        explanation: presentationText(
          rawFinding.explanation,
          sourceFinding.explanation,
          `findings[${index}].explanation`,
        ),
      };
    }),
  };
}

const STE_SENTENCE_SEGMENTER = new Intl.Segmenter("en", { granularity: "sentence" });

function steSentences(text: string, fallback = "Not established"): string[] {
  const source = text.trim() || fallback;
  const sentences: string[] = [];
  for (const { segment } of STE_SENTENCE_SEGMENTER.segment(source)) {
    const sentence = segment.trim().replace(/\s+/g, " ");
    if (sentence) sentences.push(sentence);
  }
  return sentences.length > 0 ? sentences : [fallback];
}

function appendSteSentences(
  lines: string[],
  label: string,
  text: string,
  indent = "",
): void {
  lines.push(`${indent}${label}:`);
  for (const sentence of steSentences(text)) lines.push(`${indent}- ${sentence}`);
}

function steWalkthroughText(state: PrReviewState, ste: SteReviewPresentation): string {
  const lines = ["PR walkthrough:", ""];
  appendSteSentences(lines, "Problem and reachability", ste.walkthrough.problem);
  lines.push("");
  appendSteSentences(lines, "Actual behavior change", ste.walkthrough.behavior);

  if (state.walkthrough.codeMap.length > 0) {
    lines.push("", "Code map:");
    for (const [index, entry] of state.walkthrough.codeMap.entries()) {
      const location = entry.lines ? `${entry.file}:${entry.lines}` : entry.file;
      const symbol = entry.symbol ? ` \`${entry.symbol}\`` : "";
      lines.push(`- \`${location}\`${symbol}`);
      for (const sentence of steSentences(ste.walkthrough.codeMapRoles[index]!)) {
        lines.push(`  - ${sentence}`);
      }
    }
  }

  if (ste.walkthrough.dataFlows.length > 0) {
    lines.push("", "Data flows:");
    for (const flow of ste.walkthrough.dataFlows) {
      lines.push(`- ${flow.name}`);
      for (const [index, step] of flow.steps.entries()) {
        lines.push(`  ${index + 1}. ${step}`);
      }
    }
  }

  if (state.walkthrough.mermaid) {
    lines.push(
      "",
      "Code and data-flow diagram:",
      "```mermaid",
      state.walkthrough.mermaid.trim(),
      "```",
    );
  }

  if (state.walkthrough.migrationErd) {
    lines.push(
      "",
      "Database ERD:",
      "```mermaid",
      state.walkthrough.migrationErd.trim(),
      "```",
    );
  }

  lines.push("");
  appendSteSentences(lines, "Blast radius", ste.walkthrough.blastRadius);
  return lines.join("\n");
}

function steQualityGateText(state: PrReviewState, ste: SteReviewPresentation): string {
  const verdict = state.qualityGate.verdict ? state.qualityGate.verdict.toUpperCase() : "UNKNOWN";
  const lines = [`Senior-engineering gate: ${verdict}`, ""];
  appendSteSentences(lines, "Rationale", ste.qualityGate.rationale);
  if (state.qualityGate.checks.length > 0) lines.push("", "Checks:");
  for (const [index, check] of state.qualityGate.checks.entries()) {
    lines.push(`- ${check.name.replaceAll("_", " ")} [${check.rating.toUpperCase()}]`);
    for (const sentence of steSentences(ste.qualityGate.checkExplanations[index]!)) {
      lines.push(`  - ${sentence}`);
    }
  }
  return lines.join("\n");
}

function steFindingContextText(
  finding: Finding,
  presentation: SteFindingPresentation,
): string {
  const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
  const lines = [`[${finding.severity}] ${presentation.title}`, `File: ${location}`, ""];
  appendSteSentences(lines, "Issue", presentation.issue);
  if (presentation.explanation) {
    lines.push("");
    appendSteSentences(lines, "Why this occurs", presentation.explanation);
  }
  if (finding.codeExcerpt) {
    lines.push("", "Relevant code from the PR head:", ...fencedCodeLines(finding.codeExcerpt, finding.file));
  }
  return lines.join("\n");
}

export function reviewPresentationText(
  state: PrReviewState,
  mode: ReviewPresentationMode,
  ste: SteReviewPresentation | undefined = state.stePresentation,
): string {
  if (mode === "original") return fullReviewText(state);
  if (!ste) throw new Error("The STE-style review has not been generated.");

  const lines = [
    `PR ${state.repo}#${state.pr}: ${state.title}`,
    "",
    "STE-style reading view",
    "",
    "Summary:",
    ...steSentences(ste.summary).map(sentence => `- ${sentence}`),
  ];
  if (state.verdict) lines.push("", `Verdict: ${state.verdict}`);
  lines.push("", steWalkthroughText(state, ste), "", steQualityGateText(state, ste));
  if (state.findings.length > 0) {
    lines.push("", "Findings:");
    for (const [index, finding] of state.findings.entries()) {
      lines.push("", steFindingContextText(finding, ste.findings[index]!));
    }
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
      ...(comments.length > 0 ? { comments } : {}),
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
