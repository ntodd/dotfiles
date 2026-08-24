import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  allowedReviewEvents,
  buildReviewBody,
  buildReviewSubmissionPlan,
  defaultReviewEvent,
  fullReviewText,
  findReviewBaselineId,
  normalizeFindings,
  reviewSubmissionError,
  walkthroughText,
  patchContainsNewLine,
  type PrReviewState,
} from "./review-core.ts";

function reviewState(overrides: Partial<PrReviewState> = {}): PrReviewState {
  return {
    repo: "owner/repo",
    pr: 42,
    title: "Keep review state stable",
    summary: "The change is sound apart from the findings below.",
    verdict: "changes_requested",
    walkthrough: {
      problem: "A reachable review flow loses context.",
      behavior: "The review now preserves and renders code-backed context.",
      codeMap: [],
      dataFlows: [],
      mermaid: "",
      blastRadius: "Review sessions only.",
    },
    qualityGate: {
      verdict: "pass",
      rationale: "The change is proportional to the workflow.",
      checks: [],
    },
    findings: [],
    notes: "",
    editedBody: "",
    submitted: false,
    ...overrides,
  };
}

describe("normalizeFindings", () => {
  it("preserves interactive flags and notes when state is reloaded", () => {
    const [finding] = normalizeFindings([
      {
        file: "src/review.ts",
        line: 18,
        severity: "MAJOR",
        title: "State resets",
        issue: "Reloading the branch must preserve the user's decisions.",
        explanation: "Branch reload reads the state without these fields and discards them.",
        code_excerpt: "18: return reload(state)",
        flagged: true,
        note: "  Include the reproduction  ",
      },
    ]);

    assert.deepEqual(finding, {
      file: "src/review.ts",
      line: 18,
      severity: "major",
      title: "State resets",
      issue: "Reloading the branch must preserve the user's decisions.",
      explanation: "Branch reload reads the state without these fields and discards them.",
      codeExcerpt: "18: return reload(state)",
      flagged: true,
      note: "Include the reproduction",
    });
  });

  it("drops invalid inline line numbers", () => {
    const findings = normalizeFindings([
      { file: "a.ts", line: 0, severity: "minor", issue: "zero" },
      { file: "b.ts", line: 1.5, severity: "minor", issue: "fraction" },
    ]);

    assert.equal(findings[0]?.line, undefined);
    assert.equal(findings[1]?.line, undefined);
  });
});

describe("findReviewBaselineId", () => {
  const stateType = "com.nate.pr-review.state";
  const summaryType = "com.nate.pr-review.summary";

  function stateEntry(id: string, state: PrReviewState) {
    return {
      type: "custom",
      customType: stateType,
      id,
      data: { ...state },
    };
  }

  function summaryEntry(id: string, parentId: string, state: PrReviewState) {
    return {
      type: "custom_message",
      customType: summaryType,
      id,
      parentId,
      details: state,
    };
  }

  it("returns to the same navigable anchor for a second issue discussion", () => {
    const state = reviewState();
    const recordedState = stateEntry("recorded-state", state);
    const anchor = { type: "message", id: "review-anchor" };
    const summary = summaryEntry("review-summary", anchor.id, state);
    const entries = [recordedState, anchor, summary];

    const firstBaseline = findReviewBaselineId(state, entries, entries, summaryType, stateType);
    assert.equal(firstBaseline, anchor.id);

    state.baselineId = firstBaseline!;
    const discussionBranch = [
      recordedState,
      anchor,
      stateEntry("first-issue-state", state),
      { type: "message", id: "first-issue-prompt" },
      { type: "message", id: "first-issue-answer" },
      stateEntry("first-issue-return", state),
    ];

    const secondBaseline = findReviewBaselineId(state, discussionBranch, entries, summaryType, stateType);
    assert.equal(secondBaseline, anchor.id);
  });

  it("migrates a previously persisted summary ID to its navigable parent", () => {
    const state = reviewState({ baselineId: "review-summary" });
    const anchor = { type: "message", id: "review-anchor" };
    const summary = summaryEntry(state.baselineId!, anchor.id, state);
    const branch = [stateEntry("recorded-state", state), anchor, stateEntry("issue-return", state)];

    assert.equal(findReviewBaselineId(state, branch, [...branch, summary], summaryType, stateType), anchor.id);
  });

  it("recovers a legacy branch without selecting another review of the same PR", () => {
    const state = reviewState();
    const currentSummary = summaryEntry("current-summary", "current-anchor", state);
    const newerReview = reviewState({ summary: "A later review from another branch." });
    const entries = [
      currentSummary,
      summaryEntry("other-summary", "other-anchor", newerReview),
    ];
    const discussionBranch = [stateEntry("recorded-state", state)];

    assert.equal(
      findReviewBaselineId(state, discussionBranch, entries, summaryType, stateType),
      "current-anchor",
    );
  });

  it("uses the review state as a branch-local fallback when the summary is unavailable", () => {
    const state = reviewState();
    const branch = [stateEntry("recorded-state", state)];

    assert.equal(findReviewBaselineId(state, branch, branch, summaryType, stateType), "recorded-state");
  });
});

