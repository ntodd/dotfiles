---
name: product-film
description: >-
  Use when asked to make a product video, launch film, explainer, promo, or
  "marketing video" for a software product, especially one that should show
  the real app, have a voiceover, music, and polished motion, and be
  regenerable from a script. Covers scripting, AI voiceover and music
  (OpenRouter: Gemini TTS, Lyria), AI people and b-roll (Gemini image, Veo),
  recording the real app with Playwright (high-DPI screencast, fake camera,
  cursor), editing in Remotion (timeline fitted to the music, transitions,
  virtual camera), mastering, AI review loops, versioned exports, and
  featuring the film on a marketing site. Triggers on "make a product video",
  "promo video", "launch video", "explainer video", "demo video for the site",
  "video for our landing page".
---

# Product film pipeline

A 60-90 second product film built as code: `script.yaml` drives the edit, every
asset is generated or recorded by a script, and a change to one line re-flows
the whole timeline. First built for CapSend (Sep 2026): 77 s, ~$10 of API
spend, 8 AI-reviewed cuts, then featured on the marketing site. The worked
example lives in `reference/capsend-example/`; the story of that build and its
review scores is in `reference/case-study.md`.

Start a new film with `scripts/new-film.sh <dir>`, which copies `template/`
(generators, timeline builder, screencast rig, Remotion components, two
starter scenes) and installs it. `npm run dry-run` renders the template with
free placeholders (macOS `say` VO, a click-track bed) before anything is spent.

## Gate 0: the API key (do this before any generation)

All generation goes through OpenRouter. Before calling any paid model:

1. **Ask the user for a dedicated OpenRouter key with a credit limit AND an
   expiration.** Suggest $15-30 and 7-14 days, created at
   https://openrouter.ai/settings/keys for this project only. Do not accept an
   unlimited or non-expiring key; explain why (a leaked or runaway loop can't
   spend more than the cap, and the key dies on its own).
2. Put it in the project's `.env` (gitignored; never echo it, never commit it,
   never pass it to other tools or hosts).
3. Run `scripts/check-openrouter-key.sh <dir>/.env` (or `npm run check-key`).
   It refuses a key without a limit, without an expiry, expiring more than
   31 days out, or that is a management key, and prints remaining budget.
   Proceed only on `OK`.
4. Every paid call is appended to `.work/costs.jsonl`; recheck the key's
   remaining budget before expensive steps (video generation), and tell the
   user the running total at milestones.
5. When the film ships, suggest the user delete the key.

Also ask before creating infrastructure (buckets, apps) or publishing
anything. Never upload review screenshots to storage; PR images go up with
`gh pr create|edit|comment --attach`.

## Tools

| Job | Tool | Notes |
| --- | --- | --- |
| Voiceover | `google/gemini-3.8-flash-tts` via `/api/v1/audio/speech` | `response_format: "pcm"` only (24 kHz s16le); style via `provider.options["google-ai-studio"].speech_metadata.style`. Voice **Puck** won for a US audience; MiniMax `speech-2.8-hd` `English_expressive_narrator` (British) scored highest overall. |
| Music | `google/lyria-3-pro-preview` (~$0.08/song, ~90 s) | Chat completions with `modalities: ["text","audio"]` and `stream: true` (required); returns MP3 in `delta.audio.data`. |
| Stills | `google/gemini-3-pro-image` (~$0.14) | `modalities: ["image","text"]`, `image_config: {aspect_ratio, image_size: "2K"}`; pass a reference image for consistency. |
| Video | `google/veo-3.1-fast` ($0.10/s 1080p, $0.12/s with audio), `veo-3.1-lite` ($0.05/s) | `POST /api/v1/videos`, poll `polling_url`, download `unsigned_urls[0]`. `frame_images` with `first_frame`/`last_frame`. List all models + prices: `GET /api/v1/videos/models`. |
| Listening / watching QA | `google/gemini-3.8-flash` (audio + video input) | Cheap (~$0.02/review). Send a 720p proxy, not the master. |
| App capture | Playwright + CDP `Page.startScreencast` | See Capture. |
| Edit | Remotion 4 (React) | `OffthreadVideo`, `Audio` with per-frame volume, `trimBefore`. |
| Audio analysis | `librosa` via `uv run` | Beats, bars, drop, ending hit. |
| SFX | numpy synthesis (`pipeline/make_sfx.py`) | Clean, license-free pops, whooshes, clicks, chimes. |
| Everything else | ffmpeg (no libwebp: use `cwebp`), `uv`, `gh` | |

Models and prices change. Re-list before choosing:
`curl -s "https://openrouter.ai/api/v1/models?output_modalities=all"` and the
videos endpoint above. Check `docs/voice-auditions.md` style results before
recasting.

## Workflow

### 1. Discover the product (no spend)

Read PRODUCT.md / DESIGN.md / README / the marketing page. Screenshot-tour the
running app with Playwright. Write down: the buyer, the pain, the mechanism
only this product has, the honest claims (no invented customers, logos,
metrics, prices), brand tokens, and the product's own words. Invent a
fictional company and people for the demo and say so.

