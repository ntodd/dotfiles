import React from "react"
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion"
import {C, expoOut, pop, shadow, text, tween} from "../theme"
import {phrase, type SceneInfo} from "../data"
import {Clip} from "../components/Capture"
import type {Cue} from "../cues"

// "You asked for one short video. What came back was sideways, squashed...
// and three days late." A message thread that goes wrong across apps.
type Msg =
  | {kind: "day"; at: number; label: string; late?: boolean}
  | {kind: "out" | "in"; at: number; body: string; via?: "Text" | "WeChat"}
  | {kind: "video"; at: number}
  | {kind: "typing"; at: number; until: number}

function script(s: SceneInfo): Msg[] {
  const p1 = phrase(s, 1)
  const p2 = phrase(s, 2)
  const p4 = phrase(s, 4)
  return [
    {kind: "day", at: 0.25, label: "Tuesday 9:14 AM"},
    {kind: "out", at: 0.45, body: "Hi Marcus! Could you record a quick video for the Q4 kickoff? 🙏", via: "Text"},
    {kind: "typing", at: 1.5, until: 2.35},
    {kind: "in", at: 2.35, body: "Sure, will do this week 👍"},
    {kind: "day", at: p1.start - 0.1, label: "Thursday 11:48 PM"},
    {kind: "video", at: p1.start + 0.15},
    {kind: "out", at: p2.end + 0.1, body: "It's sideways 😅 and pretty blurry. Could you send the original?"},
    {kind: "day", at: p4.start - 0.05, label: "Friday 4:52 PM", late: true},
    {kind: "in", at: p4.start + 0.1, body: "Email bounced, too big. Sent it on WeChat instead!", via: "WeChat"},
  ]
}

export function hookCues(s: SceneInfo): Cue[] {
  const cues: Cue[] = []
  for (const m of script(s)) {
    if (m.kind === "out") cues.push({t: m.at, sfx: "send", volume: 0.7})
    if (m.kind === "in" || m.kind === "video") cues.push({t: m.at, sfx: "pop", volume: 0.8})
  }
  const p3 = phrase(s, 3)
  cues.push({t: p3.start + 0.05, sfx: "glitch", volume: 0.5})
  cues.push({t: phrase(s, 4).start + 0.35, sfx: "error", volume: 0.45})
  return cues
}

const W = 860

export const Hook: React.FC<{s: SceneInfo}> = ({s}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const msgs = script(s)
  const p2 = phrase(s, 2)
  const p3 = phrase(s, 3)
  const p4 = phrase(s, 4)

  // Heights for auto-scrolling as the thread grows.
  const heights = msgs.map((m) => (m.kind === "day" ? 64 : m.kind === "video" ? 360 : m.kind === "typing" ? 0 : 118))
  const shown = msgs.map((m) => pop(frame, fps, m.at, {damping: 15, stiffness: 190}))
  let contentH = 0
  msgs.forEach((m, i) => {
    if (m.kind !== "typing") contentH += heights[i] * Math.min(1, shown[i])
  })
  const viewH = 800
  const scroll = Math.max(0, contentH - viewH + 40)

  const enter = pop(frame, fps, 0, {damping: 20, stiffness: 110})
  const exit = 0

  let y = 0
  return (
    <AbsoluteFill style={{alignItems: "center", justifyContent: "center"}}>
      <div
        style={{
          width: W,
          height: 940,
          borderRadius: 40,
          background: "rgba(255,255,255,0.92)",
          boxShadow: shadow.window,
          overflow: "hidden",
          transform: `translateY(${(1 - enter) * 120 - exit * 40}px) scale(${0.96 + 0.04 * enter + exit * 0.12})`,
          opacity: enter * (1 - exit),
          position: "relative",
        }}
      >
        <Header />
        <div style={{position: "absolute", top: 130, left: 0, right: 0, bottom: 0, overflow: "hidden"}}>
          <div style={{position: "absolute", left: 0, right: 0, top: 20 - scroll}}>
            {msgs.map((m, i) => {
              const k = shown[i]
              const top = y
              if (m.kind !== "typing") y += heights[i] * Math.min(1, k)
              if (m.kind === "typing") {
                const on = t >= m.at && t < m.until
                return on ? <Typing key={i} top={top} t={t} /> : null
              }
              if (k <= 0.001) return null
              if (m.kind === "day") return <Day key={i} top={top} k={k} label={m.label} late={m.late} t={t} at={m.at} />
              if (m.kind === "video") return <VideoBubble key={i} top={top} k={k} t={t} at={m.at} sideways={p2.start} squash={p3.start} />
              return <Bubble key={i} top={top} k={k} out={m.kind === "out"} body={m.body} via={m.via} />
            })}
          </div>
        </div>
        <Bounce t={t} at={p4.start + 0.35} />
      </div>
    </AbsoluteFill>
  )
}

