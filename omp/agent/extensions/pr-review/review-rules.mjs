#!/usr/bin/env node

import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const INLINE_FLAG_PREFIX = /^\(\?([a-z]+)\)/;
const TRANSLATABLE_INLINE_FLAGS = /^[ims]+$/;
const MAX_COMMAND_OUTPUT = 64 * 1024 * 1024;

function editScopeGlobs(scope) {
  if (!Array.isArray(scope) || scope.length === 0) return [];

  const globs = [];
  for (const value of scope) {
    if (typeof value !== "string") continue;
    const token = value.trim();
    if (/^(?:tool|toolcall)$/i.test(token)) return [];
    const match = /^(?:tool:)?(?:edit|write)(?:\(([^)]+)\))?$/i.exec(token);
    if (!match) continue;
    if (!match[1]) return [];
    globs.push(match[1]);
  }
  return globs.length > 0 ? [...new Set(globs)] : undefined;
}

export function rulesFromTtsrInventory(inventory) {
  if (!Array.isArray(inventory)) throw new Error("OMP TTSR inventory is not an array");

  const rules = [];
  for (const entry of inventory) {
    if (
      entry?.provider !== "native" ||
      typeof entry.name !== "string" ||
      typeof entry.path !== "string" ||
      !Array.isArray(entry.condition)
    ) {
      continue;
    }
    const conditions = entry.condition.filter(
      (condition) => typeof condition === "string" && condition.length > 0,
    );
    const scopeGlobs = editScopeGlobs(entry.scope);
    if (conditions.length === 0 || scopeGlobs === undefined) continue;

    rules.push({
      name: entry.name,
      path: entry.path,
      description: typeof entry.description === "string" ? entry.description : "",
      globs: Array.isArray(entry.globs) ? entry.globs.filter((glob) => typeof glob === "string") : [],
      scopeGlobs,
      conditions,
    });
  }
  return rules;
}

async function loadEffectiveNativeRules(cwd) {
  const { stdout } = await execFileAsync("omp", ["ttsr", "list", "--json"], {
    cwd,
    encoding: "utf8",
    maxBuffer: MAX_COMMAND_OUTPUT,
  });
  return rulesFromTtsrInventory(JSON.parse(stdout));
}

function compileCondition(pattern) {
  const inlineFlags = INLINE_FLAG_PREFIX.exec(pattern);
  if (inlineFlags && TRANSLATABLE_INLINE_FLAGS.test(inlineFlags[1])) {
    const flags = [...new Set(inlineFlags[1])].join("");
    return new RegExp(pattern.slice(inlineFlags[0].length), `${flags}g`);
  }
  return new RegExp(pattern, "g");
}

function matchesGlob(pattern, filePath) {
  const normalized = filePath.replaceAll("\\", "/");
  if (path.matchesGlob(normalized, pattern)) return true;
  return path.matchesGlob(path.posix.basename(normalized), pattern);
}

