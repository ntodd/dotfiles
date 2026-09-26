import React from "react"
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion"
import {C, expoOut, inOut, pop, shadow, text, tween} from "../theme"
import {phrase, type SceneInfo} from "../data"
import {Clip} from "../components/Capture"
import {Phone} from "../components/Phone"
import type {Cue} from "../cues"

// "Every app it passes through squeezes it a little more. And the phone
// that shot it? It could have done so much better."
const STEPS = [
  {app: "Text", clip: "q-720", res: "720p"},
  {app: "Email", clip: "q-480", res: "480p"},
  {app: "WeChat", clip: "q-240", res: "240p"},
]

function times(s: SceneInfo) {
  const p0 = phrase(s, 0)
  const p1 = phrase(s, 1)
  const p2 = phrase(s, 2)
  const span = p0.end - p0.start
  return {
    steps: STEPS.map((_, i) => p0.start + 0.35 + (span * (i + 0.2)) / STEPS.length),
    phone: Math.max(p0.end - 0.25, p1.start - 0.65),
    better: p2.start + 0.1,
    collapse: s.duration - 0.85,
  }
}

export function degradeCues(s: SceneInfo): Cue[] {
  const tm = times(s)
  return [
    ...tm.steps.map((t) => ({t, sfx: "glitch", volume: 0.55})),
    {t: tm.phone, sfx: "thump", volume: 0.55},
    {t: tm.phone, sfx: "whoosh-short", volume: 0.18},
    {t: s.duration - 2.0, sfx: "riser", volume: 0.55},
    {t: tm.collapse, sfx: "whoosh-short", volume: 0.5},
  ]
}

