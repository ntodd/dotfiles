#!/usr/bin/env bash
# Builds the fake camera and microphone for the recipient's phone:
# marcus-idle forward then reversed (12 s, so the preview has something
# alive to show), then marcus-talk and marcus-more. Chrome loops these from camera start.
set -euo pipefail
cd "$(dirname "$0")/../public/clips"
out=../../.work/camera
mkdir -p "$out"
ffmpeg -hide_banner -loglevel error -y \
  -i marcus-idle.mp4 -i marcus-idle.mp4 -i marcus-talk.mp4 -i marcus-more.mp4 \
  -filter_complex "\
[0:v]fps=30,setpts=PTS-STARTPTS[a];[1:v]reverse,fps=30,setpts=PTS-STARTPTS[b];\
[2:v]fps=30,setpts=PTS-STARTPTS[c];\
[3:v]fps=30,setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=2[d];\
[a][b][c][d]concat=n=4:v=1:a=0,scale=3840:2160:flags=lanczos,format=yuvj420p[v];\
anoisesrc=color=brown:amplitude=0.22:sample_rate=48000,lowpass=f=900,atrim=0:12[ra];\
[2:a]aresample=48000,loudnorm=I=-18:TP=-4:LRA=9[rb];\
anoisesrc=color=brown:amplitude=0.22:sample_rate=48000,lowpass=f=900,atrim=0:8[rc];\
[ra][rb][rc]concat=n=3:v=0:a=1,aformat=channel_layouts=mono[au]" \
  -map "[v]" -q:v 3 -f mjpeg "$out/marcus.mjpeg" \
  -map "[au]" -c:a pcm_s16le -ar 48000 "$out/marcus.wav"
echo "camera: $(du -h "$out/marcus.mjpeg" | cut -f1) video, talk starts at 12.0s"