describe("buildReviewBody", () => {
  it("keeps inline findings out of the body and retains non-inline findings", () => {
    const findings = normalizeFindings([
      {
        file: "src/inline.ts",
        line: 12,
        severity: "major",
        title: "Inline concern",
        issue: "This is posted as a GitHub inline comment.",
        flagged: true,
      },
      {
        file: "src/general.ts",
        severity: "minor",
        title: "General concern",
        issue: "This belongs in the body.",
        explanation: "The general path reaches this branch without an inline location.",
        flagged: true,
        note: "Keep this context",
      },
      {
        file: "src/good.ts",
        line: 4,
        severity: "praise",
        title: "Clear boundary",
        issue: "The boundary is explicit.",
      },
    ]);

    const body = buildReviewBody(reviewState({ findings, notes: "Ship after the major fix." }));

    assert.doesNotMatch(body, /Inline concern/);
    assert.match(body, /General concern/);
    assert.match(body, /This belongs in the body/);
    assert.match(body, /Why this occurs: The general path reaches this branch/);
    assert.match(body, /Reviewer note: Keep this context/);
    assert.match(body, /Clear boundary/);
    assert.match(body, /Ship after the major fix/);
  });
});

describe("buildReviewSubmissionPlan", () => {
  const findings = normalizeFindings([
    {
      file: "src/inline.ts",
      line: 12,
      severity: "major",
      title: "Inline concern",
      issue: "The full explanation.",
      flagged: true,
      note: "Include the reproduction",
    },
    {
      file: "src/unflagged.ts",
      line: 9,
      severity: "minor",
      title: "Body only",
      issue: "This stays out of the inline array.",
    },
  ]);
  const comments = [
    {
      path: "src/inline.ts",
      line: 12,
      side: "RIGHT" as const,
      body: "[MAJOR] Inline concern\n\nThe full explanation.\n\nReviewer note: Include the reproduction",
    },
  ];

  it("creates one submitted review when an overall body is present", () => {
    const plan = buildReviewSubmissionPlan(
      reviewState({ findings }),
      "REQUEST_CHANGES",
      "Edited summary",
    );

    assert.deepEqual(plan, {
      create: {
        body: "Edited summary",
        event: "REQUEST_CHANGES",
        comments,
      },
    });
  });

  it("uses a pending review to submit inline comments without an overall body", () => {
    const plan = buildReviewSubmissionPlan(reviewState({ findings }), "COMMENT", "   ");

    assert.deepEqual(plan, {
      create: { comments },
      submit: { event: "COMMENT" },
    });
  });

  it("can approve directly without an overall body", () => {
    const plan = buildReviewSubmissionPlan(reviewState({ findings }), "APPROVE", "");

    assert.deepEqual(plan, {
      create: {
        event: "APPROVE",
        comments,
      },
    });
  });
});

