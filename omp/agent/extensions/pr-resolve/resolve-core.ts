export const RESOLVE_STATUSES = [
  "untriaged",
  "accepted",
  "fixed",
  "verified",
  "disputed",
  "deferred",
  "replied",
  "resolved",
] as const;

export type ResolveStatus = (typeof RESOLVE_STATUSES)[number];
export type FeedbackKind = "thread" | "check";
export type SubmissionMode = "reply" | "reply-and-resolve";
export type ResolveThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "auto";

export interface ReviewThreadComment {
  id: string;
  url: string;
  body: string;
  author: string;
  createdAt: string;
}

export interface RemoteReviewThread {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line?: number;
  originalLine?: number;
  comments: ReviewThreadComment[];
}

export interface RemoteCheck {
  name: string;
  state: string;
  bucket: string;
  link: string;
  workflow: string;
}

export interface ResolveItem {
  id: string;
  kind: FeedbackKind;
  threadId?: string;
  checkName?: string;
  title: string;
  severity: string;
  path: string;
  line?: number;
  url: string;
  body: string;
  author: string;
  comments: ReviewThreadComment[];
  checkState?: string;
  status: ResolveStatus;
  selected: boolean;
  response: string;
  note: string;
  resolution: string;
  evidence: string[];
  verifiedHeadOid?: string;
  replyPosted: boolean;
  postedCommentId?: string;
  serverResolved: boolean;
  outdated: boolean;
}

export interface PrResolveState {
  repo: string;
  pr: number;
  title: string;
  url: string;
  headRefOid: string;
  viewerLogin: string;
  authorLogin: string;
  items: ResolveItem[];
  returnModel?: string;
  returnThinking?: ResolveThinkingLevel;
}

export interface ResolveUpdate {
  status: ResolveStatus;
  response?: string;
  resolution?: string;
  evidence?: string[];
  verifiedHeadOid?: string;
}

const STATUS_ORDER: Record<ResolveStatus, number> = {
  untriaged: 0,
  accepted: 1,
  fixed: 2,
  verified: 3,
  disputed: 4,
  deferred: 5,
  replied: 6,
  resolved: 7,
};
const ACTIONABLE_STATUSES: Partial<Record<ResolveStatus, true>> = {
  accepted: true,
  fixed: true,
  verified: true,
  disputed: true,
  deferred: true,
};
const RESOLVABLE_STATUSES: Partial<Record<ResolveStatus, true>> = {
  verified: true,
  disputed: true,
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function normalizeStatus(value: unknown): ResolveStatus {
  return typeof value === "string" && RESOLVE_STATUSES.includes(value as ResolveStatus)
    ? (value as ResolveStatus)
    : "untriaged";
}

function normalizeComments(value: unknown): ReviewThreadComment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(comment => {
    if (!comment || typeof comment !== "object") return [];
    const raw = comment as Record<string, unknown>;
    const body = stringValue(raw.body);
    if (!body) return [];
    return [
      {
        id: stringValue(raw.id),
        url: stringValue(raw.url),
        body,
        author: stringValue(raw.author),
        createdAt: stringValue(raw.createdAt),
      },
    ];
  });
}

function normalizeItem(value: unknown): ResolveItem | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const id = stringValue(raw.id);
  const kind = raw.kind === "check" ? "check" : raw.kind === "thread" ? "thread" : null;
  if (!id || !kind) return null;

  return {
    id,
    kind,
    threadId: stringValue(raw.threadId) || undefined,
    checkName: stringValue(raw.checkName) || undefined,
    title: stringValue(raw.title) || "Untitled feedback",
    severity: stringValue(raw.severity) || "review",
    path: stringValue(raw.path),
    line: optionalPositiveInteger(raw.line),
    url: stringValue(raw.url),
    body: stringValue(raw.body),
    author: stringValue(raw.author),
    comments: normalizeComments(raw.comments),
    checkState: stringValue(raw.checkState) || undefined,
    status: normalizeStatus(raw.status),
    selected: raw.selected === true,
    response: stringValue(raw.response).trim(),
    note: stringValue(raw.note).trim(),
    resolution: stringValue(raw.resolution).trim(),
    evidence: Array.isArray(raw.evidence)
      ? raw.evidence.flatMap(entry => {
          const evidence = typeof entry === "string" ? entry.trim() : "";
          return evidence ? [evidence] : [];
        })
      : [],
    verifiedHeadOid: stringValue(raw.verifiedHeadOid) || undefined,
    replyPosted: raw.replyPosted === true,
    postedCommentId: stringValue(raw.postedCommentId) || undefined,
    serverResolved: raw.serverResolved === true,
    outdated: raw.outdated === true,
  };
}

export function emptyResolveState(): PrResolveState {
  return {
    repo: "",
    pr: 0,
    title: "",
    url: "",
    headRefOid: "",
    viewerLogin: "",
    authorLogin: "",
    items: [],
  };
}

