import React from "react"
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from "remotion"
import {C, inOut, pop, shadow, text, tween} from "../theme"
import {timeline, type Box} from "../data"
import {CaptureVideo} from "./Capture"

// A browser window playing a screen recording, filmed by a virtual camera
// that glides between focus boxes (in the recording's CSS pixels), with an
// optional label and highlight on each focus.
export type Focus = {
  at: number // scene-local seconds when the camera starts moving here
  box?: Box | null // null or omitted: the whole window
  zoom?: number // override the automatic zoom
  label?: string
  highlight?: boolean
  pad?: number // CSS px of breathing room around the box
  anchor?: {x?: number; y?: number} // shift the framing, as a fraction of the frame
  cut?: boolean // reframe instantly (a hard cut) with a small punch-in, instead of panning
  side?: "top" | "left" // where the label sits
  color?: string // highlight color
  pulse?: boolean // a gentle breathing glow
}

const FRAME_W = 1920
const FRAME_H = 1080

// One stretch of the recording: from scene time `at`, play the capture from
// `from` seconds at `rate`, until the next clip starts.
export type ClipSpec = {at: number; from: number; rate?: number; fade?: number; capture?: string}

export const DesktopShot: React.FC<{
  capture: string
  from?: number
  rate?: number
  clips?: ClipSpec[]
  duration?: number
  viewport?: {width: number; height: number}
  url?: string
  focus?: Focus[]
  width?: number
  enter?: number | null // seconds; null to skip the entrance
  move?: number // seconds per camera move
  enterFrom?: number // px the window rises from
  children?: React.ReactNode // overlays in window content space (CSS px)
}> = ({capture, from = 0, rate = 1, clips, duration, viewport = {width: 1280, height: 800}, url = "app.example.com", focus = [], width = 1500, enter = 0, move = 0.95, enterFrom = 80, children}) => {
  const frame = useCurrentFrame()
  const {fps, durationInFrames} = useVideoConfig()
  const list = clips ?? [{at: 0, from, rate}]
  const total = duration ?? durationInFrames / fps
  const t = frame / fps

  const k = width / viewport.width
  const bar = Math.round(width * 0.031)
  const winH = viewport.height * k + bar
  const wx = (FRAME_W - width) / 2
  const wy = (FRAME_H - winH) / 2

  const toWorld = (b: Box) => ({x: wx + b.x * k, y: wy + bar + b.y * k, w: b.width * k, h: b.height * k})

  const target = (f: Focus | undefined) => {
    if (!f || !f.box) return {cx: FRAME_W / 2, cy: FRAME_H / 2, z: f?.zoom ?? 1}
    const pad = (f.pad ?? 90) * k
    const r = toWorld(f.box)
    let z = f.zoom ?? Math.min((FRAME_W * 0.78) / (r.w + pad * 2), (FRAME_H * 0.7) / (r.h + pad * 2))
    z = Math.max(1, Math.min(2.1, z))
    let cx = r.x + r.w / 2 - ((f.anchor?.x ?? 0) * FRAME_W) / z
    let cy = r.y + r.h / 2 - ((f.anchor?.y ?? 0) * FRAME_H) / z
    // Keep the view inside the window.
    const hw = FRAME_W / 2 / z
    const hh = FRAME_H / 2 / z
    if (width > hw * 2) cx = Math.min(Math.max(cx, wx + hw), wx + width - hw)
    else cx = FRAME_W / 2
    if (winH > hh * 2) cy = Math.min(Math.max(cy, wy + hh), wy + winH - hh)
    else cy = FRAME_H / 2
    return {cx, cy, z}
  }

  // Camera state at time t: ease from the previous focus to the current one.
  let idx = -1
  focus.forEach((f, i) => {
    if (t >= f.at) idx = i
  })
  const prev = target(idx > 0 ? focus[idx - 1] : undefined)
  const cur = idx >= 0 ? target(focus[idx]) : prev
  const cut = idx >= 0 && focus[idx].cut
  const p = idx >= 0 && !cut ? tween(t, [focus[idx].at, focus[idx].at + move], [0, 1], inOut) : 1
  const punch = cut ? 1 + 0.045 * (1 - tween(t, [focus[idx].at, focus[idx].at + 0.45], [0, 1])) : 1
  const z = Math.exp(Math.log(prev.z) + (Math.log(cur.z) - Math.log(prev.z)) * p) * punch
  const cx = prev.cx + (cur.cx - prev.cx) * p
  const cy = prev.cy + (cur.cy - prev.cy) * p

  // Entrance: rise and settle.
  const e = enter === null ? 1 : pop(frame, fps, enter, {damping: 20, stiffness: 120})
  const enterY = (1 - e) * enterFrom
  const enterS = 0.94 + 0.06 * e

  const toScreen = (b: Box) => {
    const r = toWorld(b)
    return {x: (r.x - cx) * z + FRAME_W / 2, y: (r.y - cy) * z + FRAME_H / 2, w: r.w * z, h: r.h * z}
  }
  const active = idx >= 0 ? focus[idx] : undefined
  // A focus on the same box as the one before keeps its highlight steady.
  const sameBox = (a?: Focus, b?: Focus) => !!a?.box && !!b?.box && JSON.stringify(a.box) === JSON.stringify(b.box)
  let anchorIdx = idx
  while (anchorIdx > 0 && sameBox(focus[anchorIdx], focus[anchorIdx - 1])) anchorIdx--
  const settleAt = idx >= 0 ? focus[anchorIdx].at + (cut ? 0.1 : move * 0.6) : 0
  const settle = idx >= 0 ? tween(t, [settleAt, settleAt + 0.35], [0, 1]) : 0
  const leaving = idx >= 0 && focus[idx + 1] && !sameBox(focus[idx], focus[idx + 1]) ? tween(t, [focus[idx + 1].at - 0.18, focus[idx + 1].at], [1, 0]) : 1

  return (
    <AbsoluteFill style={{opacity: e}}>
      <AbsoluteFill
        style={{
          transformOrigin: "0 0",
          transform: `translate(${FRAME_W / 2 - cx * z}px, ${FRAME_H / 2 - cy * z + enterY}px) scale(${z * enterS})`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: wx,
            top: wy,
            width,
            height: winH,
            borderRadius: 16,
            overflow: "hidden",
            background: C.canvas,
            boxShadow: shadow.window,
          }}
        >
          <TitleBar height={bar} url={url} />
          <div style={{position: "absolute", top: bar, left: 0, width, height: viewport.height * k}}>
            {list.map((c, i) => {
              const start = Math.round(c.at * fps)
              // Overlap the next clip by its fade, so it can dissolve in.
              const next = list[i + 1]
              const end = Math.round((next ? next.at + (next.fade ?? 0) : total + 1) * fps)
              const opacity = c.fade ? tween(t, [c.at, c.at + c.fade], [0, 1], (x) => x) : 1
              return (
                <Sequence key={i} from={start} durationInFrames={Math.max(1, end - start)} layout="none">
                  <div style={{position: "absolute", inset: 0, opacity}}>
                    <CaptureVideo name={c.capture ?? capture} from={c.from} rate={c.rate ?? 1} />
                  </div>
                </Sequence>
              )
            })}
            <div style={{position: "absolute", inset: 0, transformOrigin: "0 0", transform: `scale(${k})`, width: viewport.width, height: viewport.height}}>
              {children}
            </div>
          </div>
        </div>
      </AbsoluteFill>
      {timeline.options.highlights && active?.box && (active.highlight || active.label) ? (
        <Spot rect={toScreen(active.box)} label={active.label} highlight={active.highlight} progress={settle * leaving} side={active.side} color={active.color} pulse={active.pulse ? 0.5 + 0.5 * Math.sin(t * 5) : 0} />
      ) : null}
    </AbsoluteFill>
  )
}