export const Degrade: React.FC<{s: SceneInfo}> = ({s}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const tm = times(s)

  const step = tm.steps.filter((x) => t >= x).length // 0..3
  const enter = pop(frame, fps, 0, {damping: 18, stiffness: 120})
  // The crushed frame slides left and shrinks when the phone arrives.
  const toPhone = tween(t, [tm.phone, tm.phone + 0.8], [0, 1], inOut)
  const collapse = tween(t, [tm.collapse, s.duration], [0, 1], Easing2)

  const frameW = 1180 - toPhone * 560
  const frameX = -toPhone * 470
  const shake = step > 0 ? Math.max(0, 1 - (t - tm.steps[step - 1]) * 6) * Math.sin(t * 90) * 10 : 0

  return (
    <AbsoluteFill style={{alignItems: "center", justifyContent: "center"}}>
      {/* The pipeline of apps. */}
      <div
        style={{
          position: "absolute",
          top: 90,
          display: "flex",
          gap: 22,
          alignItems: "center",
          opacity: enter * (1 - toPhone),
          transform: `translateY(${(1 - enter) * -30}px)`,
        }}
      >
        <Chip label="Original" active={step === 0} done={step > 0} />
        {STEPS.map((st, i) => (
          <React.Fragment key={st.app}>
            <Arrow on={step > i} />
            <Chip label={st.app} active={step === i + 1} done={step > i + 1} />
          </React.Fragment>
        ))}
      </div>

      {/* The video, one generation worse at each hop. */}
      <div
        style={{
          position: "absolute",
          width: frameW,
          height: (frameW * 9) / 16,
          left: 960 - frameW / 2 + frameX,
          top: 540 - (frameW * 9) / 32 + 30 - toPhone * 60,
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: shadow.window,
          transform: `translateX(${shake}px) scale(${0.9 + 0.1 * enter})`,
          opacity: enter * (1 - collapse),
          filter: `saturate(${1 - step * 0.12})`,
        }}
      >
        <Clip name="marcus-talk" />
        {STEPS.map((st, i) => (
          <AbsoluteFill key={st.clip} style={{opacity: step > i ? 1 : 0}}>
            <Clip name={st.clip} />
          </AbsoluteFill>
        ))}
        <div
          style={{
            ...text,
            position: "absolute",
            left: 22,
            top: 20,
            padding: "8px 16px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: 26,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {step === 0 ? "4K" : STEPS[step - 1].res}
        </div>
        {toPhone > 0 ? (
          <AbsoluteFill style={{background: `rgba(11,11,15,${0.35 * toPhone})`}} />
        ) : null}
      </div>

      {/* Say what we're comparing. */}
      <Caption t={t} at={tm.phone + 0.5} out={tm.collapse} x={960 - 310 - 470} y={690} label="What you got" />
      <Caption t={t} at={tm.better - 0.1} out={tm.collapse} x={935 + 20} y={720} label="What the phone shot" />

      {/* The phone that shot it, crisp. */}
      <PhoneReveal t={t} at={tm.phone} better={tm.better} collapse={collapse} />

      {/* Everything collapses into the record dot, right on the drop. */}
      {collapse > 0 ? (
        <div
          style={{
            position: "absolute",
            left: 960 - 22,
            top: 470 - 22,
            width: 44,
            height: 44,
            borderRadius: 22,
            background: C.record,
            transform: `scale(${tween(t, [s.duration - 0.45, s.duration], [0, 1], expoOut)})`,
            boxShadow: "0 0 40px rgba(229,72,77,0.6)",
          }}
        />
      ) : null}
    </AbsoluteFill>
  )
}

const Easing2 = (x: number) => x * x * x

const PhoneReveal: React.FC<{t: number; at: number; better: number; collapse: number}> = ({t, at, better, collapse}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const k = pop(frame, fps, at + 0.15, {damping: 17, stiffness: 120})
  const badge = pop(frame, fps, better, {damping: 13, stiffness: 180})
  if (k <= 0.001) return null
  const s = 1.55
  const scale = 1 - collapse
  return (
    <div
      style={{
        position: "absolute",
        left: 935,
        top: 470 - ((240 + 26) * 1.55) / 2,
        transform: `translateX(${(1 - k) * 500}px) scale(${scale}) rotate(${(1 - k) * 8}deg)`,
        transformOrigin: `${960 - 935}px ${((240 + 26) * 1.55) / 2}px`,
        opacity: Math.min(1, k * 1.4) * (1 - collapse * 0.6),
      }}
    >
      <Phone orientation="landscape" s={s} page={{width: 520, height: 240}} status="dark">
        <Clip name="marcus-talk" style={{transform: "scaleX(-1)"}} />
      </Phone>
      <div
        style={{
          ...text,
          position: "absolute",
          right: 30,
          top: -34,
          padding: "12px 22px",
          borderRadius: 999,
          background: C.ink,
          color: "#fff",
          fontSize: 28,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: shadow.soft,
          transform: `scale(${badge})`,
          opacity: Math.min(1, badge),
        }}
      >
        <div style={{width: 12, height: 12, borderRadius: 6, background: C.record}} />
        4K original
      </div>
    </div>
  )
}

const Chip: React.FC<{label: string; active: boolean; done: boolean}> = ({label, active, done}) => (
  <div
    style={{
      ...text,
      padding: "14px 26px",
      borderRadius: 999,
      fontSize: 28,
      fontWeight: 600,
      background: active ? C.ink : "#fff",
      color: active ? "#fff" : done ? C.ink3 : C.ink2,
      boxShadow: active ? shadow.soft : `inset 0 0 0 1.5px ${C.line}`,
      transform: `scale(${active ? 1.06 : 1})`,
    }}
  >
    {label}
  </div>
)

const Arrow: React.FC<{on: boolean}> = ({on}) => (
  <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
    <path d="M2 10h32m0 0-7-7m7 7-7 7" stroke={on ? C.ink : "#c9c9d3"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const Caption: React.FC<{t: number; at: number; out: number; x: number; y: number; label: string}> = ({t, at, out, x, y, label}) => {
  const k = tween(t, [at, at + 0.4], [0, 1], expoOut) * tween(t, [out - 0.1, out + 0.2], [1, 0])
  if (k <= 0.001) return null
  return (
    <div
      style={{
        ...text,
        position: "absolute",
        left: x,
        top: y,
        fontSize: 34,
        fontWeight: 600,
        letterSpacing: "-0.015em",
        color: C.ink2,
        opacity: k,
        transform: `translateY(${(1 - k) * 12}px)`,
      }}
    >
      {label}
    </div>
  )
}
