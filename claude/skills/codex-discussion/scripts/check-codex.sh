#!/usr/bin/env bash
# Check if codex CLI is available and authenticated
# Returns:
#   0 - codex is available and authenticated
#   1 - codex is not installed
#   2 - codex is installed but not authenticated

# Check if codex is installed
if ! command -v codex &> /dev/null; then
    echo "NOT_INSTALLED"
    exit 1
fi

# Check authentication status
AUTH_STATUS=$(codex login status 2>&1)

if echo "$AUTH_STATUS" | grep -qi "logged in"; then
    echo "AUTHENTICATED"
    exit 0
elif echo "$AUTH_STATUS" | grep -qi "not logged in\|no.*credentials\|please log in"; then
    echo "NOT_AUTHENTICATED"
    exit 2
else
    # Unknown status - assume not authenticated
    echo "UNKNOWN: $AUTH_STATUS"
    exit 2
fi