function parseDiffPath(value) {
  const trimmed = value.trim();
  let decoded = trimmed;
  if (trimmed.startsWith('"')) {
    try {
      decoded = JSON.parse(trimmed);
    } catch {
      decoded = trimmed.slice(1, -1);
    }
  } else {
    decoded = trimmed.split("\t", 1)[0];
  }
  if (decoded === "/dev/null") return undefined;
  return decoded.replace(/^[ab]\//, "");
}

function parseAddedLines(diff) {
  const changes = new Map();
  let currentFile;
  let inHunk = false;
  let newLine = 0;

  for (const line of diff.replaceAll("\r\n", "\n").split("\n")) {
    if (line.startsWith("diff --git ")) {
      currentFile = undefined;
      inHunk = false;
      continue;
    }
    if (line.startsWith("+++ ")) {
      currentFile = parseDiffPath(line.slice(4));
      inHunk = false;
      continue;
    }

    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (header) {
      newLine = Number(header[1]);
      inHunk = Boolean(currentFile);
      continue;
    }
    if (!inHunk || line.startsWith("\\ No newline at end of file")) continue;

    const marker = line[0];
    if (marker === "+") {
      let addedLines = changes.get(currentFile);
      if (!addedLines) {
        addedLines = new Set();
        changes.set(currentFile, addedLines);
      }
      addedLines.add(newLine);
      newLine += 1;
    } else if (marker === " ") {
      newLine += 1;
    } else if (marker !== "-") {
      inHunk = false;
    }
  }

  return [...changes].map(([file, addedLines]) => ({ file, addedLines }));
}

function lineStarts(source) {
  const starts = [0];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function overlappingAddedLines(source, starts, addedLines, matchStart, matchEnd) {
  const overlaps = [];
  for (const line of addedLines) {
    const start = starts[line - 1];
    if (start === undefined) continue;
    const end = starts[line] ?? source.length;
    if (matchStart < end && matchEnd > start) overlaps.push(line);
  }
  return overlaps;
}

function lineExcerpt(source, starts, line) {
  const start = starts[line - 1];
  if (start === undefined) return "";
  const end = starts[line] ?? source.length;
  return source.slice(start, end).replace(/\n$/, "").trim().slice(0, 240);
}

export async function scanUnifiedDiff(diff, rules, options) {
  if (typeof options?.readPostimage !== "function") {
    throw new Error("scanUnifiedDiff requires an exact postimage reader");
  }
  if (!/^diff --git /m.test(diff)) {
    throw new Error("scanner input is not a valid unified git diff");
  }

  const warnings = [];
  const compiledRules = [];
  for (const rule of rules) {
    const conditions = [];
    for (const pattern of rule.conditions) {
      try {
        conditions.push(compileCondition(pattern));
      } catch (error) {
        warnings.push(`${rule.name}: invalid regex '${pattern}': ${error.message}`);
      }
    }
    if (conditions.length > 0) compiledRules.push({ rule, conditions });
  }

  const changes = parseAddedLines(diff);
  const postimages = await Promise.all(
    changes.map(async (change) => {
      try {
        return { ...change, source: await options.readPostimage(change.file) };
      } catch (error) {
        warnings.push(`${change.file}: unscanned because the exact postimage is unavailable: ${error.message}`);
        return undefined;
      }
    }),
  );

  const matches = [];
  const seen = new Set();
  for (const postimage of postimages) {
    if (!postimage) continue;
    const starts = lineStarts(postimage.source);
    for (const { rule, conditions } of compiledRules) {
      if (rule.globs.length > 0 && !rule.globs.some((glob) => matchesGlob(glob, postimage.file))) continue;
      if (rule.scopeGlobs?.length > 0 && !rule.scopeGlobs.some((glob) => matchesGlob(glob, postimage.file))) {
        continue;
      }
      for (const condition of conditions) {
        condition.lastIndex = 0;
        for (const match of postimage.source.matchAll(condition)) {
          if (match[0].length === 0) continue;
          const additions = overlappingAddedLines(
            postimage.source,
            starts,
            postimage.addedLines,
            match.index,
            match.index + match[0].length,
          );
          for (const line of additions) {
            const key = `${rule.name}\0${postimage.file}\0${line}`;
            if (seen.has(key)) continue;
            seen.add(key);
            matches.push({
              ruleName: rule.name,
              rulePath: rule.path,
              description: rule.description,
              file: postimage.file,
              line,
              excerpt: lineExcerpt(postimage.source, starts, line),
            });
          }
        }
      }
    }
  }

  matches.sort(
    (left, right) =>
      left.ruleName.localeCompare(right.ruleName) ||
      left.file.localeCompare(right.file) ||
      left.line - right.line,
  );
  return { matches, warnings };
}

export function formatRuleMatches(result) {
  const lines = [];
  if (result.matches.length === 0) {
    lines.push("No effective native OMP regex rule candidates matched added lines.");
  } else {
    const ruleCount = new Set(result.matches.map((match) => match.ruleName)).size;
    lines.push(
      `${result.matches.length} candidate match${result.matches.length === 1 ? "" : "es"} across ${ruleCount} rule${ruleCount === 1 ? "" : "s"}.`,
      "Candidates are not automatically violations. Read each matched rule and verify its exceptions against the patch.",
    );
    let previousRule;
    for (const match of result.matches) {
      if (match.ruleName !== previousRule) {
        lines.push("", `rule://${match.ruleName}`, `Fallback file: ${match.rulePath}`);
        if (match.description) lines.push(match.description);
        previousRule = match.ruleName;
      }
      lines.push(`- ${match.file}:${match.line} ${match.excerpt}`.trimEnd());
    }
  }
  if (result.warnings.length > 0) {
    lines.push("", "Scanner warnings:", ...result.warnings.map((warning) => `- ${warning}`));
  }
  return `${lines.join("\n")}\n`;
}

function worktreeReader(cwd) {
  const root = path.resolve(cwd);
  return async (file) => {
    const target = path.resolve(root, file);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
      throw new Error("diff path escapes the working tree");
    }
    return readFile(target, "utf8");
  };
}

function gitRefReader(cwd, ref) {
  return async (file) => {
    const { stdout } = await execFileAsync("git", ["show", `${ref}:${file}`], {
      cwd,
      encoding: "utf8",
      maxBuffer: MAX_COMMAND_OUTPUT,
    });
    return stdout;
  };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

function parseArguments(arguments_) {
  let gitRef;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--git-ref" && arguments_[index + 1]) {
      gitRef = arguments_[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return { gitRef };
}

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(
      "Usage: <unified-diff-command> | node review-rules.mjs [--git-ref REF]\n" +
        "Loads OMP's effective native TTSR inventory, scans exact postimages, and prints candidates for reviewer verification.\n",
    );
    return;
  }

  const cwd = process.cwd();
  const { gitRef } = parseArguments(process.argv.slice(2));
  const [diff, rules] = await Promise.all([readStdin(), loadEffectiveNativeRules(cwd)]);
  const result = await scanUnifiedDiff(diff, rules, {
    readPostimage: gitRef ? gitRefReader(cwd, gitRef) : worktreeReader(cwd),
  });
  if (rules.length === 0) {
    result.warnings.unshift("OMP returned no effective native regex rules for this working directory.");
  }
  process.stdout.write(formatRuleMatches(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`review-rules: ${error.message}\n`);
    process.exitCode = 1;
  });
}