const Header: React.FC = () => (
  <div
    style={{
      ...text,
      height: 130,
      borderBottom: `1px solid ${C.line}`,
      display: "flex",
      alignItems: "center",
      gap: 20,
      padding: "0 40px",
      background: "rgba(247,247,249,0.9)",
    }}
  >
    <div
      style={{
        width: 68,
        height: 68,
        borderRadius: 34,
        background: "#e8e4ff",
        color: C.accentInk,
        fontWeight: 600,
        fontSize: 26,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      MB
    </div>
    <div>
      <div style={{fontSize: 30, fontWeight: 600, color: C.ink, letterSpacing: "-0.01em"}}>Marcus Bell</div>
      <div style={{fontSize: 22, color: C.ink3, marginTop: 2}}>CEO, Northpeak</div>
    </div>
  </div>
)

const Day: React.FC<{top: number; k: number; label: string; late?: boolean; t: number; at: number}> = ({top, k, label, late, t, at}) => {
  const flash = late ? tween(t, [at + 0.25, at + 0.6], [0, 1]) : 0
  return (
    <div
      style={{
        ...text,
        position: "absolute",
        top,
        left: 0,
        right: 0,
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        fontSize: 21,
        fontWeight: 500,
        color: C.ink3,
        opacity: Math.min(1, k),
      }}
    >
      {label}
      {late ? (
        <span
          style={{
            padding: "5px 14px",
            borderRadius: 999,
            background: C.warningSoft,
            color: C.warning,
            fontWeight: 600,
            fontSize: 19,
            opacity: flash,
            transform: `scale(${0.8 + 0.2 * flash})`,
          }}
        >
          3 days later
        </span>
      ) : null}
    </div>
  )
}

const Bubble: React.FC<{top: number; k: number; out: boolean; body: string; via?: string}> = ({top, k, out, body, via}) => (
  <div
    style={{
      position: "absolute",
      top,
      left: 36,
      right: 36,
      display: "flex",
      flexDirection: "column",
      alignItems: out ? "flex-end" : "flex-start",
      transformOrigin: out ? "right bottom" : "left bottom",
      transform: `scale(${0.6 + 0.4 * k}) translateY(${(1 - k) * 20}px)`,
      opacity: Math.min(1, k * 1.5),
    }}
  >
    <div
      style={{
        ...text,
        maxWidth: 600,
        padding: "18px 26px",
        borderRadius: 30,
        borderBottomRightRadius: out ? 10 : 30,
        borderBottomLeftRadius: out ? 30 : 10,
        background: out ? C.accent : via === "WeChat" ? "#95ec69" : C.muted,
        color: out ? "#fff" : C.ink,
        fontSize: 27,
        lineHeight: 1.32,
        letterSpacing: "-0.005em",
      }}
    >
      {body}
    </div>
    {via ? (
      <div style={{...text, fontSize: 18, color: C.ink3, marginTop: 6, padding: "0 10px"}}>
        {via === "WeChat" ? "via WeChat" : "Text message"}
      </div>
    ) : null}
  </div>
)

// The video that came back: sideways, crushed, letterboxed.
const VideoBubble: React.FC<{top: number; k: number; t: number; at: number; sideways: number; squash: number}> = ({top, k, t, at, sideways, squash}) => {
  // The clip is already sideways; give it a little wobble on the word.
  const w = tween(t, [sideways - 0.05, sideways + 0.6], [0, 1], (x) => x)
  const tilt = w > 0 && w < 1 ? Math.sin(w * Math.PI * 3) * 7 * (1 - w) : 0
  const sq = tween(t, [squash, squash + 0.18], [0, 1]) * (1 - tween(t, [squash + 0.18, squash + 0.7], [0, 0.55]))
  return (
    <div
      style={{
        position: "absolute",
        top,
        left: 36,
        transformOrigin: "left bottom",
        transform: `scale(${0.6 + 0.4 * k})`,
        opacity: Math.min(1, k * 1.5),
      }}
    >
      <div
        style={{
          width: 420,
          height: 330,
          borderRadius: 26,
          overflow: "hidden",
          background: "#000",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 186,
            height: 330,
            transform: `rotate(${tilt}deg) scale(${1 - 0.28 * sq}, ${1 + 0.1 * sq})`,
            filter: `blur(${1.2 + sq * 1.5}px) saturate(0.85) contrast(1.08)`,
          }}
        >
          <Clip name="sideways" />
        </div>
        <div
          style={{
            ...text,
            position: "absolute",
            left: 16,
            bottom: 14,
            padding: "5px 12px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          IMG_4471.MOV · 480p
        </div>
      </div>
    </div>
  )
}

const Typing: React.FC<{top: number; t: number}> = ({top, t}) => (
  <div style={{position: "absolute", top, left: 36, padding: "20px 26px", borderRadius: 30, background: C.muted, display: "flex", gap: 9}}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        style={{
          width: 13,
          height: 13,
          borderRadius: 7,
          background: C.ink3,
          opacity: 0.35 + 0.65 * Math.max(0, Math.sin((t * 6 - i * 0.8) % (Math.PI * 2))),
        }}
      />
    ))}
  </div>
)

// An email bounce notification drops in over the thread.
const Bounce: React.FC<{t: number; at: number}> = ({t, at}) => {
  const k = tween(t, [at, at + 0.45], [0, 1], expoOut)
  if (k <= 0) return null
  return (
    <div
      style={{
        ...text,
        position: "absolute",
        left: 28,
        right: 28,
        top: 18,
        padding: "20px 24px",
        borderRadius: 26,
        background: "rgba(255,255,255,0.97)",
        boxShadow: shadow.overlay,
        display: "flex",
        gap: 18,
        alignItems: "center",
        transform: `translateY(${(1 - k) * -140}px)`,
      }}
    >
      <div style={{width: 58, height: 58, borderRadius: 14, background: "linear-gradient(#5ab0ff, #1d77f2)", display: "flex", alignItems: "center", justifyContent: "center"}}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="#fff" strokeWidth="1.8" />
          <path d="m4 7 8 6 8-6" stroke="#fff" strokeWidth="1.8" />
        </svg>
      </div>
      <div style={{flex: 1}}>
        <div style={{fontSize: 22, fontWeight: 600, color: C.ink}}>Mail Delivery Subsystem</div>
        <div style={{fontSize: 21, color: C.ink2, marginTop: 3}}>Undeliverable: message size exceeds limit (148 MB)</div>
      </div>
      <div style={{fontSize: 18, color: C.ink3}}>now</div>
    </div>
  )
}
