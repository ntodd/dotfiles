import React from "react"
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from "remotion"
import {C, expoOut, inOut, pop, shadow, text, tween} from "../theme"
import {mark, markBox, phrase, scene, type SceneInfo} from "../data"
import {CaptureVideo} from "../components/Capture"
import {DesktopShot, type Focus} from "../components/DesktopShot"
import {Phone} from "../components/Phone"
import {Callout, recordPlan} from "./Record"
import type {Cue} from "../cues"

// "It sends while they talk, so when they're done... they're done."
// The phone finishes on the left; Maya's page updates live on the right.
const LAND = {width: 844, height: 390}
const L = "phone-landscape"
const D = "live-desk"

export function sendingPlan(s: SceneInfo) {
  const p0 = phrase(s, 0)
  const p1 = phrase(s, 1)
  const p2 = phrase(s, 2)
  const rec = scene("record")
  const rp = recordPlan(rec)
  const resume = rp.recFrom + (rec.duration - rp.recAt)
  const stopAt = p1.start - 0.15
  const sentAt = p2.start - 0.12
  // Recording, then straight to "Sent!" (the review screen is skipped in the
  // edit; it flashed by too fast to read).
  const phone = [
    {at: 0, from: resume, rate: Math.max(1, (mark(L, "tap-stop") - 0.1 - resume) / sentAt)},
    {at: sentAt, from: mark(L, "sent") + 0.45, rate: 1},
  ]
  const desk = [
    {at: 0, from: mark(D, "recording") + 0.4, rate: 1},
    {at: sentAt, from: mark(D, "sent") - 0.05, rate: 1},
  ]
  return {phone, desk, uploading: p0.start + 0.2, stopAt, sentAt}
}

export function sendingCues(s: SceneInfo): Cue[] {
  const p = sendingPlan(s)
  return [
    {t: p.uploading, sfx: "pop", volume: 0.4},
    {t: p.sentAt + 0.05, sfx: "success", volume: 0.6},
  ]
}

export const Sending: React.FC<{s: SceneInfo}> = ({s}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const p = sendingPlan(s)
  const split = tween(t, [0.05, 1.0], [0, 1], inOut)
  const card = pop(frame, fps, 0.3, {damping: 22, stiffness: 90})
  // Record ends with the phone pushed in 5% around (960, 550).
  const sPhone = 1.78 * 1.05 - (1.78 * 1.05 - 0.94) * split
  const phoneW = (LAND.width + 26) * sPhone
  const phoneH = (LAND.height + 26) * sPhone
  const phoneX = 960 - phoneW / 2 - 482 * split
  // Frame the person and their status, not the whole row.
  const r = markBox(D, "recording")
  const row = r ? {...r, width: Math.min(r.width, 560)} : null
  const focus: Focus[] = [
    {at: 0, box: row, highlight: true, pad: 24, zoom: 1.45, color: C.record, pulse: true},
    {at: p.sentAt, box: row, highlight: true, pad: 24, zoom: 1.45, color: C.success},
  ]
  const progress = tween(t, [p.uploading, p.sentAt], [0.35, 1], (x) => x)

  return (
    <AbsoluteFill>
      <div style={{position: "absolute", left: phoneX, top: 550 - 10 * split - phoneH / 2}}>
        <Phone orientation="landscape" s={sPhone} page={LAND} status="dark">
          {p.phone.map((g, i) => {
            const start = Math.round(g.at * fps)
            const end = Math.round((p.phone[i + 1]?.at ?? s.duration + 1) * fps)
            return (
              <Sequence key={i} from={start} durationInFrames={end - start} layout="none">
                <div style={{position: "absolute", inset: 0}}>
                  <CaptureVideo name={L} from={g.from} rate={g.rate} />
                </div>
              </Sequence>
            )
          })}
        </Phone>
        <Upload t={t} at={p.uploading} until={p.sentAt + 0.6} progress={progress} />
      </div>

      {/* Maya's request page, live. */}
      <div
        style={{
          position: "absolute",
          left: 920,
          top: 205,
          width: 960,
          height: 670,
          borderRadius: 26,
          overflow: "hidden",
          boxShadow: shadow.window,
          background: C.canvas,
          transform: `translateX(${(1 - card) * 500}px)`,
          opacity: Math.min(1, card * 1.3),
        }}
      >
        <div style={{position: "absolute", left: 480 - 960, top: 335 - 540, width: 1920, height: 1080, transform: "scale(0.95)", transformOrigin: "960px 540px"}}>
          <DesktopShot capture={D} clips={p.desk} focus={focus} enter={null} move={0.01} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

// An honest upload meter under the phone.
const Upload: React.FC<{t: number; at: number; until: number; progress: number}> = ({t, at, until, progress}) => {
  const k = tween(t, [at, at + 0.35], [0, 1], expoOut) * tween(t, [until, until + 0.3], [1, 0])
  if (k <= 0.001) return null
  const done = progress >= 0.999
  return (
    <div
      style={{
        ...text,
        position: "absolute",
        left: "50%",
        bottom: -110,
        transform: `translateX(-50%) translateY(${(1 - k) * 20}px)`,
        opacity: k,
        width: 520,
        padding: "18px 24px",
        borderRadius: 20,
        background: "rgba(255,255,255,0.96)",
        boxShadow: shadow.overlay,
      }}
    >
      <div style={{display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 600, color: C.ink}}>
        <span>{done ? "Sent" : "Sending while you record"}</span>
        <span style={{color: done ? C.success : C.ink3, fontVariantNumeric: "tabular-nums"}}>{Math.round(progress * 100)}%</span>
      </div>
      <div style={{marginTop: 12, height: 8, borderRadius: 4, background: C.muted, overflow: "hidden"}}>
        <div style={{height: "100%", width: `${progress * 100}%`, borderRadius: 4, background: done ? C.success : C.accent}} />
      </div>
    </div>
  )
}

export {Callout}
