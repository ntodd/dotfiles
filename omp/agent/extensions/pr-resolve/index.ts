// pr-resolve extension — an author-side workflow for handling PR feedback.
//
// Surface:
//   /pr-resolve [n]       load unresolved review threads and failed checks
//   /pr-feedback          reopen the interactive feedback queue
//   /pr-resolve-back      return from a discussion, investigation, fix, or verification
//   pr_resolve_update     persist an item's disposition, fix, response, and evidence

import { Text } from "@oh-my-pi/pi-tui";
import type {
  CustomMessage,
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  Theme,
} from "@oh-my-pi/pi-coding-agent";
import { FeedbackList, type FeedbackListAction } from "./feedback-list.ts";
import {
  RESOLVE_STATUSES,
  canResolveItem,
  feedbackContextText,
  feedbackLocation,
  mergeRemoteItems,
  normalizeResolveState,
  resolveOverviewText,
  resolveStatusRank,
  selectedThreadItems,
  submissionPreflight,
  submissionPreview,
  updateResolveItem,
  type PrResolveState,
  type ResolveItem,
  type ResolveStatus,
  type SubmissionMode,
} from "./resolve-core.ts";
import {
  fetchResolveState,
  replyToThread,
  resolveThread,
  workingTreeSnapshot,
} from "./github.ts";

const STATE_TYPE = "com.nate.pr-resolve.state";
const SUMMARY_TYPE = "com.nate.pr-resolve.summary";
const CHAT_WIDGET = "pr-resolve-chat";
const STATUS_WIDGET = "pr-resolve";

const UPDATEABLE_STATUSES: Partial<Record<ResolveStatus, true>> = {
  untriaged: true,
  accepted: true,
  fixed: true,
  verified: true,
  disputed: true,
  deferred: true,
};

interface SessionEntry {
  type?: string;
  customType?: string;
  data?: unknown;
}

interface QuickChatRuntime {
  activeTools?: string[];
}

function stateFromBranch(sessionManager: { getBranch(leafId?: string | null): unknown[] }): PrResolveState | null {
  const branch = sessionManager.getBranch();
  for (let index = branch.length - 1; index >= 0; index--) {
    const entry = branch[index] as SessionEntry | null;
    if (entry?.type === "custom" && entry.customType === STATE_TYPE && entry.data) {
      const state = normalizeResolveState(entry.data);
      return state.repo && state.pr ? state : null;
    }
  }
  return null;
}

function renderSummary(message: CustomMessage<PrResolveState>, _options: { expanded: boolean }, theme: Theme): Text {
  const state = normalizeResolveState(message.details);
  if (!state.repo || !state.pr) return new Text("", 1, 0);
  const lines = [theme.fg("accent", `PR Resolve — #${state.pr} ${state.title}`), ...resolveOverviewText(state).split("\n").slice(1)];
  const selected = selectedThreadItems(state).length;
  if (selected > 0) lines.push(theme.fg("muted", `${selected} thread(s) selected for publishing.`));
  lines.push("", theme.fg("dim", "Run /pr-feedback to triage, fix, verify, reply, and resolve."));
  return new Text(lines.join("\n"), 1, 0);
}

function refreshStatus(ctx: ExtensionContext, state: PrResolveState | null): void {
  if (!ctx.hasUI) return;
  if (!state) {
    ctx.ui.setStatus(STATUS_WIDGET, undefined);
    return;
  }
  const openThreads = state.items.filter(item => item.kind === "thread" && item.status !== "resolved").length;
  const failedChecks = state.items.filter(item => item.kind === "check" && item.status !== "resolved").length;
  ctx.ui.setStatus(STATUS_WIDGET, `PR #${state.pr} · ${openThreads} threads · ${failedChecks} checks`);
}

function rowsFromState(state: PrResolveState) {
  const ordered = state.items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      if (left.item.status === "resolved" && right.item.status !== "resolved") return 1;
      if (left.item.status !== "resolved" && right.item.status === "resolved") return -1;
      const statusDifference = resolveStatusRank(left.item.status) - resolveStatusRank(right.item.status);
      if (statusDifference !== 0) return statusDifference;
      if (left.item.kind !== right.item.kind) return left.item.kind === "thread" ? -1 : 1;
      return left.item.title.localeCompare(right.item.title);
    });

  return ordered.map(({ item, index }) => ({
    index,
    status: item.status,
    kind: item.kind,
    location: feedbackLocation(item),
    title: item.title,
    selected: item.selected,
    noted: item.note.length > 0,
    outdated: item.outdated,
  }));
}