### 2. Script (`script.yaml`)

The structure that worked (~150 words of VO for ~75 s):

1. **Hook** (≈8 s): the pain, dramatized in UI (e.g. a message thread going
   wrong across apps). Plain, a little wry.
2. **Degrade/agitate** (≈7 s): show the cost, then "it could have been better".
3. **Reveal** on the music's **drop**: logo + one-line promise.
4. **Demo scenes** (3-5): each VO line names what the footage shows, in the
   order it appears.
5. **Proof**: the result (the artifact, specs, handoff).
6. **Scale** line, then **end card** whose last word lands on the music's
   final hit, CTA + URL.

Per-scene knobs: `lead`, `tail`, `min`, `in` (dissolve), `in_style: dip`,
`breathe`, `component`, `dark`, `on_screen`. Leave a ~1.5 s gap after a
recording scene's VO if you want a person's real voice to be heard (see Edit).

### 3. Voice

Audition 6-10 voices on one representative line, then have Gemini rank them
(`pipeline/review.ts` style prompt: transcribe, flag brand-name
mispronunciation, score naturalness/warmth/energy). Pick by audience. Generate
per scene (`npm run voice`, cached by text + voice), trim silence, measure
speech segments (`silencedetect`) so on-screen text can hit real phrase
boundaries. Run `npm run review -- vo`.

### 4. Music

`npm run music -- --takes 3` ($0.24), `npm run review -- music` (it describes
structure with timestamps and catches vocal chops), `npm run music:pick -- N`
(also runs beat/drop/ending-hit analysis). Trust the measured drop over the
reviewer's guess.

### 5. People and footage

Generate a still, check it, then animate it with image-to-video so the same
person appears across shots. Contact-sheet every clip (ffmpeg `tile`) and
reject bad ones. Budget: ~$5-8 for 10-20 clips. Rules that saved retakes:

- "This image IS the phone's view: no phone, tripod, or camera anywhere." Veo
  otherwise paints phones into selfie shots (it did, three times).
- "Front-camera smartphone video" makes Veo Lite add phone UI; describe the
  shot as "filmed from the point of view of the camera he is speaking into".
- For a person who must talk on cue: Veo Fast with audio and the exact line in
  quotes; measure word timing with `silencedetect` (the transcriber's
  timestamps were 0.7 s off).
- `last_frame` = `first_frame` makes a seamless idle loop; a continuation clip
  from an extracted last frame extends a take past 8 s.
- AI b-roll of people reacting reads as stock next to real UI; reviewers
  flagged it every time. Default `options.broll: false`.

### 6. Record the real product

Run an **isolated instance** (own database, storage, port) seeded with the
fictional company; never touch the user's dev data. `reference/capsend-example/demo/`
has a Phoenix harness (`server.exs`, `seed.exs`, `record.mjs`, `capture.sh`).

- **Resolution:** CDP screencast frames come back in CSS pixels. Launch
  Chromium with `--force-device-scale-factor=2` (desktop, 1280x800 viewport)
  or `=3` (phone, 390x844) to get 2560x1600 / 1170x2532 frames.
- `demo/lib/screencast.mjs` rebuilds CFR 30 fps video from timestamped
  frames, drops frames of a different size (rotation), and writes named
  markers with the on-screen box of the element in focus.
- `demo/lib/actor.mjs`: visible cursor that glides with easing and a slight
  arc; smooth wheel scrolling that keeps targets clear of sticky bars; taps
  never scroll (fixed phone UIs).
- **Fake camera:** Chrome `--use-file-for-fake-video-capture=x.mjpeg` and
  `--use-file-for-fake-audio-capture=x.wav` (build with ffmpeg; MJPEG, not
  y4m). The file starts when the camera opens: prepend an idle lead-in (idle
  clip forward + reversed) and time the Record tap so the countdown ends as
  the person starts talking. Loudnorm the speech (Veo audio clipped the app's
  quality check); keep the idle room tone above the app's mic-silence
  threshold. Feed 4K if the story claims 4K.
- **Phones:** stub `requestFullscreen` (headless fullscreen corrupts the
  screencast; iPhone Safari lacks it anyway) and set
  `Emulation.setSafeAreaInsetsOverride` (59/59/0/21 in landscape) so the app
  clears the Dynamic Island like it does on a real phone. Rotate with
  `setViewportSize`.
- Verify in the captured app that its own quality checks say "Looks good" and
  specs match the claims before editing around them.

### 7. Timeline (`npm run timeline`)

`pipeline/build-timeline.ts`: scene = lead + VO + tail (≥ min); the reveal
starts on the drop; the last line ends on the ending hit; whole 4-bar phrases
of music are cut (or repeated) at the join with the closest energy match;
the remainder is spread by `breathe` weights; cuts after the drop snap to
beats. Map the ending hit through the music edit (a bug here made an 8 s end
card).

### 8. Edit (Remotion)

