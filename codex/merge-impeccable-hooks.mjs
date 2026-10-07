#!/usr/bin/env node
// Merge the impeccable design-detector hooks into a Codex hooks.json.
// ~/.codex/hooks.json is also written by other installers (moshi-hook, orca),
// so it cannot be a symlink into this repo; this script merges instead and is
// idempotent — entries whose command mentions impeccable are replaced in place.
//
// Usage: node merge-impeccable-hooks.mjs [path/to/hooks.json]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const target = process.argv[2] || path.join(os.homedir(), '.codex', 'hooks.json');
const hookScript = path.join(os.homedir(), '.agents', 'skills', 'impeccable', 'scripts', 'hook.mjs');

const guarded = `[ ! -f '${hookScript}' ] || node '${hookScript}'`;
const guardedWindows = `if exist "${hookScript}" (node "${hookScript}" & exit /b)`;

const entries = {
  PostToolUse: {
    matcher: 'Edit|Write|apply_patch',
    hooks: [
      {
        type: 'command',
        command: guarded,
        timeout: 5,
        statusMessage: 'Checking UI changes',
        commandWindows: guardedWindows,
      },
    ],
  },
  Stop: {
    hooks: [
      {
        type: 'command',
        command: guarded,
        timeout: 30,
        statusMessage: 'Design deep pass',
        commandWindows: guardedWindows,
      },
    ],
  },
};

let config = { hooks: {} };
if (fs.existsSync(target)) {
  config = JSON.parse(fs.readFileSync(target, 'utf8'));
  config.hooks ||= {};
}

const isImpeccable = (group) =>
  (group.hooks || []).some((h) => typeof h.command === 'string' && h.command.includes('impeccable'));

for (const [event, entry] of Object.entries(entries)) {
  const groups = (config.hooks[event] || []).filter((g) => !isImpeccable(g));
  groups.push(entry);
  config.hooks[event] = groups;
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(config, null, 2) + '\n');
console.log(`impeccable hooks merged into ${target}`);