async function refreshState(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  current: PrResolveState,
): Promise<{ state: PrResolveState; prState: string } | null> {
  const latest = await fetchResolveState(pi, ctx.cwd, String(current.pr));
  if (!latest || latest.state.repo !== current.repo) return null;
  return {
    prState: latest.prState,
    state: {
      ...latest.state,
      items: mergeRemoteItems(current.items, latest.state.items, latest.state.viewerLogin),
      returnModel: current.returnModel,
      returnThinking: current.returnThinking,
    },
  };
}

async function restoreQuickChat(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: PrResolveState,
  quickChat: QuickChatRuntime,
): Promise<void> {
  let restored = false;
  if (state.returnModel) {
    const model = ctx.models.resolve(state.returnModel);
    if (model) await pi.setModel(model);
    delete state.returnModel;
    restored = true;
  }
  if (state.returnThinking) {
    pi.setThinkingLevel(state.returnThinking);
    delete state.returnThinking;
    restored = true;
  }
  if (quickChat.activeTools) {
    await pi.setActiveTools(quickChat.activeTools);
    delete quickChat.activeTools;
    restored = true;
  }
  ctx.ui.setWidget(CHAT_WIDGET, undefined);
  if (restored) pi.appendEntry(STATE_TYPE, state);
}

function itemHeader(state: PrResolveState, item: ResolveItem): string {
  return `PR ${state.repo}#${state.pr} feedback at ${feedbackLocation(item)}`;
}

async function openConversation(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  state: PrResolveState,
  item: ResolveItem | undefined,
  kind: "overview" | "chat" | "investigate" | "fix" | "verify",
  quickChat: QuickChatRuntime,
): Promise<void> {
  pi.appendEntry(STATE_TYPE, state);

  if (kind === "overview" || kind === "chat") {
    const currentModel = ctx.models.current();
    if (currentModel) state.returnModel = `${currentModel.provider}/${currentModel.id}`;
    const currentThinking = pi.getThinkingLevel();
    if (currentThinking) state.returnThinking = currentThinking;
    quickChat.activeTools = pi.getActiveTools();
    pi.appendEntry(STATE_TYPE, state);

    const chatModel = ctx.models.resolve("@default");
    if (chatModel) await pi.setModel(chatModel);
    pi.setThinkingLevel("low");
    await pi.setActiveTools([]);

    const subject = kind === "overview" ? `PR #${state.pr} feedback queue` : item!.title;
    const context = kind === "overview" ? resolveOverviewText(state) : feedbackContextText(item!);
    ctx.ui.setWidget(
      CHAT_WIDGET,
      [`Quick discussion: ${subject}`, "Recorded feedback only. Run /pr-resolve-back to return to the queue."],
      { placement: "belowEditor" },
    );
    pi.sendUserMessage(
      `Discuss this ${kind === "overview" ? "PR feedback queue" : "review thread"} conversationally:\n\n${context}\n\n` +
        "Use only the recorded context above. Do not call tools, edit files, or start a new investigation. If code research is needed, say so and direct the user to /pr-resolve-back and the investigate action.",
    );
    ctx.ui.notify(`Discussion opened for ${subject}.`, "info");
    return;
  }

  if (!item) return;
  const context = feedbackContextText(item);
  if (kind === "investigate") {
    pi.sendUserMessage(
      `Investigate this reviewer claim from ${itemHeader(state, item)}:\n\n${context}\n\n` +
        `Delegate exactly one focused, read-only pass to the \`issue-digger\` agent against ` +
        `\`pr://${state.repo}/${state.pr}\` and \`pr://${state.repo}/${state.pr}/diff/all\`. Treat the comment as a ` +
        "hypothesis. After receiving the result, call `pr_resolve_update` exactly once for this feedback ID. Use status `accepted` when confirmed, `disputed` when refuted, and `untriaged` when inconclusive. For a dispute, include an evidence-backed response draft. Include the investigator's evidence and a concrete resolution when confirmed. Then report the result without duplicating the subagent's research and tell the user to run /pr-resolve-back.",
    );
    ctx.ui.notify(`Investigating ${item.title}.`, "info");
    return;
  }

  if (kind === "fix") {
    pi.sendUserMessage(
      `Fix this PR feedback item:\n\n${context}\n\n` +
        `The recorded remote PR head is ${state.headRefOid}. Before editing, compare it with the local checkout and stop ` +
        "if this is not the matching PR checkout. Fix the root cause with the smallest correct change, update every affected caller, and run focused verification. Do not commit, push, reply on GitHub, or resolve the thread. When finished, call `pr_resolve_update` exactly once with this feedback ID, status `fixed`, a concise response draft, what changed, and the exact verification evidence. Then tell the user to commit and push before using the queue's verify action, and direct them to /pr-resolve-back.",
    );
    ctx.ui.notify(`Fix workflow opened for ${item.title}.`, "info");
    return;
  }

  pi.sendUserMessage(
    `Verify the current resolution of this PR feedback item:\n\n${context}\n\n` +
      `The current recorded remote PR head is ${state.headRefOid}. Do not edit code. Confirm the local checkout is clean and ` +
      "matches the remote PR head, inspect the actual resolution, and run the focused command or scenario that proves the reviewer concern no longer applies. If proven, call `pr_resolve_update` exactly once with this feedback ID, status `verified`, the final concise response, resolution, and exact evidence. If it is not proven, record status `fixed` with the failed or missing evidence instead. Do not post or resolve anything on GitHub. Then direct the user to /pr-resolve-back.",
  );
  ctx.ui.notify(`Verification opened for ${item.title}.`, "info");
}

