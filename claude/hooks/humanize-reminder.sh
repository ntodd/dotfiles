#!/usr/bin/env bash
# PreToolUse hook (matcher: Bash) wired in claude/settings.json.
# When a Bash command posts content under the human's GitHub identity, inject a
# reminder to run the draft through the `humanizer` skill first. Reminder only —
# it never blocks the command.

set -euo pipefail

command="$(cat | jq -r '.tool_input.command // empty')"

# Subcommands that publish prose under the human's identity.
if printf '%s' "$command" | grep -Eq 'gh +(issue|pr) +(create|comment)|gh +pr +review|gh +release +create'; then
  cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "This command posts content under the human's GitHub identity. Before posting, make sure the title/body/comment has been run through the `humanizer` skill and reads in the human's voice — not AI-default prose. If you haven't humanized it yet, do that first, then re-run."
  }
}
JSON
fi

exit 0
