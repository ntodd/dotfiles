---
name: video-polish
description: >-
  Use when asked to clean up, polish, or "make professional" a talking-head or
  interview video: remove hum/noise from dialogue, fix flat or backlit picture,
  upscale low-res footage, add a logo bumper/intro, add a music bed ducked under
  speech, add a lower third, trim dead air at the head/tail, and deliver 16:9
  plus square and vertical versions. Triggers on "clean up this video", "fix the
  audio", "remove the hum", "add a logo intro", "add music", "lower third",
  "vertical crop", "square version", or any ffmpeg-based video edit. Pure CLI:
  ffmpeg + uv-run Python (DeepFilterNet, Real-ESRGAN, Pillow). No NLE needed.
---

# Video polish pipeline (talking head / interview)

First proven on a client job (Sep 2026): 63 s iPhone talking head shot in an
office with a steady mechanical hum, 1024x576, muffled mic. Delivered 1080p 16:9,
1:1 and 9:16 with a logo bumper, ducked music bed and lower third, entirely
with ffmpeg and `uv run` Python on an M-series Mac. Whole thing took one
evening. Scripts in `scripts/` are generalized copies of what shipped.

## Workflow (in this order)

1. **Probe, don't guess.** `ffprobe` streams; `ebur128` loudness; render a
   spectrogram (`showspectrumpic`) and *look at it*; FFT the speech-free head
   of the clip to find tonal hum frequencies exactly (`scripts/analyze_audio.py`).
   Grab frames at 3 points and measure face / window / frame RGB before
   grading.
2. **Audio cleanup** → `scripts/clean_audio.sh`. Deliver a preview mux for the
   user to listen to before anything else. Audio is what they notice first.
3. **Picture** → `scripts/grade.txt` (ffmpeg chain) and, if the source is soft
   or low-res, `scripts/esrgan_video.py` (Real-ESRGAN 2x on Metal GPU).
   Always produce a before/after still and a face-crop upscaler comparison.
4. **Assets**: logo (see Logo section), music (see Music section), fonts.
5. **Lower third** → `scripts/make_lower_third.py` (Pillow PNG; ffmpeg may
   lack `drawtext`).
6. **Assembly** → `scripts/build_video.py` with a JSON config. Builds every
   aspect from the same layers. Never crop the finished 16:9 for social.
7. **Verify with measurements**: durations match, speech onset lands where
   intended, ebur128 of the final, stills at bumper / dissolve / lower third.
   Zoom crops with `eq=gamma=2.2` to inspect dark-background artifacts.
8. **Record decisions** (memory + notes) as the user approves levels.

## Audio: what worked

**Diagnosis.** Jet/HVAC "hum" is usually one or two steady tones plus low
rumble, not broadband noise. On that clip: 409.3 Hz (+819 Hz harmonic),
60 Hz mains, rumble < 80 Hz. Speech-to-noise was 14 dB. Phone/laptop mics are
band-limited: little above 2.5 kHz, hard cut at 10 kHz from the AAC encoder.
You cannot recover HF that isn't there; a presence lift is the best you get.

**Two candidates, pick by measurement.**
- A: pure ffmpeg. Fold to mono, HPF, narrow `equalizer` notches at every hum
  peak (Q 30–40, -20 to -30 dB), `afftdn` with the noise profile sampled from
  the speech-free head via `asendcmd ... afftdn@nr sn start/stop`. Got SNR
  14 → 27 dB.
- B: **DeepFilterNet3** neural denoise, then the same post chain. Got SNR
  14 → 46 dB with no tonal residue. This is the default now. Cap attenuation
  (`atten_lim_db=30`) so word gaps keep some room tone and it doesn't sound
  gated.

**Post chain after denoise** (`scripts/post_chain.txt`): HPF 100 Hz x2 (male
voice fundamental ~110 Hz is safe), residual notch at the hum freq (-12 dB),
mud cut 220 Hz -2.5 dB, presence +4 dB @ 3.2 kHz, air +2.5 dB @ 6.5 kHz,
`acompressor` -22 dB 3:1 attack 8 ms release 180 ms, `loudnorm I=-16 TP=-1.5`.

**Music bed and ducking (user-approved numbers).**
- Normalize the music to -16 LUFS first (tracks arrive anywhere from -10 to
  -18), then offset. **-14 dB** under the -16 LUFS dialogue was right; -11 dB
  was "too loud".
- `sidechaincompress threshold=0.03 ratio=2 attack=250 release=1800 knee=6`.
  The first attempt (ratio 6, attack 40, release 600) was "too strong,
  dramatic transitions". Gentle 2:1 with slow attack/release reads as the bed
  easing, not pumping. Final mix landed at -15.4 LUFS integrated.
- Music fades in over 1.2 s from frame 0, fades out over 2 s ending with the
  picture. Speech gets `adelay` to its start time on the timeline.
- Build a 60 s **audition reel** (12 s of dialogue per candidate track, same
  mix settings) so the user compares music in context instead of opening
  files.

## Picture: what worked

- Source was flat, soft, backlit (cool window vs warm face). Face luma was
  fine on average; the fix is contrast shape and colour, not exposure.
