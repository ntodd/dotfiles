#!/usr/bin/env bash
# Exports the marketing home page's images from the captures, clips, and
# stills into priv/static/images/home (WebP), plus the film's captions.
#   pipeline/site-assets.sh [version]   (default v2)
set -euo pipefail
cd "$(dirname "$0")/.."
version="${1:-v2}"
out=../../priv/static/images/home
tmp=$(mktemp -d)
mkdir -p "$out"
C=public/captures
mark() { python3 -c "import json;d=json.load(open('$C/$1.json'));print(next(m['t'] for m in d['markers'] if m['label']=='$2')+$3)"; }
frame() { # name source time filter quality
  ffmpeg -hide_banner -loglevel error -y -ss "$3" -i "$2" -frames:v 1 -vf "$4" "$tmp/$1.png"
  cwebp -quiet -q "$5" "$tmp/$1.png" -o "$out/$1.webp"
}
still() { # name source filter quality
  ffmpeg -hide_banner -loglevel error -y -i "$2" -vf "$3" "$tmp/$1.png"
  cwebp -quiet -q "$4" "$tmp/$1.png" -o "$out/$1.webp"
}
# The phone's screen: Marcus's front-camera portrait at the phone's aspect.
still phone-marcus public/images/marcus-desk.png "crop=2752:1272:0:70,scale=1800:-2" 86
# The quality ladder: one moment, four generations of the same clip,
# cropped close on his face so the damage reads at thumbnail size.
for q in marcus-talk q-720 q-480 q-240; do frame "ladder-$q" "public/clips/$q.mp4" 4.8 "crop=iw*0.44:ih*0.66:iw*0.28:ih*0.02,scale=720:-2" 94; done
# How it works, from the real app.
frame step-ask $C/create.mp4 "$(mark create script-paste 2.4)" "scale=1600:-2" 88
still step-link $C/email.png "crop=1170:1560:0:0,scale=780:-2" 90
frame step-record $C/phone-landscape.mp4 "$(mark phone-landscape recording 4.6)" "scale=1800:-2" 88
still studio-shoulder public/images/poster-over-shoulder.png "scale=1800:-2" 84
frame live-arrived $C/live-desk.mp4 "$(mark live-desk arrived 1.5)" "scale=1600:-2" 88
frame delivery $C/submission.mp4 "$(mark submission specs 0.4)" "scale=1600:-2" 88
# Captions are served from our own origin (the bucket sends no CORS headers).
cp "out/$version/capsend.vtt" "$out/capsend-film.vtt"
rm -rf "$tmp"
ls -la "$out" | awk 'NR>3 {printf "%7.0f KB  %s\n", $5/1024, $9}'
