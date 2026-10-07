"""Assemble bumper + talking head + ducked music + lower third for any aspect.

usage:
  uv run --quiet --with opencv-python --with "numpy<2" python3 build_video.py config.json [wide|square|vertical]

See example_config.json. All timings are output-timeline seconds. Layers:
  bg colour -> brand rule revealed by two bg-coloured "curtains" -> vignette + dither grain
  -> logo fade in -> xfade into graded footage -> lower third slide/fade -> fade to black
  dialogue (adelay to speech_at) + music (loudnorm -16, offset, gentle sidechain duck).

Aspect handling: square uses a static crop at the median face x; vertical uses a
crop x that follows the face track smoothed over ~7 s (piecewise-linear expr).
Face track is cached to <work>/face_track.json.
"""
import json, os, subprocess, sys
import numpy as np

cfg = json.load(open(sys.argv[1]))
A = sys.argv[2] if len(sys.argv) > 2 else "wide"
L = cfg["layout"][A]
FPS = cfg.get("fps", "600/19")
SRC, DLG, MUSIC, LOGO, LT = cfg["footage"], cfg["dialogue_wav"], cfg["music"], cfg["logo_png"], cfg["lower_third_png"]
T = cfg["timing"]
SRC_W, SRC_H = cfg.get("footage_size", [1920, 1080])
OW, OH = L["size"]
CW, CH = L["crop"]
work = cfg.get("work_dir", "work"); os.makedirs(work, exist_ok=True)

# ---------- face track (cached) ----------
tp = os.path.join(work, "face_track.json")
if not os.path.exists(tp):
    import cv2
    cap = cv2.VideoCapture(SRC); fps = cap.get(cv2.CAP_PROP_FPS); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    det = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    tr = []
    for f in range(0, n, int(fps)):
        cap.set(cv2.CAP_PROP_POS_FRAMES, f); ok, img = cap.read()
        if not ok: break
        faces = det.detectMultiScale(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), 1.1, 6, minSize=(200, 200))
        if len(faces):
            x, y, w, h = max(faces, key=lambda r: r[2]); tr.append([f / fps, float(x + w / 2), float(y + h / 2)])
    json.dump(tr, open(tp, "w"))
tr = np.array(json.load(open(tp)))
t_src, cx = tr[:, 0], tr[:, 1]

# ---------- crop filter ----------
if CW == SRC_W and CH == SRC_H:
    cropf = "null"
elif L.get("track", False):
    k = 7
    cxs = np.convolve(np.pad(cx, (k // 2, k // 2), mode="edge"), np.ones(k) / k, mode="valid")
    xs = np.clip(cxs - CW / 2, 0, SRC_W - CW)
    ts = t_src - T["footage_in"]          # main stream time starts at footage_in
    expr = f"{xs[-1]:.1f}"
    for i in range(len(ts) - 2, -1, -1):
        seg = f"({xs[i]:.1f}+({xs[i+1]:.1f}-{xs[i]:.1f})*(t-{ts[i]:.2f})/{(ts[i+1]-ts[i]):.2f})"
        expr = f"if(lt(t,{ts[i+1]:.2f}),{seg},{expr})"
    expr = f"if(lt(t,{ts[0]:.2f}),{xs[0]:.1f},{expr})"
    cropf = f"crop={CW}:{CH}:x='{expr}':y=0"
else:
    x0 = float(np.clip(np.median(cx) - CW / 2, 0, SRC_W - CW))
    cropf = f"crop={CW}:{CH}:{x0:.0f}:0"

# ---------- geometry ----------
LOGO_W = L["logo_w"]; LOGO_Y = L["logo_y"]; LINE_Y = L["line_y"]
LINE_X = (OW - LOGO_W) // 2; HALF = LOGO_W // 2; CXo = OW // 2
LT_SCALE, LT_X, LT_BOTTOM = L["lt_scale"], L["lt_x"], L["lt_bottom"]
BG, ACCENT = cfg["bg_hex"], cfg["accent_hex"]

bump_len = T["dissolve_at"] + T["dissolve_len"]
foot_len = T["footage_out"] - T["footage_in"]
total = T["dissolve_at"] + foot_len
speech_at = T["speech_at"]; lt_in, lt_out = T["lower_third_in"], T["lower_third_out"]
fade_out_st = foot_len - T["end_fade"]

fc = f"""
[0:v]null[bg];
[3:v]split[cl][cr];
[bg][2:v]overlay=x={LINE_X}:y={LINE_Y}[b0];
[b0][cl]overlay=x='{LINE_X}-{HALF}*clip((t-0.2)/0.6,0,1)':y={LINE_Y}:eval=frame[b0l];
[b0l][cr]overlay=x='{CXo}+{HALF}*clip((t-0.2)/0.6,0,1)':y={LINE_Y}:eval=frame,vignette=angle=PI/4.5,noise=alls=7:allf=t+u[b1];
[1:v]scale={LOGO_W}:-1,format=rgba,fade=in:st=0.7:d=0.8:alpha=1[logo];
[b1][logo]overlay=x='(W-w)/2':y={LOGO_Y}:format=auto,fps={FPS},format=yuv420p[bump];
[4:v]{cropf},scale={OW}:{OH}:flags=lanczos,fps={FPS},format=yuv420p,fade=out:st={fade_out_st:.2f}:d={T['end_fade']}[main];
[bump][main]xfade=transition=fade:duration={T['dissolve_len']}:offset={T['dissolve_at']}[v0];
[7:v]scale=iw*{LT_SCALE}:-1,format=rgba,fade=in:st={lt_in}:d=0.5:alpha=1,fade=out:st={lt_out-0.6:.2f}:d=0.6:alpha=1,setpts=PTS-STARTPTS[lt];
[v0][lt]overlay=x='{LT_X}-40*(1-min(1,max(0,(t-{lt_in})/0.6)))':y=H-h-{LT_BOTTOM}:eval=frame:enable='between(t,{lt_in},{lt_out})'[v];
[5:a]adelay={int(speech_at*1000)}|{int(speech_at*1000)}[dlg];
[6:a]aformat=sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=8,volume={cfg['music_db']}dB,atrim=0:{total:.2f},afade=in:d=1.2,afade=out:st={total-2:.2f}:d=2[m];
[dlg]asplit[dv][sc];
[m][sc]sidechaincompress=threshold=0.03:ratio=2:attack=250:release=1800:knee=6:makeup=1[md];
[dv][md]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.9[a]
"""
out = cfg["output_prefix"] + ("" if A == "wide" else f"_{A}") + ".mp4"
cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
       "-f", "lavfi", "-i", f"color=c=0x{BG}:s={OW}x{OH}:r={FPS}:d={bump_len}",
       "-loop", "1", "-t", str(bump_len), "-i", LOGO,
       "-f", "lavfi", "-i", f"color=c=0x{ACCENT}:s={LOGO_W}x4:r={FPS}:d={bump_len}",
       "-f", "lavfi", "-i", f"color=c=0x{BG}:s={HALF}x4:r={FPS}:d={bump_len}",
       "-ss", str(T["footage_in"]), "-t", f"{foot_len:.3f}", "-i", SRC,
       "-ss", str(T["dialogue_in"]), "-t", f"{total - speech_at:.3f}", "-i", DLG,
       "-i", MUSIC,
       "-loop", "1", "-t", str(lt_out + 1), "-i", LT,
       "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
       "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-x264-params", "aq-mode=3:aq-strength=1.2",
       "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", out]
subprocess.run(cmd, check=True)
print("wrote", out)
