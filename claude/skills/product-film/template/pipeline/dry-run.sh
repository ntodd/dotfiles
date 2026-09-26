#!/usr/bin/env bash
# Renders the film with free placeholders, no API calls: VO from macOS `say`
# and a synthetic 118 BPM click-track "music" with a drop and an ending hit.
# Use it to check scene timing and the edit before spending on generation.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/vo public/music .work
node --input-type=module -e '
import fs from "node:fs"; import YAML from "yaml"; import {execFileSync} from "node:child_process"
const s = YAML.parse(fs.readFileSync("script.yaml", "utf8"))
for (const sc of s.scenes) {
  const text = String(sc.vo ?? "").replace(/\s+/g, " ").trim(); if (!text) continue
  execFileSync("say", ["-o", `.work/${sc.id}.aiff`, text])
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", `.work/${sc.id}.aiff`, "-ar", "48000", `public/vo/${sc.id}.wav`])
}'
uv run --quiet pipeline/placeholder_music.py >/dev/null
# Mark the VO manifest as placeholder so `npm run voice` regenerates it.
node --input-type=module -e '
import fs from "node:fs"; import YAML from "yaml"; import {execFileSync} from "node:child_process"
const s = YAML.parse(fs.readFileSync("script.yaml", "utf8")); const m = {}
for (const sc of s.scenes) {
  const f = `public/vo/${sc.id}.wav`; if (!fs.existsSync(f)) continue
  const d = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString())
  m[sc.id] = {file: `vo/${sc.id}.wav`, duration: d, text: sc.vo, hash: "placeholder", speech: [[0, d]]}
}
fs.writeFileSync("public/vo/manifest.json", JSON.stringify(m, null, 2))'
uv run --quiet pipeline/analyze_music.py
npx tsx pipeline/build-timeline.ts
[[ -f public/sfx/pop.wav ]] || uv run --quiet pipeline/make_sfx.py
echo "Dry run ready: npm run studio, or VERSION=dry npm run render -- quick"