async function publishSelected(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  current: PrResolveState,
): Promise<PrResolveState> {
  const modeLabel = await ctx.ui.select(
    "Publish selected feedback",
    [
      { label: "Reply only", description: "Post the prepared responses without resolving any threads." },
      {
        label: "Reply and resolve verified",
        description: "Post every prepared response and resolve only evidence-backed items verified at the current PR head.",
      },
    ],
    { initialIndex: 1 },
  );
  if (!modeLabel) return current;
  const mode: SubmissionMode = modeLabel === "Reply only" ? "reply" : "reply-and-resolve";

  const refreshed = await refreshState(pi, ctx, current);
  if (!refreshed) {
    ctx.ui.notify("Could not refresh the PR before publishing. Nothing was posted.", "error");
    return current;
  }
  const state = refreshed.state;
  pi.appendEntry(STATE_TYPE, state);
  refreshStatus(ctx, state);
  if (refreshed.prState !== "OPEN") {
    ctx.ui.notify(`PR #${state.pr} is ${refreshed.prState.toLowerCase()}; nothing was posted.`, "warning");
    return state;
  }

  const checkout = await workingTreeSnapshot(pi, ctx.cwd);
  if (!checkout) {
    ctx.ui.notify("Could not inspect the local Git checkout. Nothing was posted.", "error");
    return state;
  }
  const preflight = submissionPreflight(state, mode, state.headRefOid, checkout.headOid, checkout.clean);
  if (preflight.problems.length > 0) {
    ctx.ui.notify(preflight.problems.join("\n"), "warning");
    return state;
  }

  const preview = submissionPreview(state, mode);
  const confirmed = await ctx.ui.confirm(
    `Publish ${preflight.targets.length} review-thread action(s)?`,
    `${preview}\n\nGitHub writes are checkpointed after each reply and resolution so a retry will not intentionally duplicate completed work.`,
  );
  if (!confirmed) return state;

  for (const target of preflight.targets) {
    const item = state.items.find(candidate => candidate.id === target.id);
    if (!item?.threadId) continue;

    if (!item.replyPosted) {
      const reply = await replyToThread(pi, ctx.cwd, item.threadId, item.response);
      if (!reply.ok) {
        pi.appendEntry(STATE_TYPE, state);
        ctx.ui.notify(`${item.title}: ${reply.message} Refresh before retrying.`, "error");
        return state;
      }
      item.replyPosted = true;
      if (reply.id) item.postedCommentId = reply.id;
      pi.appendEntry(STATE_TYPE, state);
    }

    if (mode === "reply-and-resolve" && canResolveItem(item, state.headRefOid)) {
      const resolution = await resolveThread(pi, ctx.cwd, item.threadId);
      if (!resolution.ok) {
        pi.appendEntry(STATE_TYPE, state);
        ctx.ui.notify(`${item.title}: reply posted, but ${resolution.message} Retry will skip the existing reply.`, "error");
        return state;
      }
      item.status = "resolved";
      item.serverResolved = true;
    }
    item.selected = false;
    pi.appendEntry(STATE_TYPE, state);
  }

  const resolved = preflight.resolveCount;
  ctx.ui.notify(`Published ${preflight.targets.length} response(s) and resolved ${resolved} thread(s).`, "info");
  refreshStatus(ctx, state);
  return state;
}

