#!/usr/bin/env bash
# Run a discussion with OpenAI Codex CLI
# Usage: discuss.sh [--resume|-r] "Your discussion prompt here"
#
# Options:
#   --resume, -r  Resume the last session (preserves conversation context)
#
# Options (via environment variables):
#   CODEX_MODEL - Model to use (default: uses codex config default) - new sessions only
#   CODEX_CONTEXT_DIR - Directory context for the discussion (default: current dir) - new sessions only

set -eo pipefail

# Parse arguments
RESUME=false
PROMPT=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --resume|-r)
            RESUME=true
            shift
            ;;
        *)
            PROMPT="$1"
            shift
            ;;
    esac
done

if [ -z "$PROMPT" ]; then
    echo "Error: No prompt provided" >&2
    echo "Usage: discuss.sh [--resume|-r] \"Your discussion prompt here\"" >&2
    exit 1
fi

# Capture stderr to temp file, show on failure only
STDERR_FILE=$(mktemp)
trap 'rm -f "$STDERR_FILE"' EXIT

if [ "$RESUME" = true ]; then
    # Resume mode: limited options, capture stdout directly
    # Note: resume doesn't support --json, -m, -s, or -o flags
    if ! OUTPUT=$(codex exec resume --last "$PROMPT" 2>"$STDERR_FILE"); then
        echo "Error: Failed to get response from codex" >&2
        cat "$STDERR_FILE" >&2
        exit 1
    fi
else
    # New session mode: full options with JSON parsing
    if ! command -v jq &>/dev/null; then
        echo "Error: jq is required but not installed" >&2
        exit 1
    fi

    CMD=(codex exec -s read-only)

    # Add model if specified
    if [ -n "$CODEX_MODEL" ]; then
        CMD+=(-m "$CODEX_MODEL")
    fi

    # Add context directory if specified
    if [ -n "$CODEX_CONTEXT_DIR" ]; then
        CMD+=(-C "$CODEX_CONTEXT_DIR")
    fi

    # Run codex and extract the agent message from JSON output
    if ! OUTPUT=$(echo "$PROMPT" | "${CMD[@]}" --json - 2>"$STDERR_FILE" | \
        jq -r 'select(.type == "item.completed" and .item.type == "agent_message") | .item.text // empty'); then
        echo "Error: Failed to get response from codex" >&2
        cat "$STDERR_FILE" >&2
        exit 1
    fi
fi

if [ -z "$OUTPUT" ]; then
    echo "Error: No response from codex" >&2
    cat "$STDERR_FILE" >&2
    exit 1
fi

echo "$OUTPUT"
