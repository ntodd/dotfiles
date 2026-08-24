import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canResolveItem,
  exactResponsePosted,
  itemFromCheck,
  itemFromThread,
  mergeRemoteItems,
  normalizeResolveState,
  submissionPreflight,
  updateResolveItem,
  type PrResolveState,
  type RemoteReviewThread,
  type ResolveItem,
} from "./resolve-core.ts";

function reviewThread(overrides: Partial<RemoteReviewThread> = {}): RemoteReviewThread {
  return {
    id: "PRRT_1",
    isResolved: false,
    isOutdated: false,
    path: "lib/example.ex",
    line: 42,
    originalLine: 40,
    comments: [
      {
        id: "PRRC_1",
        url: "https://github.test/thread/1",
        body: "[MAJOR] Preserve the existing invariant\n\nThe new branch skips validation.",
        author: "reviewer",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ],
    ...overrides,
  };
}

function resolveItem(overrides: Partial<ResolveItem> = {}): ResolveItem {
  return {
    ...itemFromThread(reviewThread()),
    ...overrides,
  };
}

function resolveState(items: ResolveItem[]): PrResolveState {
  return {
    repo: "owner/repo",
    pr: 42,
    title: "Keep the invariant",
    url: "https://github.test/owner/repo/pull/42",
    headRefOid: "head-1",
    viewerLogin: "author",
    authorLogin: "author",
    items,
  };
}

describe("itemFromThread", () => {
  it("derives stable review metadata from the root comment", () => {
    const item = itemFromThread(reviewThread());

    assert.equal(item.id, "thread:PRRT_1");
    assert.equal(item.title, "Preserve the existing invariant");
    assert.equal(item.severity, "major");
    assert.equal(item.path, "lib/example.ex");
    assert.equal(item.line, 42);
    assert.equal(item.status, "untriaged");
  });

  it("uses the original line and marks server-resolved threads", () => {
    const item = itemFromThread(reviewThread({ line: undefined, isResolved: true }));

    assert.equal(item.line, 40);
    assert.equal(item.status, "resolved");
    assert.equal(item.serverResolved, true);
  });
});

describe("normalizeResolveState", () => {
  it("preserves durable workflow fields and drops malformed items", () => {
    const normalized = normalizeResolveState({
      ...resolveState([]),
      items: [
        {
          ...resolveItem(),
          status: "verified",
          response: "  Fixed in the latest commit.  ",
          evidence: ["  mix test test/example_test.exs  ", ""],
        },
        { id: "bad", kind: "unknown" },
      ],
    });

    assert.equal(normalized.items.length, 1);
    assert.equal(normalized.items[0]?.status, "verified");
    assert.equal(normalized.items[0]?.response, "Fixed in the latest commit.");
    assert.deepEqual(normalized.items[0]?.evidence, ["mix test test/example_test.exs"]);
  });
});

describe("mergeRemoteItems", () => {
  it("preserves local decisions while refreshing remote thread content", () => {
    const current = resolveItem({
      status: "fixed",
      selected: true,
      response: "Fixed by restoring validation.",
      resolution: "Validation now runs before the branch.",
      evidence: ["mix test test/example_test.exs"],
    });
    const remote = itemFromThread(
      reviewThread({
        line: 48,
        comments: [
          ...reviewThread().comments,
          {
            id: "PRRC_2",
            url: "https://github.test/thread/1#reply",
            body: "Can you add a regression test?",
            author: "reviewer",
            createdAt: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );

    const [merged] = mergeRemoteItems([current], [remote], "author");

    assert.equal(merged?.line, 48);
    assert.equal(merged?.comments.length, 2);
    assert.equal(merged?.status, "fixed");
    assert.equal(merged?.selected, true);
    assert.equal(merged?.response, "Fixed by restoring validation.");
  });

  it("detects an already-posted exact response and prevents duplicate replies", () => {
    const response = "Fixed by restoring validation.";
    const current = resolveItem({ status: "verified", selected: true, response });
    const remote = itemFromThread(
      reviewThread({
        comments: [
          ...reviewThread().comments,
          {
            id: "PRRC_REPLY",
            url: "https://github.test/thread/1#reply",
            body: response,
            author: "author",
            createdAt: "2026-01-02T00:00:00Z",
          },
        ],
      }),
    );

    const [merged] = mergeRemoteItems([current], [remote], "author");

    assert.equal(exactResponsePosted(merged!, "author")?.id, "PRRC_REPLY");
    assert.equal(merged?.replyPosted, true);
    assert.equal(merged?.postedCommentId, "PRRC_REPLY");
    assert.equal(merged?.status, "verified");
  });

  it("marks a failed check resolved when it disappears from refreshed failures", () => {
    const check = itemFromCheck({
      name: "Test",
      state: "FAILURE",
      bucket: "fail",
      link: "https://github.test/check/1",
      workflow: "CI",
    });

    const [merged] = mergeRemoteItems([check], [], "author");

    assert.equal(merged?.status, "resolved");
    assert.equal(merged?.serverResolved, true);
  });

  it("reopens an item when GitHub reports it actionable again", () => {
    const current = resolveItem({ status: "resolved", serverResolved: true, selected: true });
    const remote = resolveItem({ status: "untriaged", serverResolved: false });

    const [merged] = mergeRemoteItems([current], [remote], "author");

    assert.equal(merged?.status, "untriaged");
    assert.equal(merged?.serverResolved, false);
    assert.equal(merged?.selected, false);
  });
});

describe("updateResolveItem", () => {
  it("binds verified evidence to the inspected commit", () => {
    const updated = updateResolveItem(resolveItem(), {
      status: "verified",
      response: "Fixed and covered by a regression test.",
      resolution: "Validation is restored.",
      evidence: ["mix test test/example_test.exs"],
      verifiedHeadOid: "head-2",
    });

    assert.equal(updated.status, "verified");
    assert.equal(updated.verifiedHeadOid, "head-2");
    assert.deepEqual(updated.evidence, ["mix test test/example_test.exs"]);
  });
});

describe("submissionPreflight", () => {
  it("allows a verified clean PR head to be replied to and resolved", () => {
    const item = resolveItem({
      status: "verified",
      selected: true,
      response: "Fixed in the latest commit.",
      evidence: ["mix test test/example_test.exs"],
      verifiedHeadOid: "head-1",
    });
    const preflight = submissionPreflight(resolveState([item]), "reply-and-resolve", "head-1", "head-1", true);

    assert.deepEqual(preflight.problems, []);
    assert.equal(preflight.targets.length, 1);
    assert.equal(preflight.resolveCount, 1);
    assert.equal(canResolveItem(item, "head-1"), true);
  });

  it("blocks resolution when verification belongs to an older head", () => {
    const item = resolveItem({
      status: "verified",
      selected: true,
      response: "Fixed in the latest commit.",
      evidence: ["mix test test/example_test.exs"],
      verifiedHeadOid: "head-old",
    });
    const preflight = submissionPreflight(resolveState([item]), "reply-and-resolve", "head-1", "head-1", true);

    assert.match(preflight.problems.join("\n"), /verification is not recorded against the current PR head/);
    assert.equal(preflight.resolveCount, 0);
  });

  it("blocks resolution for an unpushed or dirty checkout", () => {
    const item = resolveItem({
      status: "disputed",
      selected: true,
      response: "The existing guard already handles this path.",
      evidence: ["lib/example.ex:35-50"],
      verifiedHeadOid: "head-1",
    });
    const preflight = submissionPreflight(resolveState([item]), "reply-and-resolve", "head-1", "local-only", false);

    assert.match(preflight.problems.join("\n"), /local checkout does not match/);
    assert.match(preflight.problems.join("\n"), /working tree is not clean/);
  });

  it("allows a deferred reply without resolving it", () => {
    const item = resolveItem({
      status: "deferred",
      selected: true,
      response: "This belongs in a separate change because it predates this PR.",
    });
    const preflight = submissionPreflight(resolveState([item]), "reply-and-resolve", "head-1", "different-head", false);

    assert.deepEqual(preflight.problems, []);
    assert.equal(preflight.resolveCount, 0);
    assert.equal(preflight.targets.length, 1);
  });
});
