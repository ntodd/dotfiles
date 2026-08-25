import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  allowedReviewEvents,
  buildReviewBody,
  buildReviewSubmissionPlan,
  defaultReviewEvent,
  fullReviewText,
  findReviewBaselineId,
  normalizeFindings,
  normalizeWalkthrough,
  parseSteReviewPresentation,
  parsePrReviewArgs,
  reviewPresentationText,
  reviewProseForSimplification,
  reviewSubmissionError,
  walkthroughText,
  patchContainsNewLine,
  type PrReviewState,
  type SteReviewPresentation,
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
      migrationErd: "",
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
    presentationMode: "original",
    ...overrides,
  };
}

describe("normalizeWalkthrough", () => {
  it("fills the migration ERD field for legacy persisted walkthroughs", () => {
    const walkthrough = normalizeWalkthrough({ problem: "Legacy review" });

    assert.equal(walkthrough.problem, "Legacy review");
    assert.equal(walkthrough.migrationErd, "");
  });
});

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
        migrationErd: [
          "erDiagram",
          "  accounts {",
          "    bigint id PK",
          "  }",
          "  users {",
          "    bigint id PK",
          "    bigint account_id FK",
          "  }",
          "  accounts ||..o{ users : references",
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
    assert.match(text, /Database ERD:\n```mermaid\nerDiagram/);
    assert.match(text, /accounts \|\|\.\.o\{ users : references/);
    assert.equal(text.match(/```mermaid\n/g)?.length, 2);
    assert.equal(
      walkthroughText({ ...state, walkthrough: { ...state.walkthrough, migrationErd: "" } }).match(
        /```mermaid\n/g,
      )?.length,
      1,
    );
    assert.match(
      walkthroughText({ ...state, walkthrough: { ...state.walkthrough, mermaid: "" } }),
      /Database ERD:\n```mermaid\nerDiagram/,
    );
    assert.doesNotMatch(walkthroughText(state, { includeMermaid: false }), /```mermaid/);
    assert.match(text, /Senior-engineering gate: CAUTION/);
    assert.match(text, /18: return reloadReview\(defaultState\)/);
    assert.match(text, /Why this occurs: reloadReview reads defaults/);
  });
});

describe("review presentation views", () => {
  const codeExcerpt = [
    "18: const decision = reloadReview(defaultState);",
    "19: return decision;",
  ].join("\n");
  const findings = normalizeFindings([
    {
      file: "src/review.ts",
      line: 18,
      severity: "major",
      title: "State resets during reload",
      issue: "The user's review decisions disappear after a branch reload.",
      explanation: "reloadReview reads defaults instead of the persisted state.",
      code_excerpt: codeExcerpt,
    },
  ]);
  const state = reviewState({
    walkthrough: {
      problem: "Reviewers lose decisions on a reachable branch reload.",
      behavior: "The extension now restores the recorded review state.",
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
      mermaid: 'flowchart LR\n  A["session entry"] --> B["reloadReview"]',
      migrationErd: "",
      blastRadius: "Review-session state.",
    },
    qualityGate: {
      verdict: "caution",
      rationale: "The path is sound but reload compatibility needs attention.",
      checks: [
        {
          name: "maintainability",
          rating: "concern",
          explanation: "The reload path accepts two persisted shapes.",
        },
      ],
    },
    findings,
  });
  const stePresentation: SteReviewPresentation = {
    summary: "The change keeps the review state. One reload problem remains.",
    walkthrough: {
      problem: "A branch reload can remove the review decisions.",
      behavior: "The extension now gets the recorded review state.",
      codeMapRoles: ["This function gets the recorded review state."],
      dataFlows: [
        {
          name: "Review reload",
          steps: ["Read the session entry.", "Call reloadReview.", "Show the issue list."],
        },
      ],
      blastRadius: "This change applies only to the review-session state.",
    },
    qualityGate: {
      rationale: "The design is satisfactory. The reload compatibility needs attention.",
      checkExplanations: ["The reload path accepts two stored data shapes."],
    },
    findings: [
      {
        title: "The reload removes the review decisions",
        issue: "The review decisions disappear after a branch reload.",
        explanation: "reloadReview gets the default state. It does not get the recorded state.",
      },
    ],
  };

  it("keeps code evidence out of the prose sent for simplification", () => {
    const source = JSON.stringify(reviewProseForSimplification(state));

    assert.doesNotMatch(source, /18: const decision = reloadReview/);
    assert.doesNotMatch(source, /flowchart LR/);
    assert.match(source, /review decisions disappear/);
  });

  it("renders STE-style prose with canonical technical evidence", () => {
    const text = reviewPresentationText(state, "ste", stePresentation);

    assert.match(text, /The change keeps the review state/);
    assert.match(
      text,
      /STE-style reading view[\s\S]*Summary:\n- The change keeps the review state\.\n- One reload problem remains\./,
    );
    assert.match(
      text,
      /Problem and reachability:\n- A branch reload can remove the review decisions\./,
    );
    assert.match(
      text,
      /Code map:\n- `src\/review\.ts:12-24` `reloadReview`\n  - This function gets the recorded review state\./,
    );
    assert.match(
      text,
      /Issue:\n- The review decisions disappear after a branch reload\./,
    );
    assert.match(text, /This function gets the recorded review state/);
    assert.match(text, /src\/review\.ts:18/);
    assert.match(text, /`reloadReview`/);
    assert.match(text, /```mermaid\nflowchart LR/);
    assert.equal(text.split(codeExcerpt).length - 1, 1);
    assert.doesNotMatch(text, /Reviewers lose decisions on a reachable branch reload/);
  });

  it("keeps the original presentation and GitHub body independent from STE prose", () => {
    const original = reviewPresentationText(state, "original", stePresentation);
    const body = buildReviewBody(state);

    assert.match(original, /Reviewers lose decisions on a reachable branch reload/);
    assert.doesNotMatch(original, /The change keeps the review state/);
    assert.match(body, /The change is sound apart from the findings below/);
    assert.doesNotMatch(body, /The change keeps the review state/);
    assert.equal(original.split(codeExcerpt).length - 1, 1);
  });

  it("parses fenced JSON only when every canonical item has matching prose", () => {
    const fenced = `\`\`\`json\n${JSON.stringify(stePresentation)}\n\`\`\``;

    assert.deepEqual(parseSteReviewPresentation(fenced, state), stePresentation);
    assert.throws(
      () =>
        parseSteReviewPresentation(
          JSON.stringify({ ...stePresentation, findings: [] }),
          state,
        ),
      /exactly 1 finding/,
    );
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

describe("parsePrReviewArgs", () => {
  it("uses the standard reviewer by default", () => {
    assert.deepEqual(parsePrReviewArgs(""), { pr: "head", mode: "standard" });
    assert.deepEqual(parsePrReviewArgs("1234"), { pr: "1234", mode: "standard" });
  });

  it("accepts fast after a PR number or by itself", () => {
    assert.deepEqual(parsePrReviewArgs("1234 fast"), { pr: "1234", mode: "fast" });
    assert.deepEqual(parsePrReviewArgs("fast"), { pr: "head", mode: "fast" });
  });

  it("rejects unknown or misplaced options", () => {
    assert.throws(() => parsePrReviewArgs("fast 1234"), /Usage/);
    assert.throws(() => parsePrReviewArgs("1234 quick"), /Usage/);
  });
});

describe("PR reviewer agent variants", () => {
  function normalizedReviewerAgent(source: string): string {
    const lines = source.trimEnd().split("\n");
    lines[1] = "name: <reviewer>";
    lines[2] = "description: <reviewer>";
    lines[5] = 'model: "<reviewer>"';
    return lines.join("\n");
  }

  it("keeps the fast and standard review contracts in lockstep", () => {
    const standard = readFileSync(new URL("../../agents/pr-reviewer.md", import.meta.url), "utf8");
    const fast = readFileSync(new URL("../../agents/pr-reviewer-fast.md", import.meta.url), "utf8");
    const general = readFileSync(new URL("../../agents/reviewer.md", import.meta.url), "utf8");
    const issueDigger = readFileSync(new URL("../../agents/issue-digger.md", import.meta.url), "utf8");
    const config = readFileSync(new URL("../../config.yml", import.meta.url), "utf8");

    assert.equal(normalizedReviewerAgent(fast), normalizedReviewerAgent(standard));
    assert.match(fast, /^model: "@reviewer_fast"$/m);
    assert.match(standard, /^model: "@reviewer"$/m);
    assert.match(general, /^model: "@reviewer"$/m);
    assert.match(issueDigger, /^model: "@reviewer_fast"$/m);
    assert.match(config, /^  reviewer: openai-codex\/gpt-5\.6-sol:xhigh$/m);
    assert.match(config, /^  reviewer_fast: openai-codex\/gpt-5\.6-luna:max$/m);
    assert.match(config, /^  reviewer_adversarial: openai-codex\/gpt-5\.6-sol:xhigh$/m);
    assert.match(config, /^  reviewer_adversarial_fast: openai-codex\/gpt-5\.6-luna:max$/m);
  });
});

describe("defaultReviewEvent", () => {
  it("maps structured verdicts to GitHub review events", () => {
    assert.equal(defaultReviewEvent("changes_requested"), "REQUEST_CHANGES");
    assert.equal(defaultReviewEvent("approve"), "APPROVE");
    assert.equal(defaultReviewEvent("unknown"), "COMMENT");
  });
});
