# Case study: CapSend (Sep 2026)

CapSend lets a team request a video from anyone by link and get back the
original, full-quality file. The brief: a peppy, professional product film
for the marketing site, with voiceover, music, recorded demos, and
animations, regenerable from a script, on a $14 (later $30) OpenRouter key.

## What shipped

- A 77 s film, two exports kept (`out/v1`, `out/v2`), each with a captioned
  version, VTT, and poster. v2 smoothed transitions and pacing.
- The marketing home page rebuilt around it: dark "studio first" screen, the
  film inside a sideways phone, a theater that dims the page (PR #22).
- This skill.

## The film, scene by scene

| Scene | VO (abridged) | Picture |
| --- | --- | --- |
| hook | "You asked for one short video. What came back was sideways, squashed... and three days late." | A message thread: request, a sideways 480p attachment, a bounced email, "sent it on WeChat instead", "3 days later". |
| degrade | "Every app it passes through squeezes it a little more..." | The same clip at 4K, 720p, 480p, 240p (real re-encodes), then the crisp phone original. Collapses into a red record dot on the drop. |
| reveal | "Meet CapSend. Send a link. Get back the original." | The dot blooms into the logo on the music's drop. |
| ask | "Say what you need, add a script for the teleprompter..." | Real request form, speed-ramped, camera framing each field. |
| people | "They get a link by email or text. No app. No account." | Names typed, then a lock screen with the text and the real invite email. |
| record | "One tap, and they're recording..." | Real recorder on a phone: tap, camera prompt, "Turn your phone sideways", rotation, teleprompter, recording. The CEO then says "I just want to say thank you" in his own voice. |
| sending | "It sends while they talk..." | Split screen: phone uploading, dashboard row "Recording now" to "Sent a video". |
| arrive | "Back at your desk, watch every video arrive, live..." | Dashboard, then the video page: 3840x2160, original, edit-ready MP4, send to an editor. |
| scale | "One CEO, or five hundred customers..." | A wall of 35 tiles, 16 generated people, gender-matched unique names. |
| end | "CapSend. Get the video you asked for." | End card; the CTA lands on the music's final hit. |

## Review score trajectory (Gemini, 1-10)

7.5 (first cut) → 6.8 (b-roll disliked, "no SFX") → 7.8 → 8.8 → 8.8 → 7.8
(new notes: overlap of voices, notification ghosting) → 9.2 (v1). v2 was
compared to v1 on motion only: "noticeably smoother (30-40%)".

## What the user asked for along the way

- A different real line from the CEO ("I just want to say thank you").
- Teleprompter clear of the Dynamic Island (fixed with safe-area insets, not
  by moving it in the edit).
- Drop the highlight boxes; smooth transitions; keep v1 and render v2.
- Male and female names that match the faces on the wall.
- On the site: a poster and play button, not a full-width autoplay; dim the
  page while it plays; host on Tigris; ship as a PR; screenshots via
  `gh --attach`, never bucket uploads.

## Files

The full project lives in the app repo under `marketing/video/` (its own
PR, #23, source only; generated media gitignored). `reference/capsend-example/` here has its
script, assets list, scenes, and the Phoenix capture harness.
