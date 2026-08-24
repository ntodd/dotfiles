import type { ExecOptions, ExecResult } from "@oh-my-pi/pi-coding-agent";
import {
  itemFromCheck,
  itemFromThread,
  type PrResolveState,
  type RemoteCheck,
  type RemoteReviewThread,
  type ReviewThreadComment,
} from "./resolve-core.ts";

export interface PiExec {
  exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;
}

export interface PrMeta {
  repo: string;
  pr: number;
  title: string;
  url: string;
  headRefOid: string;
  authorLogin: string;
  state: string;
}

export interface WorkingTreeSnapshot {
  headOid: string;
  clean: boolean;
}

export interface GitHubMutationResult {
  ok: boolean;
  message: string;
  id?: string;
}

interface RawPageInfo {
  hasNextPage?: boolean;
  endCursor?: string | null;
}

interface RawCommentConnection {
  nodes?: unknown[];
  pageInfo?: RawPageInfo;
}

interface RawThreadConnection {
  nodes?: unknown[];
  pageInfo?: RawPageInfo;
}

const THREADS_QUERY =
  "query($owner:String!,$name:String!,$number:Int!,$after:String){" +
  "viewer{login} repository(owner:$owner,name:$name){pullRequest(number:$number){" +
  "number title url state headRefOid author{login} " +
  "reviewThreads(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{" +
  "id isResolved isOutdated path line originalLine comments(first:100){" +
  "pageInfo{hasNextPage endCursor} nodes{id url body createdAt author{login}}}}}}}}";

const COMMENTS_QUERY =
  "query($threadId:ID!,$after:String){node(id:$threadId){... on PullRequestReviewThread{" +
  "comments(first:100,after:$after){pageInfo{hasNextPage endCursor} nodes{id url body createdAt author{login}}}}}}";

const REPLY_MUTATION =
  "mutation($threadId:ID!,$body:String!){addPullRequestReviewThreadReply(" +
  "input:{pullRequestReviewThreadId:$threadId,body:$body}){comment{id url}}}";

const RESOLVE_MUTATION =
  "mutation($threadId:ID!){resolveReviewThread(input:{threadId:$threadId}){thread{id isResolved}}}";

