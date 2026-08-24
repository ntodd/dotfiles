import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatRuleMatches,
  rulesFromTtsrInventory,
  scanUnifiedDiff,
} from "./review-rules.mjs";

function rule(overrides = {}) {
  return {
    name: "avoid-count",
    path: "/rules/avoid-count.md",
    description: "Use exists when only existence matters.",
    globs: ["*.ex"],
    scopeGlobs: [],
    conditions: [String.raw`Repo\.aggregate\s*\(`],
    ...overrides,
  };
}

function postimage(lines) {
  return async () => lines.join("\n");
}

describe("rulesFromTtsrInventory", () => {
  it("uses only effective native regex rules returned by OMP", () => {
    const rules = rulesFromTtsrInventory([
      {
        name: "native-rule",
        path: "/rules/native-rule.md",
        provider: "native",
        condition: ["native"],
        globs: ["*.ex"],
        scope: ["tool:edit(lib/**/*.ex)", "tool:write(lib/**/*.ex)"],
        description: "Effective native rule.",
      },
      {
        name: "builtin-rule",
        path: "builtin-defaults:builtin-rule.md",
        provider: "builtin-defaults",
        condition: ["builtin"],
        globs: [],
        description: "Bundled rule.",
      },
      {
        name: "ast-only",
        path: "/rules/ast-only.md",
        provider: "native",
        condition: [],
        astCondition: ["$A == $A"],
        globs: ["*.ex"],
        description: "AST-only rule.",
      },
      {
        name: "prose-only",
        path: "/rules/prose-only.md",
        provider: "native",
        condition: ["native"],
        scope: ["text"],
        globs: [],
        description: "Not an edit rule.",
      },
    ]);

    assert.deepEqual(rules, [
      {
        name: "native-rule",
        path: "/rules/native-rule.md",
        description: "Effective native rule.",
        globs: ["*.ex"],
        scopeGlobs: ["lib/**/*.ex"],
        conditions: ["native"],
      },
    ]);
  });
});

describe("scanUnifiedDiff", () => {
  it("reports only full-postimage matches that overlap added lines", async () => {
    const diff = `diff --git a/lib/example.ex b/lib/example.ex
--- a/lib/example.ex
+++ b/lib/example.ex
@@ -10,3 +10,4 @@
 Repo.aggregate(existing_query, :count)
+Repo.aggregate(new_query, :count)
 keep()
-old_value()
+new_value()
`;
    const lines = Array.from({ length: 13 }, (_, index) => `line_${index + 1}()`);
    lines[9] = "Repo.aggregate(existing_query, :count)";
    lines[10] = "Repo.aggregate(new_query, :count)";

    const result = await scanUnifiedDiff(diff, [rule()], { readPostimage: postimage(lines) });

    assert.deepEqual(result.warnings, []);
    assert.equal(result.matches.length, 1);
    assert.deepEqual(result.matches[0], {
      ruleName: "avoid-count",
      rulePath: "/rules/avoid-count.md",
      description: "Use exists when only existence matters.",
      file: "lib/example.ex",
      line: 11,
      excerpt: "Repo.aggregate(new_query, :count)",
    });
  });

  it("matches OMP globs against both the full path and basename", async () => {
    const diff = `diff --git a/lib/deep/example.ex b/lib/deep/example.ex
--- a/lib/deep/example.ex
+++ b/lib/deep/example.ex
@@ -0,0 +1 @@
+Repo.aggregate(query, :count)
`;
    const options = { readPostimage: postimage(["Repo.aggregate(query, :count)"]) };

    const basenameResult = await scanUnifiedDiff(diff, [rule({ globs: ["*.ex"] })], options);
    const fullPathResult = await scanUnifiedDiff(diff, [rule({ globs: ["lib/**/*.ex"] })], options);
    const wrongPathResult = await scanUnifiedDiff(diff, [rule({ globs: ["test/**/*.exs"] })], options);
    const wrongScopeResult = await scanUnifiedDiff(
      diff,
      [rule({ scopeGlobs: ["lib/special/**/*.ex"] })],
      options,
    );

    assert.equal(basenameResult.matches.length, 1);
    assert.equal(fullPathResult.matches.length, 1);
    assert.equal(wrongPathResult.matches.length, 0);
    assert.equal(wrongScopeResult.matches.length, 0);
  });

  it("finds multiline violations whose earlier text is outside the diff hunk", async () => {
    const diff = `diff --git a/lib/example.ex b/lib/example.ex
--- a/lib/example.ex
+++ b/lib/example.ex
@@ -99,1 +99,2 @@
 end
+defmodule Second do
`;
    const lines = [String.raw`defmodule First do`];
    while (lines.length < 98) lines.push(`line_${lines.length + 1}()`);
    lines.push("end", "defmodule Second do");
    const multilineRule = rule({
      name: "one-module-per-file",
      conditions: [String.raw`(?s)\bdefmodule\b.{0,20000}\bdefmodule\b`],
    });

    const result = await scanUnifiedDiff(diff, [multilineRule], { readPostimage: postimage(lines) });

    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].line, 100);
    assert.equal(result.matches[0].excerpt, "defmodule Second do");
  });

  it("supports OMP inline regex flags", async () => {
    const diff = `diff --git a/lib/example.ex b/lib/example.ex
--- a/lib/example.ex
+++ b/lib/example.ex
@@ -20,2 +20,3 @@
 START transaction
+external_call()
 END transaction
`;
    const lines = Array.from({ length: 22 }, (_, index) => `line_${index + 1}()`);
    lines[19] = "START transaction";
    lines[20] = "external_call()";
    lines[21] = "END transaction";
    const multilineRule = rule({
      name: "transaction-boundary",
      conditions: [String.raw`(?is)start.{0,100}external_call`],
    });

    const result = await scanUnifiedDiff(diff, [multilineRule], { readPostimage: postimage(lines) });

    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].line, 21);
  });

  it("rejects empty or malformed scanner input", async () => {
    await assert.rejects(
      scanUnifiedDiff("gh: failed to fetch diff\n", [rule()], { readPostimage: postimage([]) }),
      /valid unified git diff/i,
    );
  });

  it("warns about invalid regex rules and unavailable postimages", async () => {
    const diff = `diff --git a/lib/example.ex b/lib/example.ex
--- a/lib/example.ex
+++ b/lib/example.ex
@@ -0,0 +1 @@
+Repo.aggregate(query, :count)
`;
    const result = await scanUnifiedDiff(diff, [rule({ name: "broken", conditions: ["("] }), rule()], {
      readPostimage: async () => {
        throw new Error("missing exact head");
      },
    });

    assert.equal(result.matches.length, 0);
    assert.match(result.warnings[0], /broken.*invalid regex/i);
    assert.match(result.warnings[1], /lib\/example\.ex.*unscanned.*missing exact head/i);
  });
});

describe("formatRuleMatches", () => {
  it("returns compact references and leaves guidance to rule:// reads", () => {
    const output = formatRuleMatches({
      matches: [
        {
          ruleName: "avoid-count",
          rulePath: "/rules/avoid-count.md",
          description: "Use exists when only existence matters.",
          file: "lib/example.ex",
          line: 11,
          excerpt: "Repo.aggregate(new_query, :count)",
        },
      ],
      warnings: [],
    });

    assert.match(output, /rule:\/\/avoid-count/);
    assert.match(output, /lib\/example\.ex:11/);
    assert.doesNotMatch(output, /When the answer is only yes or no/);
  });
});
