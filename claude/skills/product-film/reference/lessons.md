# Lessons from the CapSend film

Each entry: what went wrong or what worked, why, and what to do. Grouped by
phase. These are the things that cost real time the first time.

## API and budget

- **OpenRouter audio output requires `stream: true`.** A non-streaming Lyria
  or gpt-audio request returns `400 Audio output requires stream: true`.
- **Gemini TTS only returns PCM.** `response_format: "mp3"` fails; ask for
  `pcm` and wrap it with ffmpeg (`-f s16le -ar 24000 -ac 1`).
- **gpt-audio (chat) ad-libs** unless the system prompt says "read the text
  exactly, word for word". Dedicated TTS models are steadier and cheaper.
- **Video pricing isn't in `/models`.** Use `GET /api/v1/videos/models` for
  `pricing_skus`, supported durations, resolutions, and frame-image support.
- **The key's balance is the truth.** The local ledger missed early ad-hoc
  calls; `GET /api/v1/key` shows actual usage.

## Voice

- Judging voices by ear isn't possible for the agent; Gemini with audio input
  gave consistent, specific rankings (and caught a swallowed first word).
- Generate per scene, cached by (text, voice). Trim silence at both ends so
  timing follows the words, then store `silencedetect` speech segments so
  on-screen text can hit phrase boundaries.

## Music

- Ask for structure explicitly: sparse intro (~12 s), riser, drop, steady
  groove with lifts, final lift and a clean ending hit, "leave room in the
  mids", "no vocal chops". One of three takes still had vocal chops.
- Measure, don't trust: the reviewer said the drop was at 0:12; librosa
  energy said 0:16. The timeline uses the measured drop.
- Cutting whole 4-bar phrases where energy matches on both sides of the join
  (with a 40 ms equal-power crossfade) was inaudible.

## People and footage

- Generate a still first, check it, then image-to-video. Keeps the face
  consistent across the talking clip, idle clip, continuation, posters.
- The "camera view" still came back with a phone on a tripod in frame; say
  outright that the image IS the camera's view.
- Veo Lite added phone UI (a phone in frame, record buttons) to "front-camera
  smartphone video" prompts, 3 of 14 times. Veo Fast plus "filmed from the
  point of view of the camera he is speaking into... nothing between him and
  the lens" fixed it.
- An 8 s talking clip is short. A first/last-frame-locked idle clip
  (forward + reversed = 12 s) gives a lead-in; a continuation clip generated
  from the talking clip's extracted last frame extends it seamlessly.
- Transcription timestamps were ~0.7 s off; `silencedetect` at -30 dB found
  exact word gaps. Confirm a slice by transcribing just that slice.

## Recording the app

- **DPR:** `Page.startScreencast` returns CSS-pixel frames even with
  `deviceScaleFactor: 2` in the context. `--force-device-scale-factor=N` on
  the browser launch fixes it (works with mobile emulation too).
- **Frame sizes:** after `setViewportSize` (rotation) the first frame can be
  the old shape, and ffmpeg sizes the whole video from frame one. Wait for the
  new state, and drop frames whose device size differs from the last frame.
- **Tap lag:** a scroll-into-view helper (wheel events + waits) on fixed
  phone UIs added ~0.8 s to every tap and threw off the countdown timing.
  Taps don't scroll.
- **Sticky footers eat clicks:** `scrollIntoViewIfNeeded` parks elements at
  the viewport edge, under a sticky action bar, and the click hit "Create &
  send". Smooth-scroll to ~45% height when an element is near an edge.
- **Select-all:** `ControlOrMeta+a` selected the whole page; use
  `locator.selectText()`.
- **Autocomplete:** "Pri" matched "Daniel Price" before "Priya"; type the full
  first name and assert the chip.
- **Fake camera timing:** the MJPEG starts when the camera opens. Idle lead-in
  + tap Record at `cameraOn + talkAt - countdown`. Measure the recorded file's
  lag against the source audio afterwards (30-50 ms here).
- **Fullscreen:** the recorder went fullscreen on Record; headless fullscreen
  zoomed the screencast. Stub `requestFullscreen` (true to iPhone Safari).
- **Safe areas:** without `Emulation.setSafeAreaInsetsOverride`, the app put
  the teleprompter under the (composited) Dynamic Island. With 59/59/0/21 the
  app laid itself out like on a real phone.
- **App quality checks are a free QA:** "Audio is quiet (-50 LUFS)" on seeded
  clips (room tone too low), "Audio may be clipping" on Veo audio (loudnorm
  it), "Lower resolution than requested" if the fake camera is below the
  request's quality. The mic check also needs RMS above its threshold during
  the idle lead-in.
- **Take length:** skipping into the take to lip-sync a later line consumed
  the footage; the review screen then showed during "It sends while they
  talk". Record long enough for every downstream use.
- **Isolation:** a second instance on :4010 with its own DB (`cap_send_video`)
  and storage, configured by overriding app env before start, kept the user's
  dev server untouched. Its code reloader is off: restart it after template
  changes or screenshots show the old page.

## Edit

- Timeline from the music, not the other way round: reveal on the drop, last
  word on the ending hit, phrase cuts, beat-snapped scene boundaries.
- Scene overlaps: extend the outgoing scene by the incoming dissolve and fade
  both. Dips (out, then in) for busy frames; overlap them ~12% so the frame is
  never empty (an empty light frame between dark scenes reads as a flash).
- Jump cuts inside a UI recording read as glitches when the page scrolled in
  between. Continuous speed ramps (keyframed to VO beats) or dissolves.
- A virtual camera that frames marker boxes (element rects recorded at
  capture time) survives re-recording; hard-coded crops don't.
- Speed ramps above ~3x look frantic; scrolls should play near or below 1x
  with the camera already wide.
- Highlight rings + label pills were called distracting by the user;
  zooming is enough.
- `Words` with `*asterisks*` for accent must track multi-word spans.
- Remotion: `trimBefore` (not `startFrom`), `layout="none"` Sequences for
  clip lists, `<Loop>` for short clips on a wall (they freeze on their last
  frame otherwise), `useVideoConfig().durationInFrames` is the Sequence's.

## Review

- A bounded loop worked: stills + boundary frame strips for my own eyes,
  then Gemini on a 720p proxy with the script and storyboard. Two rounds of
  fixes per review target, then ship.
- The video reviewer never hears SFX; check audio separately.
- Reviewer notes conflict across rounds (match the headline to the VO;
  then: remove the headline). Decide with the brief.
- A dedicated A-vs-B motion comparison found jumps a single-cut review missed.

## Site

- The film on a public bucket; never make the private uploads bucket public.
- CSP: add the media origin to `media-src` and `img-src`.
- `<track>` from a cross-origin bucket needs CORS; serving the VTT from the
  app is simpler.
- Unlayered CSS (e.g. `.x { position: relative }` for a pseudo-element)
  overrides Tailwind v4's layered utilities. Don't set properties utilities
  own.
- Lazy images are blank in full-page screenshots; scroll the page first.
- Config changes need a dev-server restart; tell the user rather than
  restarting theirs.
