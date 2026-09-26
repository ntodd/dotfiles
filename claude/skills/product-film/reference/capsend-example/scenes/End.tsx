import React from "react"
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion"
import {C, expoOut, pop, shadow, text, tween} from "../theme"
import {phrase, type SceneInfo} from "../data"
import {Mark, Wordmark} from "../components/Logo"
import {Words} from "../components/Words"
import type {Cue} from "../cues"

// "CapSend. Get the video you asked for." The call to action lands on the
// music's final hit.
export function endPlan(s: SceneInfo) {
  const p1 = phrase(s, 1)
  return {logo: 0.05, line: p1.start - 0.08, cta: p1.end + 0.02}
}

export function endCues(s: SceneInfo): Cue[] {
  const p = endPlan(s)
  return [
    {t: p.cta, sfx: "pop", volume: 0.5},
  ]
}

export const End: React.FC<{s: SceneInfo}> = ({s}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const p = endPlan(s)
  const tile = pop(frame, fps, p.logo, {damping: 14, stiffness: 170})
  const ring = tween(t, [p.logo + 0.1, p.logo + 0.6], [0, 1], expoOut)
  const word = tween(t, [p.logo + 0.15, p.logo + 0.7], [0, 1], expoOut)
  const cta = pop(frame, fps, p.cta, {damping: 13, stiffness: 170})
  const url = pop(frame, fps, p.cta + 0.15, {damping: 18, stiffness: 150})
  const glow = 0.5 + 0.5 * Math.sin((t - p.cta) * 2.4)
  const sweep = ((t - p.cta - 0.2) % 2.6) / 0.9

  return (
    <AbsoluteFill style={{alignItems: "center"}}>
      <div style={{position: "absolute", top: 250, display: "flex", alignItems: "center", gap: 26}}>
        <div style={{filter: `drop-shadow(0 20px 30px rgba(22,22,29,${0.2 * tile}))`}}>
          <Mark size={104} tile={tile} ring={ring} />
        </div>
        <Wordmark size={92} reveal={word} />
      </div>
      <div style={{position: "absolute", top: 440, left: 0, right: 0}}>
        <Words at={p.line} size={96} weight={650}>
          Get the video you *asked for.*
        </Words>
      </div>
      <div
        style={{
          ...text,
          position: "absolute",
          top: 640,
          padding: "0 44px",
          height: 92,
          borderRadius: 22,
          background: C.accent,
          color: "#fff",
          fontSize: 36,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 16,
          boxShadow: `0 20px 50px -12px rgba(91,80,232,${0.45 + 0.15 * glow}), ${shadow.soft}`,
          transform: `scale(${cta})`,
          opacity: Math.min(1, cta * 1.4),
          overflow: "hidden",
        }}
      >
        <div style={{width: 16, height: 16, borderRadius: 8, background: "#fff"}} />
        Request your first video
        {t > p.cta + 0.2 && sweep >= 0 && sweep <= 1 ? (
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${-40 + sweep * 150}%`,
              width: "30%",
              background: "linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0) 100%)",
            }}
          />
        ) : null}
      </div>
      {t > p.cta && t < p.cta + 0.9 ? (
        <div
          style={{
            position: "absolute",
            top: 640 + 46 - 60,
            width: 480,
            height: 120,
            borderRadius: 40,
            border: `3px solid rgba(91,80,232,${0.45 * (1 - tween(t, [p.cta, p.cta + 0.9], [0, 1]))})`,
            transform: `scale(${1 + tween(t, [p.cta, p.cta + 0.9], [0, 0.35], expoOut)})`,
          }}
        />
      ) : null}
      <div
        style={{
          ...text,
          position: "absolute",
          top: 764,
          fontSize: 42,
          fontWeight: 600,
          color: C.ink,
          letterSpacing: "-0.01em",
          opacity: url,
          transform: `translateY(${(1 - url) * 16}px)`,
        }}
      >
        capsend.app
      </div>
    </AbsoluteFill>
  )
}