Components in `template/src/components`: `DesktopShot` (browser window +
virtual camera zooming to marker boxes, clip lists with speed and dissolves,
optional highlight rings/labels), `Phone` (portrait/landscape with island),
`Background` (light/studio blend), `Words` (masked kinetic type), `Broll`,
`Captions`. Scenes live in `src/scenes` and register in `src/Main.tsx`.

What made it smooth (v1 → v2 of CapSend):

- Dissolve between scenes (`in: 0.45-0.6`); use `in_style: dip` where two busy
  frames would ghost, with a slight overlap so no frame is empty.
- Never jump-cut a UI recording under a moving camera. Either play it
  continuously with speed ramps (keyframes pin capture moments to VO beats;
  cap around 3x and slow scrolls below 1x) or dissolve between shots.
- Camera moves ~0.95 s ease-in-out; springs relaxed (`SOFTEN` in theme.ts).
- Hand off matching elements across scenes: start the next scene's phone
  exactly where the last one was; carry the same scale and position into a
  split screen; dissolve the lock screen into the app.
- Highlight boxes and label pills on UI read as clutter; default
  `options.highlights: false`, let the camera do the pointing.
- Keep product footage continuous: if a person must keep talking past the
  take, generate more footage rather than looping.
- A person's real voice for one line, lip-synced, in a VO gap, adds life.
  Measure the recording's lag against the source (ours was 30-50 ms).
- Ducking: music 0.55 alone, 0.14 under VO, 0.25 s attack, 0.45 s release;
  SFX gain ~1.25. Loudnorm the master to -14 LUFS / -1 dBTP.

### 9. Review loop (bounded)

Each round: render (`npm run render -- quick`), then:

1. **Stills** at scene midpoints and **frame strips** around every boundary
   (7 frames, -0.3 s to +0.6 s) to see jumps and empty frames yourself.
2. **Gemini video review** (`npm run review -- video out/...`): blunt,
   timestamped MUST FIX / NICE TO HAVE and a score. It's noisy (scores swing
   ±1) and **deaf to SFX in video**: when it says "no sound design", send the
   audio alone and ask it to list effects; ours heard 19, "balanced".
3. For a pacing pass, send v1 and v2 together and ask only about motion.
4. Fix real notes in a batch; reject notes that contradict the brief or the
   user (e.g. it wanted autoplay; the user wanted a still poster).

CapSend went 7.5 → 6.8 → 7.8 → 8.8 → 8.8 → 7.8 → 9.2 across cuts; stop when
the must-fix list is small and specific.

### 10. Render, version, publish

`VERSION=v2 npm run render` writes `out/v2/` (film, captioned film, VTT,
poster) and never touches earlier versions; keep every approved cut. To put
it on a site: `npm run publish -- v2` encodes a 1080p web copy (CRF 21,
faststart) and uploads to a **separate public bucket** (Tigris:
`fly storage create -n <name>-media --public`, not attached to the app, never
the private uploads bucket) with immutable caching under a versioned key.

Commit the project's source, not its media: gitignore `public/` (hundreds of
MB, rebuildable), keep the small `src/generated/` JSON so the edit
typechecks, and add the project to the app's `.dockerignore` so a local
deploy never ships the media or the project's `.env` to the builder.

### 11. Feature it on the site

What the user liked: a poster (not a full-width autoplay hero) with a play
button, and pressing play **dims the page** and lifts the player into a
theater. The CapSend implementation (PR #22) is the reference:

- `<dialog>` + `showModal()` for focus trapping and Escape; its own backdrop
  element for the dim; WAAPI lift from the poster's rect; reverse on close;
  plain fade under reduced motion.
- `<video data-src>`: set `src` on first play so the page never downloads
  30 MB up front; `play()` inside the click so sound is allowed.
- Reuse the app's own player controls if it has them; add a captions toggle.
- Add the media origin to CSP `media-src` and `img-src`; serve the VTT from
  your own origin (public buckets usually send no CORS headers).
- Poster: an AI portrait of the film's person inside the product's own device
  frame; keep the play disc off the face.
- Real captures in browser frames with phone-width detail crops via
  `<picture>`; embed provenance for every raster.
- Ship the site change as a PR with screenshots attached via `gh --attach`.

## Costs (CapSend, actual)

| Item | Cost |
| --- | --- |
| Veo clips (26 generated, incl. rejects and re-dos) | $8.36 |
| Gemini stills (7, plus posters) | $0.97 |
| Music (3 takes) | $0.24 |
| Voiceover (12 auditions, all lines) | ~$0.05 |
| AI reviews and transcriptions (~20) | ~$0.40 |
| **Total** | **~$10** |

## Pitfalls, fast

`reference/lessons.md` has the full list with symptoms and fixes. The ones
that cost the most time: DPR-less screencasts; the fake camera loop drifting
against the countdown; headless fullscreen zoom; a mid-rotation frame setting
the whole video's size; smooth-scroll helpers that also fired on phone taps
(0.8 s tap lag); unlayered CSS overriding Tailwind utilities; lazy images blank
in full-page screenshots (scroll first); a non-reloading capture server
serving stale templates; a take shorter than the edit needed (the review
screen appeared early).
