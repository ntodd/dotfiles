#!/usr/bin/env bash
# Renders the film and its deliverables into out/:
# Set VERSION to render into out/<version>/ (e.g. VERSION=v2), so earlier
# exports stay put.
#
#   film.mp4               1920x1080, H.264, loudness-normalized for the web
#   film-captions.mp4   same, with burned-in captions (muted autoplay)
#   film.vtt               captions for a <track> element
#   film-poster.jpg     the end card, for the <video poster>
#
#   npm run render            everything
#   npm run render -- quick   just film.mp4, faster settings
set -euo pipefail
cd "$(dirname "$0")/.."
dir="out/${VERSION:-current}"
mkdir -p "$dir"
npx tsx pipeline/build-timeline.ts

crf=16; conc="${CONCURRENCY:-8}"
[[ "${1:-}" == "quick" ]] && crf=23

render() { # composition output
  npx remotion render src/index.ts "$1" "$dir/.$2.raw.mp4" \
    --codec h264 --crf "$crf" --audio-codec aac --audio-bitrate 320k \
    --concurrency "$conc" --log error
  # Two-pass loudness normalization to -14 LUFS, -1 dBTP (web/social).
  stats=$(ffmpeg -hide_banner -i "$dir/.$2.raw.mp4" -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
  mi=$(echo "$stats" | python3 -c "import json,sys;d=json.load(sys.stdin);print(f\"measured_I={d['input_i']}:measured_TP={d['input_tp']}:measured_LRA={d['input_lra']}:measured_thresh={d['input_thresh']}:offset={d['target_offset']}\")")
  ffmpeg -hide_banner -loglevel error -y -i "$dir/.$2.raw.mp4" -c:v copy \
    -af "loudnorm=I=-14:TP=-1:LRA=11:$mi:linear=true,aresample=48000" -c:a aac -b:a 320k \
    -movflags +faststart "$dir/$2.mp4"
  rm "$dir/.$2.raw.mp4"
  echo "$dir/$2.mp4: $(ffprobe -v error -show_entries format=duration,size -of csv=p=0 "$dir/$2.mp4")"
}

render Film film
if [[ "${1:-}" != "quick" ]]; then
  render FilmCaptioned film-captions
  npx tsx pipeline/vtt.ts > "$dir/film.vtt"
  ffmpeg -hide_banner -loglevel error -y -sseof -1.5 -i "$dir/film.mp4" -frames:v 1 -q:v 2 "$dir/film-poster.jpg"
  echo "$dir/film.vtt, $dir/film-poster.jpg"
fi
