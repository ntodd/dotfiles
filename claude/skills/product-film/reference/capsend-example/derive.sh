#!/usr/bin/env bash
# Derived footage for the "every app squeezes it" beat: Marcus's clip
# re-encoded the way messaging apps crush video, at 1080p so the edit can
# cross-fade between generations in sync.
set -euo pipefail
cd "$(dirname "$0")/../public/clips"
src=marcus-talk.mp4
q() { # name width height crf fps scaler
  ffmpeg -hide_banner -loglevel error -y -i "$src" \
    -vf "fps=$5,scale=$2:$3,format=yuv420p" -c:v libx264 -crf "$4" -preset veryfast -an /tmp/_q.mp4
  ffmpeg -hide_banner -loglevel error -y -i /tmp/_q.mp4 \
    -vf "fps=30,scale=1920:1080:flags=$6,format=yuv420p" -c:v libx264 -crf 16 -preset slow -an "q-$1.mp4"
  echo "q-$1.mp4"
}
q 720 1280 720 30 30 bicubic
q 480 854 480 38 24 bicubic
q 360 640 360 44 15 bilinear
q 240 426 240 49 10 neighbor
# The clip as it arrived over text: sideways and crushed.
ffmpeg -hide_banner -loglevel error -y -i "$src" \
  -vf "transpose=2,fps=15,scale=240:426,format=yuv420p" -c:v libx264 -crf 44 -preset veryfast -an /tmp/_s.mp4
ffmpeg -hide_banner -loglevel error -y -i /tmp/_s.mp4 \
  -vf "fps=30,scale=540:960:flags=bilinear,format=yuv420p" -c:v libx264 -crf 18 -an sideways.mp4
echo sideways.mp4
# The last frame of marcus-talk, so marcus-more can continue from it.
ffmpeg -hide_banner -loglevel error -y -sseof -0.05 -i "$src" -frames:v 1 -update 1 ../images/marcus-talk-end.png
echo ../images/marcus-talk-end.png