export function normalizeResolveState(value: unknown): PrResolveState {
  if (!value || typeof value !== "object") return emptyResolveState();
  const raw = value as Record<string, unknown>;
  return {
    repo: stringValue(raw.repo),
    pr: optionalPositiveInteger(raw.pr) ?? 0,
    title: stringValue(raw.title),
    url: stringValue(raw.url),
    headRefOid: stringValue(raw.headRefOid),
    viewerLogin: stringValue(raw.viewerLogin),
    authorLogin: stringValue(raw.authorLogin),
    items: Array.isArray(raw.items) ? raw.items.map(normalizeItem).filter((item): item is ResolveItem => item !== null) : [],
    returnModel: stringValue(raw.returnModel) || undefined,
    returnThinking: normalizeThinkingLevel(raw.returnThinking),
  };
}

function normalizeThinkingLevel(value: unknown): ResolveThinkingLevel | undefined {
  const levels: ResolveThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh", "max", "auto"];
  return typeof value === "string" && levels.includes(value as ResolveThinkingLevel)
    ? (value as ResolveThinkingLevel)
    : undefined;
}

function severityFromBody(body: string): string {
  const match = body.match(/^\s*\[(blocker|critical|major|minor|nit|style|praise)\]\s*/i);
  return match?.[1]?.toLowerCase() ?? "review";
}

