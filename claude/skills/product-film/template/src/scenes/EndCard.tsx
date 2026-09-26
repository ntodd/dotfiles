import React from "react"
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion"
import {C, pop, shadow, text} from "../theme"
import {phrase, timeline, type SceneInfo} from "../data"
import {Words} from "../components/Words"
import type {Cue} from "../cues"

// A starter end card: the brand, a headline, a call to action, and the URL.
// Content comes from script.yaml `brand:` and the scene's `on_screen:`.
// The CTA lands as the narrator finishes (the timeline puts that on the
// music's final hit).
export function endCardCues(s: SceneInfo): Cue[] {
  return [{t: (s.vo ? phrase(s, 99).end : 1) + 0.02, sfx: "pop", volume: 0.5}]
}

export const EndCard: React.FC<{s: SceneInfo}> = ({s}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const brand = timeline.brand
  const cta = (s.vo ? phrase(s, 99).end : 1) + 0.02
  const name = pop(frame, fps, 0.05)
  const button = pop(frame, fps, cta, {damping: 13, stiffness: 170})
  const url = pop(frame, fps, cta + 0.15)
  return (
    <AbsoluteFill style={{alignItems: "center", justifyContent: "center", gap: 40}}>
      <div style={{...text, fontSize: 64, fontWeight: 650, letterSpacing: "-0.03em", color: C.ink, opacity: name}}>
        {brand.name ?? "Your product"}
      </div>
      <Words at={phrase(s, 0).start - 0.08} size={96} weight={650}>
        {s.on_screen?.headline ?? brand.tagline ?? ""}
      </Words>
      {brand.cta ? (
        <div
          style={{
            ...text,
            padding: "0 44px",
            height: 92,
            borderRadius: 22,
            background: C.accent,
            color: "#fff",
            fontSize: 36,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            boxShadow: shadow.soft,
            transform: `scale(${button})`,
          }}
        >
          {brand.cta}
        </div>
      ) : null}
      {brand.url ? (
        <div style={{...text, fontSize: 42, fontWeight: 600, color: C.ink, opacity: url}}>{brand.url}</div>
      ) : null}
    </AbsoluteFill>
  )
}
