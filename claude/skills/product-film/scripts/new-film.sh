#!/usr/bin/env bash
# Starts a new product film from the template.
#   new-film.sh <target-dir>
# Copies the template, installs dependencies, and creates .env from the
# example. Then: put a limited, expiring OpenRouter key in .env and run
# `npm run check-key`. Nothing here spends money.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:?usage: new-film.sh <target-dir>}"
if [[ -e "$target" && -n "$(ls -A "$target" 2>/dev/null)" ]]; then
  echo "$target exists and isn't empty; pick a new directory." >&2
  exit 1
fi
mkdir -p "$target"
rsync -a --exclude node_modules --exclude out --exclude .work --exclude src/generated "$here/template/" "$target/"
cp "$target/.env.example" "$target/.env"
( cd "$target" && npm install --silent )
for tool in ffmpeg uv cwebp; do command -v "$tool" >/dev/null || echo "missing: $tool (brew install $tool)" >&2; done
cat <<MSG
New film in $target.
Next:
  1. Ask the user for an OpenRouter key with a credit limit and an expiry; put it in $target/.env
  2. cd $target && npm run check-key
  3. npm run dry-run && npm run studio      (free: placeholder VO and music)
  4. Edit script.yaml, then follow SKILL.md from "Voice".
MSG
