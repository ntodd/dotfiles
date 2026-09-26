#!/usr/bin/env bash
# Verifies an OpenRouter key is safe to use for a film project: it must have
# a credit limit and an expiration, and enough budget left.
#   check-openrouter-key.sh [path/to/.env]   (reads OPENROUTER_API_KEY)
#   OPENROUTER_API_KEY=sk-or-... check-openrouter-key.sh
# Exit 0 = OK, 1 = unsafe or unusable (the reason is printed). Never prints
# the key itself.
set -euo pipefail
env_file="${1:-.env}"
if [[ -z "${OPENROUTER_API_KEY:-}" && -f "$env_file" ]]; then
  OPENROUTER_API_KEY="$(grep -E '^OPENROUTER_API_KEY=' "$env_file" | head -1 | cut -d= -f2-)"
fi
if [[ -z "${OPENROUTER_API_KEY:-}" ]]; then
  echo "No OPENROUTER_API_KEY (pass a .env path or set the variable)." >&2
  exit 1
fi
json="$(curl -sf https://openrouter.ai/api/v1/key -H "Authorization: Bearer $OPENROUTER_API_KEY")" || {
  echo "OpenRouter rejected the key (revoked, mistyped, or no network)." >&2
  exit 1
}
python3 - "$json" <<'PY'
import json, sys, datetime
d = json.loads(sys.argv[1])["data"]
problems = []
limit, remaining, expires = d.get("limit"), d.get("limit_remaining"), d.get("expires_at")
if limit is None:
    problems.append("no credit limit: create a key with a limit (e.g. $15) at https://openrouter.ai/settings/keys")
if not expires:
    problems.append("no expiration: create a key that expires (e.g. in 7 days)")
else:
    when = datetime.datetime.fromisoformat(expires.replace("Z", "+00:00"))
    days = (when - datetime.datetime.now(datetime.timezone.utc)).total_seconds() / 86400
    if days < 0:
        problems.append(f"expired on {expires}")
    elif days > 31:
        problems.append(f"expires in {days:.0f} days; use a short-lived key (a week or two)")
if d.get("is_management_key") or d.get("is_provisioning_key"):
    problems.append("this is a management/provisioning key; use an ordinary API key")
print(f"label {d.get('label')}: limit ${limit}, remaining ${remaining}, used ${d.get('usage')}, expires {expires}")
if problems:
    print("NOT SAFE TO USE:\n  - " + "\n  - ".join(problems), file=sys.stderr)
    sys.exit(1)
if remaining is not None and remaining < 3:
    print(f"WARNING: only ${remaining} left; a full film needs about $8-12.", file=sys.stderr)
print("OK")
PY