- Chain: light `hqdn3d` *before* upscaling, ~6% crop biased downward to lose
  ceiling, `curves` S-curve with highlight roll-off (window) and a slight red
  pull on mids, `eq contrast=1.06 saturation=1.03`, soft `vignette`, lanczos
  to 1080p, mild `unsharp` (0.35 after ESRGAN, 0.6 after lanczos).
- **Real-ESRGAN x2 on Apple GPU** (`device='mps'`): 0.41 s/frame on an M5 Max,
  ~17 min for 2000 frames. CPU was 10 s/frame. **Benchmark on MPS before
  quoting a runtime**; I said "hours" and was wrong. My pixel-level read was
  "modest": cleaner edges, less blocking, slightly plastic skin. The user's
  reaction watching it in motion was "impressive". Trust the moving picture
  over the still comparison; do the upscale by default when the source is
  under 1080p. Topaz became unnecessary.
- Pipe frames: ffmpeg rawvideo → Python → ffmpeg encoder. VFR sources produce
  more output frames than `nb_frames` says; check duration, not frame count.

## Logo usage

- Search the org's site for `/wp-content/uploads/` assets. A JPG in a page
  often has siblings: probe `_White_`/`_Black_`, `.png`/`.svg` variants at the
  same path. The white-on-transparent PNG is what a dark bumper needs.
- **Trim the PNG to its alpha bounding box** before centering. A "NoPadding"
  file still had 49 px of transparent padding on one side and the mark read
  off-centre. Measure centres on the rendered frame afterwards.
- Sample the brand accent colour from the logo pixels, not from the website
  CSS. (The site's CSS accent was a different colour from the mark's.)
- If only a small logo exists, Real-ESRGAN on the *alpha channel* (x2 twice)
  upscales cleanly; vector would be better if obtainable.
- Ask the client for a brand pack; scraped assets are a fallback.

## Bumper design that was approved

Dark `#12171c` background, brand-colour rule draws outward from centre
(0.2–0.8 s), logo fades in (0.7–1.5 s), speech starts *over the logo* at
3.0 s, 0.8 s dissolve into the talking head at 3.7 s. Cut dead air: dialogue
starts at speech onset (skip phone tap and lip-lick); the picture joins ~0.7 s
later at a steady frame, same source time offset so sync holds. End: fade to
black before the reach for the phone.

**ffmpeg gotchas hit here**
- `crop` and `scale` cannot animate width per frame with `t`. Reveal a line
  with two background-coloured "curtains" whose `overlay` x uses `t`
  (`eval=frame`).
- Apply `vignette` *after* compositing the curtains, or they show as a lighter
  strip. Then add `noise=alls=7:allf=t+u` to dither near-black gradients and
  encode with `-x264-params aq-mode=3:aq-strength=1.2`; otherwise 8-bit
  banding.
- Homebrew ffmpeg may lack `drawtext`; render text to PNG with Pillow.
- `xfade` needs identical fps/size/pixfmt on both inputs; force `fps=` and
  `format=yuv420p` on each.
- In zsh, `$VAR:s=...` inside a sed argument is parsed as a history modifier
  and silently mangles the command. Use Python for script edits.

## Lower third

Avenir Next (system font `.ttc`, `set_variation_by_name`), name 64 px demi-
bold, title 34 px medium, 8 px brand-colour bar, soft drop shadow (blurred
alpha copy) for legibility over a light shirt. **Draw the bar from the text's
alpha bbox top to bottom**, not canvas-centred. Slide 40 px + fade 0.5 s in
at 6.0 s (≈1.5 s after the dissolve), out 11.5–12.2 s. Title wording must
match how the speaker introduces themself on camera; listen to the audio
before rendering (wrong title and wrong title order both got caught in review).

## Square and vertical

Rebuild from layers per aspect (`scripts/build_video.py`). Detect the face
every 1 s with OpenCV Haar (`minSize=(200,200)`), cache to JSON. Square:
static crop at median face x. Vertical (608 px wide from 1080p): crop x
follows the face track smoothed with a 7 s moving average, emitted as a
nested `if(lt(t,..))` piecewise-linear expression. Enlarge the lower third
(1.1x square, 1.3x vertical) and keep it ≥320 px off the bottom on vertical
for platform UI.

## Music sourcing

- **Mixkit** (Envato) has direct MP3s: scrape tag pages for
  `assets.mixkit.co/music/<id>/<id>.mp3` and titles. Free commercial license,
  no attribution; license text is JS-rendered, tell the user to confirm.
- **Pixabay** and **Chosic** block curl; user downloads manually (Pixabay
  Content License, no attribution). Free Music Archive needs per-track pages.
- Good talking-head beds are tagged Underscore / Corporate / Relaxed /
  Positive, 90–100 s. Avoid Brass/Propulsive.

## Environment notes

- `uv run --with ...` for everything Python; system python3 has no numpy.
- DeepFilterNet pins: `torch==2.1.2 torchaudio==2.1.2 soundfile` on py3.11.
- Real-ESRGAN pins: `torch==2.1.2 torchvision==0.16.2 realesrgan "numpy<2"
  opencv-python`.
- Read the Gmail/Drive/Dropbox connectors for client-sent assets before
  scraping the web.