describe("review submission permissions", () => {
  it("limits an author reviewing their own pull request to comments", () => {
    assert.deepEqual(allowedReviewEvents("NTodd", "ntodd"), ["COMMENT"]);
    assert.equal(
      reviewSubmissionError("REQUEST_CHANGES", "Please fix this.", 1, "ntodd", "ntodd"),
      "GitHub only allows comment reviews on your own pull requests. Choose Comment instead.",
    );
  });

  it("allows all decisions when the reviewer is not the author", () => {
    assert.deepEqual(allowedReviewEvents("reviewer", "author"), [
      "COMMENT",
      "REQUEST_CHANGES",
      "APPROVE",
    ]);
    assert.equal(reviewSubmissionError("REQUEST_CHANGES", "", 1, "reviewer", "author"), null);
  });

  it("rejects an empty comment review with no inline comments", () => {
    assert.equal(
      reviewSubmissionError("COMMENT", "", 0, "reviewer", "author"),
      "A comment or change-request review needs at least one inline comment or a generated body.",
    );
  });
});

describe("fullReviewText", () => {
  it("renders the code map, data flow, quality gate, and finding evidence", () => {
    const findings = normalizeFindings([
      {
        file: "src/review.ts",
        line: 18,
        severity: "major",
        title: "State resets",
        issue: "The user's review decisions disappear.",
        explanation: "reloadReview reads defaults instead of the persisted state.",
        code_excerpt: "18: return reloadReview(defaultState)",
      },
    ]);
    const state = reviewState({
      walkthrough: {
        problem: "Reviewers lose decisions on a reachable branch reload.",
        behavior: "Persist and reload the review state.",
        codeMap: [
          {
            file: "src/review.ts",
            lines: "12-24",
            symbol: "reloadReview",
            role: "Restores persisted review state.",
          },
        ],
        dataFlows: [
          {
            name: "Reload",
            steps: ["session entry", "reloadReview", "interactive list"],
          },
        ],
        mermaid: [
          "flowchart LR",
          '  A["session entry"] --> B["reloadReview"]',
          '  B --> C["interactive list"]',
        ].join("\n"),
        blastRadius: "Review-session state.",
      },
      qualityGate: {
        verdict: "caution",
        rationale: "The path is sound but migration behavior needs attention.",
        checks: [
          {
            name: "maintainability",
            rating: "concern",
            explanation: "Two persisted shapes must be accepted during reload.",
          },
        ],
      },
      findings,
    });

    const text = fullReviewText(state);

    assert.match(text, /src\/review\.ts:12-24/);
    assert.match(text, /```mermaid\nflowchart LR/);
    assert.match(text, /A\["session entry"\] --> B\["reloadReview"\]/);
    assert.doesNotMatch(walkthroughText(state, { includeMermaid: false }), /```mermaid/);
    assert.match(text, /Senior-engineering gate: CAUTION/);
    assert.match(text, /18: return reloadReview\(defaultState\)/);
    assert.match(text, /Why this occurs: reloadReview reads defaults/);
  });
});

describe("patchContainsNewLine", () => {
  const patch = [
    "@@ -9,4 +9,5 @@",
    " context",
    "-removed",
    "+added",
    " next",
    "\\ No newline at end of file",
    "+last",
  ].join("\n");

  it("recognizes added and context lines on the new side", () => {
    assert.equal(patchContainsNewLine(patch, 9), true);
    assert.equal(patchContainsNewLine(patch, 10), true);
    assert.equal(patchContainsNewLine(patch, 11), true);
    assert.equal(patchContainsNewLine(patch, 12), true);
  });

  it("does not count removed or no-newline markers as new-file lines", () => {
    assert.equal(patchContainsNewLine(patch, 8), false);
    assert.equal(patchContainsNewLine(patch, 13), false);
  });
});

describe("defaultReviewEvent", () => {
  it("maps structured verdicts to GitHub review events", () => {
    assert.equal(defaultReviewEvent("changes_requested"), "REQUEST_CHANGES");
    assert.equal(defaultReviewEvent("approve"), "APPROVE");
    assert.equal(defaultReviewEvent("unknown"), "COMMENT");
  });
});