async function runFeedbackLoop(
  pi: ExtensionAPI,
  ctx: ExtensionCommandContext,
  quickChat: QuickChatRuntime,
): Promise<void> {
  let state = stateFromBranch(ctx.sessionManager);
  if (!state) {
    ctx.ui.notify("No PR resolution is in progress. Run /pr-resolve <n> first.", "warning");
    return;
  }
  if (!ctx.hasUI) {
    ctx.ui.notify("The interactive feedback queue needs the TUI.", "error");
    return;
  }

  await restoreQuickChat(pi, ctx, state, quickChat);
  if (state.items.length === 0) {
    ctx.ui.notify(`PR #${state.pr} has no unresolved review threads or failed checks.`, "info");
    return;
  }

  for (;;) {
    const rows = rowsFromState(state);
    const selected = rows.filter(row => row.selected).length;
    const open = rows.filter(row => row.status !== "resolved").length;
    const header = `PR #${state.pr} — ${state.title}  (${open} open, ${selected} selected)`;
    const action = await ctx.ui.custom<FeedbackListAction>(
      (tui, theme, keybindings, done) => new FeedbackList(tui, theme, keybindings, rows, header, done),
    );

    if (action.kind === "close") return;

    if (action.kind === "toggle-select") {
      const item = state.items[action.index];
      if (!item || item.kind !== "thread" || item.serverResolved) {
        ctx.ui.notify("Only unresolved review threads can be selected for publishing.", "warning");
        continue;
      }
      item.selected = !item.selected;
    } else if (action.kind === "disposition") {
      const item = state.items[action.index];
      if (!item || item.status === "resolved") continue;
      const choice = await ctx.ui.select(
        `Disposition — ${item.title}`,
        [
          { label: "Accept", description: "The feedback is correct and should be fixed." },
          { label: "Dispute", description: "The claim appears incorrect; evidence is still required before resolution." },
          { label: "Defer", description: "Acknowledge it without resolving as part of this PR." },
          { label: "Reset", description: "Return this item to untriaged." },
        ],
      );
      const statusByLabel: Record<string, ResolveStatus> = {
        Accept: "accepted",
        Dispute: "disputed",
        Defer: "deferred",
        Reset: "untriaged",
      };
      if (choice) item.status = statusByLabel[choice] ?? item.status;
      if (choice === "Reset") item.selected = false;
    } else if (action.kind === "edit-response") {
      const item = state.items[action.index];
      if (!item || item.kind !== "thread" || item.serverResolved) continue;
      const response = await ctx.ui.editor(`GitHub response — ${item.title}`, item.response);
      if (response !== undefined) item.response = response.trim();
    } else if (action.kind === "edit-note") {
      const item = state.items[action.index];
      if (!item) continue;
      const note = await ctx.ui.editor(`Personal note — ${item.title}`, item.note);
      if (note !== undefined) item.note = note.trim();
    } else if (action.kind === "refresh") {
      const refreshed = await refreshState(pi, ctx, state);
      if (!refreshed) {
        ctx.ui.notify("Could not refresh feedback from GitHub.", "error");
        continue;
      }
      state = refreshed.state;
      ctx.ui.notify(`Refreshed PR #${state.pr} feedback and checks.`, "info");
      refreshStatus(ctx, state);
    } else if (action.kind === "submit") {
      state = await publishSelected(pi, ctx, state);
    } else {
      const item = action.kind === "overview" ? undefined : state.items[action.index];
      if (action.kind !== "overview" && !item) continue;
      await openConversation(pi, ctx, state, item, action.kind, quickChat);
      return;
    }

    pi.appendEntry(STATE_TYPE, state);
    refreshStatus(ctx, state);
  }
}