function resultDetails(result: ExecResult): string {
  return [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
}

function parseJson(stdout: string): unknown | null {
  try {
    return JSON.parse(stdout) as unknown;
  } catch {
    return null;
  }
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function positiveLine(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function parseComment(value: unknown): ReviewThreadComment | null {
  const raw = recordValue(value);
  if (!raw) return null;
  const body = stringValue(raw.body);
  const id = stringValue(raw.id);
  if (!id || !body) return null;
  const author = recordValue(raw.author);
  return {
    id,
    url: stringValue(raw.url),
    body,
    author: stringValue(author?.login),
    createdAt: stringValue(raw.createdAt),
  };
}

function parseComments(connection: RawCommentConnection | undefined): ReviewThreadComment[] {
  return Array.isArray(connection?.nodes)
    ? connection.nodes.map(parseComment).filter((comment): comment is ReviewThreadComment => comment !== null)
    : [];
}

function connectionPageInfo(value: unknown): RawPageInfo {
  const raw = recordValue(value);
  return {
    hasNextPage: booleanValue(raw?.hasNextPage),
    endCursor: stringValue(raw?.endCursor) || null,
  };
}

function parseThread(value: unknown): { thread: RemoteReviewThread; commentsPage: RawPageInfo } | null {
  const raw = recordValue(value);
  if (!raw) return null;
  const id = stringValue(raw.id);
  const path = stringValue(raw.path);
  const commentsConnection = recordValue(raw.comments) as RawCommentConnection | null;
  if (!id || !path || !commentsConnection) return null;
  return {
    thread: {
      id,
      isResolved: booleanValue(raw.isResolved),
      isOutdated: booleanValue(raw.isOutdated),
      path,
      line: positiveLine(raw.line),
      originalLine: positiveLine(raw.originalLine),
      comments: parseComments(commentsConnection),
    },
    commentsPage: connectionPageInfo(commentsConnection.pageInfo),
  };
}

function splitRepo(repo: string): [string, string] | null {
  const [owner, name, extra] = repo.split("/");
  return owner && name && !extra ? [owner, name] : null;
}

export async function fetchPrMeta(pi: PiExec, cwd: string, selector: string): Promise<PrMeta | null> {
  const repoResult = await pi.exec("gh", ["repo", "view", "--json", "nameWithOwner"], { cwd, timeout: 30_000 });
  if (repoResult.code !== 0) return null;
  const repoJson = recordValue(parseJson(repoResult.stdout));
  const repo = stringValue(repoJson?.nameWithOwner);
  if (!splitRepo(repo)) return null;

  const viewArgs = ["pr", "view"];
  if (/^\d+$/.test(selector)) viewArgs.push(selector);
  viewArgs.push("--json", "number,title,url,headRefOid,author,state");
  const prResult = await pi.exec("gh", viewArgs, { cwd, timeout: 30_000 });
  if (prResult.code !== 0) return null;
  const prJson = recordValue(parseJson(prResult.stdout));
  const author = recordValue(prJson?.author);
  const pr = prJson?.number;
  if (typeof pr !== "number" || !Number.isInteger(pr) || pr <= 0) return null;
  return {
    repo,
    pr,
    title: stringValue(prJson?.title),
    url: stringValue(prJson?.url),
    headRefOid: stringValue(prJson?.headRefOid),
    authorLogin: stringValue(author?.login),
    state: stringValue(prJson?.state),
  };
}

async function fetchAdditionalComments(
  pi: PiExec,
  cwd: string,
  threadId: string,
  firstPage: RawPageInfo,
): Promise<ReviewThreadComment[] | null> {
  const comments: ReviewThreadComment[] = [];
  let page = firstPage;
  while (page.hasNextPage && page.endCursor) {
    const result = await pi.exec(
      "gh",
      [
        "api",
        "graphql",
        "-f",
        `query=${COMMENTS_QUERY}`,
        "-f",
        `threadId=${threadId}`,
        "-f",
        `after=${page.endCursor}`,
      ],
      { cwd, timeout: 30_000 },
    );
    if (result.code !== 0) return null;
    const response = recordValue(parseJson(result.stdout));
    const data = recordValue(response?.data);
    const node = recordValue(data?.node);
    const connection = recordValue(node?.comments) as RawCommentConnection | null;
    if (!connection) return null;
    comments.push(...parseComments(connection));
    page = connectionPageInfo(connection.pageInfo);
  }
  return comments;
}

interface ThreadFetchResult {
  meta: PrMeta;
  viewerLogin: string;
  threads: RemoteReviewThread[];
}

async function fetchThreads(pi: PiExec, cwd: string, meta: PrMeta): Promise<ThreadFetchResult | null> {
  const repoParts = splitRepo(meta.repo);
  if (!repoParts) return null;
  const [owner, name] = repoParts;
  const threads: RemoteReviewThread[] = [];
  let viewerLogin = "";
  let currentMeta = meta;
  let after: string | null = null;

  for (;;) {
    const args = [
      "api",
      "graphql",
      "-f",
      `query=${THREADS_QUERY}`,
      "-f",
      `owner=${owner}`,
      "-f",
      `name=${name}`,
      "-F",
      `number=${meta.pr}`,
    ];
    if (after) args.push("-f", `after=${after}`);
    const result = await pi.exec("gh", args, { cwd, timeout: 60_000 });
    if (result.code !== 0) return null;

    const response = recordValue(parseJson(result.stdout));
    const data = recordValue(response?.data);
    const viewer = recordValue(data?.viewer);
    const repository = recordValue(data?.repository);
    const pullRequest = recordValue(repository?.pullRequest);
    const connection = recordValue(pullRequest?.reviewThreads) as RawThreadConnection | null;
    if (!pullRequest || !connection || !Array.isArray(connection.nodes)) return null;

    viewerLogin = stringValue(viewer?.login);
    const author = recordValue(pullRequest.author);
    currentMeta = {
      ...currentMeta,
      title: stringValue(pullRequest.title) || currentMeta.title,
      url: stringValue(pullRequest.url) || currentMeta.url,
      headRefOid: stringValue(pullRequest.headRefOid) || currentMeta.headRefOid,
      authorLogin: stringValue(author?.login) || currentMeta.authorLogin,
      state: stringValue(pullRequest.state) || currentMeta.state,
    };

    for (const node of connection.nodes) {
      const parsed = parseThread(node);
      if (!parsed) return null;
      if (parsed.commentsPage.hasNextPage) {
        const additional = await fetchAdditionalComments(pi, cwd, parsed.thread.id, parsed.commentsPage);
        if (!additional) return null;
        parsed.thread.comments.push(...additional);
      }
      threads.push(parsed.thread);
    }

    const page = connectionPageInfo(connection.pageInfo);
    if (!page.hasNextPage) break;
    if (!page.endCursor) return null;
    after = page.endCursor;
  }

  return { meta: currentMeta, viewerLogin, threads };
}

async function fetchFailedChecks(pi: PiExec, cwd: string, pr: number): Promise<RemoteCheck[] | null> {
  const result = await pi.exec(
    "gh",
    ["pr", "checks", String(pr), "--json", "name,state,bucket,link,workflow"],
    { cwd, timeout: 60_000 },
  );
  const parsed = parseJson(result.stdout);
  if (!Array.isArray(parsed)) {
    const noChecks = result.stderr.toLowerCase().includes("no checks reported");
    return result.code === 0 || noChecks ? [] : null;
  }

  return parsed.flatMap(value => {
    const raw = recordValue(value);
    if (!raw) return [];
    const bucket = stringValue(raw.bucket).toLowerCase();
    if (bucket !== "fail" && bucket !== "cancel") return [];
    const name = stringValue(raw.name);
    if (!name) return [];
    return [
      {
        name,
        state: stringValue(raw.state),
        bucket,
        link: stringValue(raw.link),
        workflow: stringValue(raw.workflow),
      },
    ];
  });
}

export async function fetchResolveState(
  pi: PiExec,
  cwd: string,
  selector: string,
): Promise<{ state: PrResolveState; prState: string } | null> {
  const meta = await fetchPrMeta(pi, cwd, selector);
  if (!meta) return null;
  const [threadResult, checks] = await Promise.all([
    fetchThreads(pi, cwd, meta),
    fetchFailedChecks(pi, cwd, meta.pr),
  ]);
  if (!threadResult || !checks) return null;

  return {
    prState: threadResult.meta.state,
    state: {
      repo: threadResult.meta.repo,
      pr: threadResult.meta.pr,
      title: threadResult.meta.title,
      url: threadResult.meta.url,
      headRefOid: threadResult.meta.headRefOid,
      viewerLogin: threadResult.viewerLogin,
      authorLogin: threadResult.meta.authorLogin,
      items: [...threadResult.threads.map(itemFromThread), ...checks.map(itemFromCheck)],
    },
  };
}

export async function workingTreeSnapshot(pi: PiExec, cwd: string): Promise<WorkingTreeSnapshot | null> {
  const [headResult, statusResult] = await Promise.all([
    pi.exec("git", ["rev-parse", "HEAD"], { cwd, timeout: 30_000 }),
    pi.exec("git", ["status", "--porcelain"], { cwd, timeout: 30_000 }),
  ]);
  if (headResult.code !== 0 || statusResult.code !== 0) return null;
  return { headOid: headResult.stdout.trim(), clean: statusResult.stdout.trim().length === 0 };
}

export async function replyToThread(
  pi: PiExec,
  cwd: string,
  threadId: string,
  body: string,
): Promise<GitHubMutationResult> {
  const result = await pi.exec(
    "gh",
    [
      "api",
      "graphql",
      "-f",
      `query=${REPLY_MUTATION}`,
      "-f",
      `threadId=${threadId}`,
      "-f",
      `body=${body}`,
    ],
    { cwd, timeout: 60_000 },
  );
  if (result.code !== 0) return { ok: false, message: resultDetails(result) || "GitHub rejected the reply." };
  const response = recordValue(parseJson(result.stdout));
  const data = recordValue(response?.data);
  const payload = recordValue(data?.addPullRequestReviewThreadReply);
  const comment = recordValue(payload?.comment);
  const id = stringValue(comment?.id);
  return id
    ? { ok: true, id, message: "Reply posted." }
    : { ok: false, message: "GitHub returned no comment after posting the reply; refresh before retrying." };
}

export async function resolveThread(
  pi: PiExec,
  cwd: string,
  threadId: string,
): Promise<GitHubMutationResult> {
  const result = await pi.exec(
    "gh",
    ["api", "graphql", "-f", `query=${RESOLVE_MUTATION}`, "-f", `threadId=${threadId}`],
    { cwd, timeout: 60_000 },
  );
  if (result.code !== 0) return { ok: false, message: resultDetails(result) || "GitHub rejected the resolution." };
  const response = recordValue(parseJson(result.stdout));
  const data = recordValue(response?.data);
  const payload = recordValue(data?.resolveReviewThread);
  const thread = recordValue(payload?.thread);
  return stringValue(thread?.id) && booleanValue(thread?.isResolved)
    ? { ok: true, id: stringValue(thread?.id), message: "Thread resolved." }
    : { ok: false, message: "GitHub did not confirm that the thread was resolved." };
}