function titleFromBody(body: string): string {
  const firstLine = body
    .split("\n")
    .map(line => line.trim())
    .find(Boolean) ?? "Review feedback";
  return firstLine
    .replace(/^\[(blocker|critical|major|minor|nit|style|praise)\]\s*/i, "")
    .replace(/^#+\s*/, "")
    .slice(0, 100);
}

export function itemFromThread(thread: RemoteReviewThread): ResolveItem {
  const root = thread.comments[0];
  const body = root?.body ?? "Review thread without a comment body.";
  return {
    id: `thread:${thread.id}`,
    kind: "thread",
    threadId: thread.id,
    title: titleFromBody(body),
    severity: severityFromBody(body),
    path: thread.path,
    line: thread.line ?? thread.originalLine,
    url: root?.url ?? "",
    body,
    author: root?.author ?? "",
    comments: thread.comments,
    status: thread.isResolved ? "resolved" : "untriaged",
    selected: false,
    response: "",
    note: "",
    resolution: "",
    evidence: [],
    replyPosted: false,
    serverResolved: thread.isResolved,
    outdated: thread.isOutdated,
  };
}

export function itemFromCheck(check: RemoteCheck): ResolveItem {
  const location = check.workflow || "GitHub checks";
  return {
    id: `check:${check.name}:${check.link}`,
    kind: "check",
    checkName: check.name,
    title: `${check.name} failed`,
    severity: "check",
    path: location,
    url: check.link,
    body: `${check.name} is ${check.state} (${check.bucket}).`,
    author: "GitHub Actions",
    comments: [],
    checkState: check.state,
    status: "untriaged",
    selected: false,
    response: "",
    note: "",
    resolution: "",
    evidence: [],
    replyPosted: false,
    serverResolved: false,
    outdated: false,
  };
}

export function exactResponsePosted(item: ResolveItem, viewerLogin: string): ReviewThreadComment | undefined {
  const response = item.response.trim();
  if (!response) return undefined;
  return item.comments.find(comment => comment.author === viewerLogin && comment.body.trim() === response);
}

export function mergeRemoteItems(
  current: ResolveItem[],
  fresh: ResolveItem[],
  viewerLogin: string,
): ResolveItem[] {
  const currentById = new Map(current.map(item => [item.id, item]));
  const merged = fresh.map(remote => {
    const local = currentById.get(remote.id);
    if (!local) return remote;

    const item: ResolveItem = {
      ...remote,
      status: local.status,
      selected: local.selected,
      response: local.response,
      note: local.note,
      resolution: local.resolution,
      evidence: [...local.evidence],
      verifiedHeadOid: local.verifiedHeadOid,
      replyPosted: local.replyPosted,
      postedCommentId: local.postedCommentId,
    };
    if (local.serverResolved && !remote.serverResolved) {
      item.status = "untriaged";
      item.selected = false;
    }

    const existingReply = exactResponsePosted(item, viewerLogin);
    if (existingReply) {
      item.replyPosted = true;
      item.postedCommentId ??= existingReply.id;
    }
    if (remote.serverResolved) {
      item.status = "resolved";
      item.selected = false;
    }
    return item;
  });

  const freshIds = new Set(fresh.map(item => item.id));
  for (const item of current) {
    if (item.kind === "check" && !freshIds.has(item.id)) {
      merged.push({ ...item, status: "resolved", selected: false, serverResolved: true });
    }
  }
  return merged;
}

export function updateResolveItem(item: ResolveItem, update: ResolveUpdate): ResolveItem {
  return {
    ...item,
    status: update.status,
    response: update.response === undefined ? item.response : update.response.trim(),
    resolution: update.resolution === undefined ? item.resolution : update.resolution.trim(),
    evidence:
      update.evidence === undefined
        ? item.evidence
        : update.evidence.map(entry => entry.trim()).filter(Boolean),
    verifiedHeadOid:
      update.status === "verified" || update.status === "disputed"
        ? update.verifiedHeadOid
        : item.verifiedHeadOid,
  };
}

export function resolveStatusRank(status: ResolveStatus): number {
  return STATUS_ORDER[status];
}

export function canResolveItem(item: ResolveItem, headRefOid: string): boolean {
  return (
    item.kind === "thread" &&
    !item.serverResolved &&
    RESOLVABLE_STATUSES[item.status] === true &&
    item.evidence.length > 0 &&
    item.verifiedHeadOid === headRefOid
  );
}

export function selectedThreadItems(state: PrResolveState): ResolveItem[] {
  return state.items.filter(item => item.kind === "thread" && item.selected && !item.serverResolved);
}

export interface SubmissionPreflight {
  problems: string[];
  targets: ResolveItem[];
  resolveCount: number;
}

export function submissionPreflight(
  state: PrResolveState,
  mode: SubmissionMode,
  remoteHeadOid: string,
  localHeadOid: string,
  workingTreeClean: boolean,
): SubmissionPreflight {
  const selected = selectedThreadItems(state);
  const problems: string[] = [];
  const targets = selected.filter(item => !item.replyPosted || (mode === "reply-and-resolve" && canResolveItem(item, remoteHeadOid)));

  if (selected.length === 0) problems.push("Select at least one unresolved review thread.");
  if (selected.length > 0 && targets.length === 0) problems.push("The selected threads have no remaining reply or resolution action.");

  for (const item of selected) {
    if (ACTIONABLE_STATUSES[item.status] !== true && item.status !== "replied") {
      problems.push(`${item.title}: choose a disposition before publishing.`);
    }
    if (!item.response.trim() && !item.replyPosted) {
      problems.push(`${item.title}: add a response before publishing.`);
    }
    if (
      mode === "reply-and-resolve" &&
      RESOLVABLE_STATUSES[item.status] === true &&
      !canResolveItem(item, remoteHeadOid)
    ) {
      problems.push(`${item.title}: verification is not recorded against the current PR head.`);
    }
  }

  const resolveCount = selected.filter(item => canResolveItem(item, remoteHeadOid)).length;
  if (mode === "reply-and-resolve" && resolveCount > 0) {
    if (localHeadOid !== remoteHeadOid) {
      problems.push("The local checkout does not match the current remote PR head; commit and push the fix before resolving threads.");
    }
    if (!workingTreeClean) {
      problems.push("The working tree is not clean; commit and push the verified fix before resolving threads.");
    }
  }

  return { problems: [...new Set(problems)], targets, resolveCount };
}

export function feedbackLocation(item: ResolveItem): string {
  if (item.kind === "check") return item.path;
  return item.line ? `${item.path}:${item.line}` : item.path;
}

export function feedbackContextText(item: ResolveItem): string {
  const lines = [
    `Feedback ID: ${item.id}`,
    `Kind: ${item.kind}`,
    `Status: ${item.status}`,
    `Location: ${feedbackLocation(item)}`,
    `URL: ${item.url || "unavailable"}`,
    "",
  ];
  if (item.comments.length > 0) {
    lines.push("Thread:");
    for (const comment of item.comments) {
      lines.push(`\n${comment.author || "unknown"} (${comment.createdAt || "unknown time"}):\n${comment.body}`);
    }
  } else {
    lines.push(item.body);
  }
  if (item.resolution) lines.push("", `Recorded resolution:\n${item.resolution}`);
  if (item.evidence.length > 0) lines.push("", "Evidence:", ...item.evidence.map(entry => `- ${entry}`));
  if (item.response) lines.push("", `Draft response:\n${item.response}`);
  if (item.note) lines.push("", `Personal note:\n${item.note}`);
  return lines.join("\n");
}

export function resolveOverviewText(state: PrResolveState): string {
  const open = state.items.filter(item => item.status !== "resolved");
  const threads = open.filter(item => item.kind === "thread");
  const checks = open.filter(item => item.kind === "check");
  const counts = new Map<ResolveStatus, number>();
  for (const item of open) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  const statusLine = [...counts.entries()].map(([status, count]) => `${count} ${status}`).join(", ") || "nothing open";
  return [
    `PR #${state.pr} — ${state.title}`,
    `${threads.length} unresolved review thread(s); ${checks.length} failing check(s).`,
    `Queue: ${statusLine}.`,
    `PR head: ${state.headRefOid}`,
  ].join("\n");
}

export function submissionPreview(state: PrResolveState, mode: SubmissionMode): string {
  return selectedThreadItems(state)
    .map(item => {
      const resolution = mode === "reply-and-resolve" && canResolveItem(item, state.headRefOid) ? "reply and resolve" : "reply only";
      const body = item.replyPosted ? "(matching reply already posted)" : item.response;
      return `${feedbackLocation(item)} — ${item.title}\nAction: ${resolution}\n\n${body}`;
    })
    .join("\n\n---\n\n");
}