export default function (pi: ExtensionAPI): void {
  const quickChat: QuickChatRuntime = {};

  pi.on("session_start", async (_event, ctx) => {
    refreshStatus(ctx, stateFromBranch(ctx.sessionManager));
  });
  pi.on("session_tree", async (_event, ctx) => {
    refreshStatus(ctx, stateFromBranch(ctx.sessionManager));
  });

  pi.registerMessageRenderer(SUMMARY_TYPE, renderSummary);

  pi.registerTool({
    name: "pr_resolve_update",
    label: "Update PR Feedback",
    strict: true,
    description:
      "Persist the disposition, fix, verification evidence, and response draft for one item in the active /pr-resolve workflow.",
    parameters: pi.zod.object({
      item_id: pi.zod.string().describe("Stable feedback ID from the recorded context"),
      status: pi.zod.string().describe(`One of: ${RESOLVE_STATUSES.slice(0, 6).join(", ")}`),
      response: pi.zod.string().optional().describe("Concise GitHub response draft"),
      resolution: pi.zod.string().optional().describe("What changed or why the reviewer claim does not hold"),
      evidence: pi.zod.array(pi.zod.string()).optional().describe("Exact files, commands, outputs, or observations"),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const state = stateFromBranch(ctx.sessionManager);
      if (!state) throw new Error("No PR resolution is active. Run /pr-resolve first.");
      const item = state.items.find(candidate => candidate.id === params.item_id);
      if (!item) throw new Error(`Unknown PR feedback ID: ${params.item_id}`);
      const status = params.status as ResolveStatus;
      if (UPDATEABLE_STATUSES[status] !== true) {
        throw new Error(`Invalid status '${params.status}'. Use one of: ${Object.keys(UPDATEABLE_STATUSES).join(", ")}.`);
      }
      const evidence = params.evidence?.map(entry => entry.trim()).filter(Boolean) ?? [];
      if ((status === "verified" || status === "disputed") && evidence.length === 0) {
        throw new Error(`${status} feedback requires concrete evidence.`);
      }
      if ((status === "verified" || status === "disputed") && !params.response?.trim() && !item.response) {
        throw new Error(`${status} feedback requires a response draft.`);
      }

      let verifiedHeadOid: string | undefined;
      if (status === "verified" || status === "disputed") {
        const checkout = await workingTreeSnapshot(pi, ctx.cwd);
        if (!checkout) throw new Error("Could not bind verification to the local Git commit.");
        verifiedHeadOid = checkout.headOid;
      }
      state.items[state.items.indexOf(item)] = updateResolveItem(item, {
        status,
        response: params.response,
        resolution: params.resolution,
        evidence: params.evidence,
        verifiedHeadOid,
      });
      pi.appendEntry(STATE_TYPE, state);
      refreshStatus(ctx, state);

      return {
        content: [
          {
            type: "text",
            text: `Updated '${item.title}' to ${status}. Run /pr-resolve-back to return to the feedback queue.`,
          },
        ],
        details: { itemId: item.id, title: item.title, status, evidenceCount: evidence.length, verifiedHeadOid },
      };
    },
    renderCall(params, _options, theme) {
      return new Text(theme.fg("toolTitle", `Updating PR feedback: ${params.item_id}`), 0, 0);
    },
    renderResult(result, options, theme) {
      if (options.isPartial) return new Text(theme.fg("warning", "Recording PR feedback update..."), 0, 0);
      if (result.isError) return new Text(theme.fg("error", "PR feedback update failed."), 0, 0);
      const details = result.details as { title?: string; status?: string; evidenceCount?: number } | undefined;
      return new Text(
        theme.fg("success", `${details?.title ?? "Feedback"} — ${details?.status ?? "updated"} (${details?.evidenceCount ?? 0} evidence item(s))`),
        0,
        0,
      );
    },
  });

  pi.registerCommand("pr-resolve", {
    description: "Load and resolve PR feedback: /pr-resolve [n] (defaults to the current branch's PR)",
    handler: async (args, ctx) => {
      const selector = args.trim() || "head";
      const loaded = await fetchResolveState(pi, ctx.cwd, selector);
      if (!loaded) {
        ctx.ui.notify(`Could not load PR '${selector}' and its review feedback. Check gh authentication and the PR number.`, "error");
        return;
      }
      const state = loaded.state;
      pi.appendEntry(STATE_TYPE, state);
      pi.sendMessage({
        customType: SUMMARY_TYPE,
        content: resolveOverviewText(state),
        display: true,
        details: state,
      });
      refreshStatus(ctx, state);
      if (loaded.prState !== "OPEN") {
        ctx.ui.notify(`PR #${state.pr} is ${loaded.prState.toLowerCase()}; publishing will remain disabled.`, "warning");
      }
      await runFeedbackLoop(pi, ctx, quickChat);
    },
  });

  pi.registerCommand("pr-feedback", {
    description: "Open the interactive PR feedback queue",
    handler: async (_args, ctx) => {
      await runFeedbackLoop(pi, ctx, quickChat);
    },
  });

  pi.registerCommand("pr-resolve-back", {
    description: "Return from PR feedback work to the interactive queue",
    handler: async (_args, ctx) => {
      await runFeedbackLoop(pi, ctx, quickChat);
    },
  });
}
