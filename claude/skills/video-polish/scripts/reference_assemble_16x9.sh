#!/bin/zsh
# Full assembly (as shipped, 16:9): logo bumper -> talking head, music bed, ducked dialogue.
# Timeline (output seconds): line 0.2-0.8 | logo in 0.7-1.5 | speech at 3.0 (src 1.30) | dissolve 3.7-4.5 | fade out 63.4-64.1
cd "$(dirname "$0")/.."
FPS=600/19
ffmpeg -hide_banner -loglevel error -y \
  -f lavfi -i "color=c=0x12171c:s=1920x1080:r=$FPS:d=4.5" \
  -loop 1 -t 4.5 -i assets/logo_white_trimmed.png \
  -f lavfi -i "color=c=0x8df397:s=1100x4:r=$FPS:d=4.5" \
  -f lavfi -i "color=c=0x12171c:s=550x4:r=$FPS:d=4.5" \
  -ss 2.0 -t 60.4 -i preview_esrgan_1080p.mp4 \
  -ss 1.30 -t 61.1 -i work/cleanB.wav \
  -i assets/music/bed.mp3 \
  -loop 1 -t 13 -i assets/lower_third.png \
  -filter_complex "
    [0:v]null[bg];
    [3:v]split[cl][cr];
    [1:v]scale=1100:-1,format=rgba,fade=in:st=0.7:d=0.8:alpha=1[logo];
    [bg][2:v]overlay=x=410:y=685[b0];
    [b0][cl]overlay=x='410-550*clip((t-0.2)/0.6,0,1)':y=685:eval=frame[b0l];
    [b0l][cr]overlay=x='960+550*clip((t-0.2)/0.6,0,1)':y=685:eval=frame,vignette=angle=PI/4.5,noise=alls=7:allf=t+u[b1];
    [b1][logo]overlay=x='(W-w)/2':y=380:format=auto,fps=$FPS,format=yuv420p[bump];
    [4:v]fps=$FPS,format=yuv420p,fade=out:st=59.7:d=0.7[main];
    [bump][main]xfade=transition=fade:duration=0.8:offset=3.7[v0];
    [7:v]format=rgba,fade=in:st=6.0:d=0.5:alpha=1,fade=out:st=11.5:d=0.6:alpha=1,setpts=PTS-STARTPTS[lt];
    [v0][lt]overlay=x='96-40*(1-min(1,max(0,(t-6.0)/0.6)))':y=H-h-96:eval=frame:enable='between(t,6.0,12.2)'[v];
    [5:a]adelay=3000|3000[dlg];
    [6:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=8,volume=-14dB,atrim=0:64.1,afade=in:d=1.2,afade=out:st=62.1:d=2[m];
    [dlg]asplit[dv][sc];
    [m][sc]sidechaincompress=threshold=0.03:ratio=2:attack=250:release=1800:knee=6:makeup=1[md];
    [dv][md]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.9[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 18 -x264-params aq-mode=3:aq-strength=1.2 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest \
  "Deliverable_v1.mp4"