const TitleBar: React.FC<{height: number; url: string}> = ({height, url}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      height,
      background: "linear-gradient(#fbfbfd, #f3f3f7)",
      borderBottom: `1px solid ${C.line}`,
      display: "flex",
      alignItems: "center",
      padding: `0 ${height * 0.45}px`,
    }}
  >
    <div style={{display: "flex", gap: height * 0.2}}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <div key={c} style={{width: height * 0.27, height: height * 0.27, borderRadius: "50%", background: c}} />
      ))}
    </div>
    <div
      style={{
        ...text,
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        height: height * 0.62,
        minWidth: 420,
        padding: "0 22px",
        borderRadius: height,
        background: "#ececf1",
        color: C.ink2,
        fontSize: height * 0.36,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <svg width={height * 0.3} height={height * 0.3} viewBox="0 0 24 24" fill="none">
        <rect x="5" y="10" width="14" height="10" rx="2.5" fill={C.ink3} />
        <path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke={C.ink3} strokeWidth="2.2" />
      </svg>
      {url}
    </div>
  </div>
)

// A soft highlight ring around the focused element, with a label above it.
export const Spot: React.FC<{
  rect: {x: number; y: number; w: number; h: number}
  label?: string
  highlight?: boolean
  progress: number
  dark?: boolean
  side?: "top" | "bottom" | "left"
  color?: string
  pulse?: number
}> = ({rect, label, highlight = true, progress, dark = false, side = "top", color = C.accent, pulse = 0}) => {
  const rgb = color === C.accent ? "91,80,232" : color === C.success ? "26,138,74" : color === C.record ? "229,72,77" : "91,80,232"
  if (progress <= 0.001) return null
  const pad = 12
  const labelY = side === "top" ? rect.y - pad - 62 : rect.y + rect.h + pad + 14
  return (
    <AbsoluteFill style={{pointerEvents: "none"}}>
      {highlight ? (
        <div
          style={{
            position: "absolute",
            left: rect.x - pad,
            top: rect.y - pad,
            width: rect.w + pad * 2,
            height: rect.h + pad * 2,
            borderRadius: 18,
            border: `3px solid ${color}`,
            boxShadow: `0 0 0 ${8 + pulse * 6}px rgba(${rgb},${(0.14 + pulse * 0.1) * progress}), 0 0 40px rgba(${rgb},${0.25 * progress})`,
            opacity: progress,
            transform: `scale(${1.04 - 0.04 * progress})`,
          }}
        />
      ) : null}
      {label ? (
        <div
          style={{
            ...text,
            position: "absolute",
            ...(side === "left"
              ? {right: 1920 - (rect.x - pad - 20), top: rect.y + rect.h / 2 - 31}
              : {left: Math.min(Math.max(rect.x - pad, 40), 1920 - 700), top: Math.max(labelY, 30)}),
            padding: "12px 22px 12px 18px",
            borderRadius: 999,
            background: dark ? "rgba(255,255,255,0.95)" : C.ink,
            color: dark ? C.ink : "#fff",
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: shadow.soft,
            opacity: progress,
            transform: side === "left" ? `translateX(${(1 - progress) * -14}px)` : `translateY(${(1 - progress) * 14}px)`,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{width: 12, height: 12, borderRadius: 6, background: C.accent, boxShadow: "0 0 0 4px rgba(91,80,232,0.25)"}} />
          {label}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}
