import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ExecResult } from "@oh-my-pi/pi-coding-agent";
import {
  fetchResolveState,
  replyToThread,
  resolveThread,
  workingTreeSnapshot,
  type PiExec,
} from "./github.ts";

function result(stdout: string, code = 0, stderr = ""): ExecResult {
  return { code, stdout, stderr } as ExecResult;
}

class FakePi implements PiExec {
  calls: Array<{ command: string; args: string[] }> = [];
  private readonly handler: (command: string, args: string[]) => ExecResult;

  constructor(handler: (command: string, args: string[]) => ExecResult) {
    this.handler = handler;
  }

  async exec(command: string, args: string[]): Promise<ExecResult> {
    this.calls.push({ command, args });
    return this.handler(command, args);
  }
}

function repositoryResponses(command: string, args: string[]): ExecResult {
  if (command === "gh" && args[0] === "repo") {
    return result(JSON.stringify({ nameWithOwner: "owner/repo" }));
  }
  if (command === "gh" && args[0] === "pr" && args[1] === "view") {
    return result(
      JSON.stringify({
        number: 42,
        title: "Resolve review feedback",
        url: "https://github.test/owner/repo/pull/42",
        headRefOid: "head-1",
        author: { login: "author" },
        state: "OPEN",
      }),
    );
  }
  if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
    return result(
      JSON.stringify([
        { name: "Test", state: "FAILURE", bucket: "fail", link: "https://github.test/check/1", workflow: "CI" },
        { name: "Lint", state: "SUCCESS", bucket: "pass", link: "https://github.test/check/2", workflow: "CI" },
      ]),
      1,
    );
  }
  const queryArgument = args.find(argument => argument.startsWith("query=")) ?? "";
  if (command === "gh" && queryArgument.includes("reviewThreads(first:100")) {
    return result(
      JSON.stringify({
        data: {
          viewer: { login: "author" },
          repository: {
            pullRequest: {
              number: 42,
              title: "Resolve review feedback",
              url: "https://github.test/owner/repo/pull/42",
              state: "OPEN",
              headRefOid: "head-2",
              author: { login: "author" },
              reviewThreads: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  {
                    id: "PRRT_1",
                    isResolved: false,
                    isOutdated: false,
                    path: "lib/example.ex",
                    line: 42,
                    originalLine: 40,
                    comments: {
                      pageInfo: { hasNextPage: true, endCursor: "comment-cursor" },
                      nodes: [
                        {
                          id: "PRRC_1",
                          url: "https://github.test/thread/1",
                          body: "[MAJOR] Keep validation",
                          createdAt: "2026-01-01T00:00:00Z",
                          author: { login: "reviewer" },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      }),
    );
  }
  if (command === "gh" && queryArgument.includes("node(id:$threadId)")) {
    return result(
      JSON.stringify({
        data: {
          node: {
            comments: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [
                {
                  id: "PRRC_2",
                  url: "https://github.test/thread/1#reply",
                  body: "Please include a regression test.",
                  createdAt: "2026-01-02T00:00:00Z",
                  author: { login: "reviewer" },
                },
              ],
            },
          },
        },
      }),
    );
  }
  return result("", 1, `Unexpected command: ${command} ${args.join(" ")}`);
}

describe("fetchResolveState", () => {
  it("loads paginated review-thread comments and only failed checks", async () => {
    const pi = new FakePi(repositoryResponses);

    const loaded = await fetchResolveState(pi, "/repo", "42");

    assert.equal(loaded?.state.repo, "owner/repo");
    assert.equal(loaded?.state.headRefOid, "head-2");
    assert.equal(loaded?.state.viewerLogin, "author");
    assert.equal(loaded?.state.items.length, 2);
    assert.equal(loaded?.state.items[0]?.comments.length, 2);
    assert.equal(loaded?.state.items[1]?.kind, "check");
    assert.equal(loaded?.state.items[1]?.checkName, "Test");
    assert.equal(loaded?.prState, "OPEN");
    assert.equal(pi.calls.some(call => call.args.includes("after=comment-cursor")), true);
  });

  it("loads review feedback when the PR has no reported checks", async () => {
    const pi = new FakePi((command, args) => {
      if (command === "gh" && args[0] === "pr" && args[1] === "checks") {
        return result("", 1, "no checks reported on the 'feature' branch");
      }
      return repositoryResponses(command, args);
    });

    const loaded = await fetchResolveState(pi, "/repo", "42");

    assert.equal(loaded?.state.items.length, 1);
    assert.equal(loaded?.state.items[0]?.kind, "thread");
  });
});

describe("GitHub mutations", () => {
  it("posts a review-thread reply and returns its durable ID", async () => {
    const pi = new FakePi((_command, args) => {
      assert.equal(args.some(argument => argument === "threadId=PRRT_1"), true);
      assert.equal(args.some(argument => argument === "body=Fixed in the latest commit."), true);
      return result(
        JSON.stringify({
          data: {
            addPullRequestReviewThreadReply: {
              comment: { id: "PRRC_REPLY", url: "https://github.test/thread/1#reply" },
            },
          },
        }),
      );
    });

    const posted = await replyToThread(pi, "/repo", "PRRT_1", "Fixed in the latest commit.");

    assert.deepEqual(posted, { ok: true, id: "PRRC_REPLY", message: "Reply posted." });
  });

  it("confirms GitHub resolved the requested thread", async () => {
    const pi = new FakePi(() =>
      result(
        JSON.stringify({
          data: { resolveReviewThread: { thread: { id: "PRRT_1", isResolved: true } } },
        }),
      ),
    );

    const resolved = await resolveThread(pi, "/repo", "PRRT_1");

    assert.deepEqual(resolved, { ok: true, id: "PRRT_1", message: "Thread resolved." });
  });
});

describe("workingTreeSnapshot", () => {
  it("records the exact clean local commit used for verification", async () => {
    const pi = new FakePi((command, args) => {
      assert.equal(command, "git");
      return args[0] === "rev-parse" ? result("head-2\n") : result("");
    });

    const snapshot = await workingTreeSnapshot(pi, "/repo");

    assert.deepEqual(snapshot, { headOid: "head-2", clean: true });
  });
});
