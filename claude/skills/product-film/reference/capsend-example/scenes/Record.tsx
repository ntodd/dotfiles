import React from "react"
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from "remotion"
import {C, expoOut, inOut, pop, shadow, text, tween} from "../theme"
import {mark, phrase, timeline, type SceneInfo} from "../data"
import {CaptureVideo, Clip} from "../components/Capture"
import {Phone, STATUS} from "../components/Phone"
import {Broll} from "../components/Broll"
import type {Cue} from "../cues"

// "One tap, and they're recording. CapSend makes sure the phone is
// sideways, keeps the script right by the lens, and records in full
// quality, up to 4K." The real recipient flow on the phone, in the studio.
const PORT = {width: 390, height: 844}
const LAND = {width: 844, height: 390}
const S_PORT = 1.0
const S_LAND = 1.78
// Where "I just want to say thank you" sits in marcus-talk (measured with
// silencedetect, checked by transcription), and how far the browser
// recording lags the camera feed.
const LINE = {at: 5.62, duration: 1.98}
const REC_LAG = 0.048

type Seg = {at: number; name: string; from: number; rate: number}

export function recordPlan(s: SceneInfo) {
  const p0 = phrase(s, 0)
  const p1 = phrase(s, 1)
  const p2 = phrase(s, 2)
  const p3 = phrase(s, 3)
  const p4 = phrase(s, 4)
  const useBroll = timeline.options.broll
  // With b-roll, Marcus taps his phone on "One tap"; without, we watch his
  // thumb land on the real Record button.
  const tapAt = p0.start + 0.3
  const broll = useBroll ? {start: p0.start - 0.2, end: p1.end - 0.05} : {start: tapAt, end: p1.end - 0.05}
  // A slower turn (0.9 s), then the landscape view dissolves in (0.25 s).
  const rotateAt = Math.min(p2.end - 0.6, p3.start - 0.75) - 0.3
  const turnEnd = rotateAt + 0.9
  const landAt = turnEnd + 0.25
  const countdown = mark("phone-landscape", "recording") - mark("phone-landscape", "tap-record")
  // His line plays in the pause after this scene's last VO line. The
  // countdown runs at its own pace; then we join the recording already
  // underway (recSkip) so his lips land on the line.
  const gap = p4.end + 0.45
  const tapRec = Math.max(landAt + 0.35, gap - LINE.at - REC_LAG - countdown)
  const recAt = Math.max(tapRec + countdown / 2.2, gap - LINE.at - REC_LAG)
  const recSkip = Math.max(0, LINE.at + REC_LAG - (gap - recAt))
  const recFrom = mark("phone-landscape", "recording") + recSkip
  const tapToContinue = mark("phone-portrait", "tap-continue") - mark("phone-portrait", "tap-record")
  const portrait: Seg[] = useBroll ? [
    {at: 0, name: "phone-portrait", from: mark("phone-portrait", "tap-record") - broll.start - 0.2, rate: 1},
    // The camera prompt, ending as Continue is tapped...
    {at: broll.end, name: "phone-portrait", from: mark("phone-portrait", "tap-continue") - 0.62 * 1.3 - 0.05, rate: 1.3},
    // ...then "Turn your phone sideways", past the camera spinner.
    {at: broll.end + 0.62, name: "phone-portrait", from: mark("phone-portrait", "rotate") + 0.45, rate: 1},
  ] : [
    // Landing, the tap, the camera prompt, Continue: straight through.
    {at: 0, name: "phone-portrait", from: mark("phone-portrait", "tap-record") - tapAt - 0.12, rate: 1},
    {at: tapAt + 0.12 + tapToContinue, name: "phone-portrait", from: mark("phone-portrait", "rotate") + 0.45, rate: 1},
  ]
  const landscape: Seg[] = [
    {at: turnEnd, name: "phone-landscape", from: mark("phone-landscape", "tap-record") - (tapRec - turnEnd), rate: 1},
    {at: tapRec, name: "phone-landscape", from: mark("phone-landscape", "tap-record"), rate: countdown / (recAt - tapRec)},
    {at: recAt, name: "phone-landscape", from: recFrom, rate: 1},
  ]
  return {useBroll, tapAt, broll, rotateAt, turnEnd, landAt, tapRec, recAt, portrait, landscape, sideways: p2.start + 0.5, lens: p3.start + 0.1, quality: Math.max(p4.start + 0.35, recAt + 0.1), p4, lineAt: gap, recFrom}
}

export function recordCues(s: SceneInfo): Cue[] {
  const p = recordPlan(s)
  return [
    {t: 0.05, sfx: "whoosh-short", volume: 0.3},
    {t: p.useBroll ? p.broll.start + 0.8 : p.tapAt, sfx: "click", volume: 0.6},
    {t: p.rotateAt, sfx: "whoosh", volume: 0.45},
    {t: p.tapRec, sfx: "click", volume: 0.5},
    ...[0, 1, 2].map((i) => ({t: p.tapRec + (i * (p.recAt - p.tapRec)) / 3 + 0.05, sfx: "tick", volume: 0.5})),
    {t: p.recAt, sfx: "record", volume: 0.6},
    // His real voice, in sync, in the pause after the VO.
    {t: p.lineAt, src: "clips/marcus-talk.mp4", from: LINE.at, duration: LINE.duration, volume: 1.1, duck: true},
    {t: p.lens, sfx: "pop", volume: 0.35},
    {t: p.quality, sfx: "pop", volume: 0.35},
  ]
}

const Segments: React.FC<{segs: Seg[]; until: number}> = ({segs, until}) => {
  const {fps} = useVideoConfig()
  return (
    <>
      {segs.map((g, i) => {
        const start = Math.round(g.at * fps)
        const end = Math.round((segs[i + 1]?.at ?? until) * fps)
        return (
          <Sequence key={i} from={start} durationInFrames={Math.max(1, end - start)} layout="none">
            <div style={{position: "absolute", inset: 0}}>
              <CaptureVideo name={g.name} from={g.from} rate={g.rate} />
            </div>
          </Sequence>
        )
      })}
    </>
  )
}

export const Record: React.FC<{s: SceneInfo}> = ({s}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const p = recordPlan(s)

  // Portrait phone: starts exactly where the last scene's phone was (so the
  // lock screen dissolves into the app), glides to center, then turns
  // sideways and grows into the landscape phone.
  const glide = tween(t, [0.15, 1.2], [0, 1], inOut)
  const cx = 1339.6 + (960 - 1339.6) * glide
  const cy = 537.2 + (550 - 537.2) * glide
  const fit = 1.08 + (1 - 1.08) * glide
  const turn = tween(t, [p.rotateAt, p.turnEnd], [0, 1], inOut)
  const portraitW = (PORT.width + 26) * S_PORT
  const portraitH = (PORT.height + STATUS + 26) * S_PORT
  const landW = (LAND.width + 26) * S_LAND
  const landH = (LAND.height + 26) * S_LAND
  const grow = 1 + (landW / portraitH - 1) * turn
  const inLandscape = t >= p.landAt
  const landIn = tween(t, [p.turnEnd, p.landAt], [0, 1], (x) => x)
  const punch = p.useBroll ? 1 : 1 + tween(t, [p.tapAt - 0.6, p.tapAt], [0, 0.1], inOut) - tween(t, [p.tapAt + 0.25, p.broll.end + 0.2], [0, 0.1], inOut)
  // A slow push-in while recording.
  const push = 1 + tween(t, [p.recAt, s.duration], [0, 0.05], (x) => x)

  return (
    <AbsoluteFill>
      {!inLandscape ? (
        <div
          style={{
            position: "absolute",
            left: cx - portraitW / 2,
            top: cy - portraitH / 2,
            transform: `rotate(${-90 * turn}deg) scale(${fit * grow * punch})`,
            transformOrigin: "50% 50%",
          }}
        >
          <Phone s={S_PORT} page={PORT} status={t < (p.useBroll ? p.broll.end : p.tapAt + 0.08) ? "light" : "dark"}>
            <Segments segs={p.portrait} until={p.landAt} />
            {!p.useBroll ? <Touch t={t} at={p.tapAt} x={195} y={757} /> : null}
          </Phone>
        </div>
      ) : null}
      {t >= p.turnEnd ? (
        <div
          style={{
            position: "absolute",
            left: 960 - landW / 2,
            top: 550 - landH / 2,
            transform: `scale(${push})`,
            opacity: landIn,
          }}
        >
          <Phone orientation="landscape" s={S_LAND} page={LAND} status="dark">
            <Segments segs={p.landscape} until={s.duration + 1} />
          </Phone>
        </div>
      ) : null}

      <Callout at={p.sideways} until={p.rotateAt + 0.2} x={1260} y={430} label="Orientation check" dark />
      {inLandscape ? (
        <>
          <Callout at={p.lens} until={s.duration} x={210} y={70} label="Script by the lens" dark />
          <Callout at={p.quality} until={s.duration} x={1180} y={940} label="Recording up to 4K" dark dot={C.record} />
        </>
      ) : null}

      {/* B-roll: the CEO taps Record on his propped-up phone. */}
      {p.useBroll ? <Broll clip="marcus-behind" from={1.2} start={p.broll.start} end={p.broll.end} /> : null}
    </AbsoluteFill>
  )
}

export const Callout: React.FC<{at: number; until: number; x: number; y: number; label: string; dark?: boolean; dot?: string}> = ({
  at,
  until,
  x,
  y,
  label,
  dark = false,
  dot = C.accent,
}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const k = pop(frame, fps, at, {damping: 15, stiffness: 180})
  const out = tween(t, [until - 0.2, until], [0, 1])
  if (k <= 0.001 || out >= 1) return null
  return (
    <div
      style={{
        ...text,
        position: "absolute",
        left: x,
        top: y,
        padding: "14px 26px 14px 20px",
        borderRadius: 999,
        background: dark ? "rgba(255,255,255,0.96)" : C.ink,
        color: dark ? C.ink : "#fff",
        fontSize: 32,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: shadow.overlay,
        transform: `scale(${k * (1 - out * 0.1)})`,
        opacity: Math.min(1, k) * (1 - out),
        whiteSpace: "nowrap",
      }}
    >
      <div style={{width: 14, height: 14, borderRadius: 7, background: dot, boxShadow: `0 0 0 5px ${dot}33`}} />
      {label}
    </div>
  )
}

// A fingertip press: a soft disc that lands, holds, and lifts.
const Touch: React.FC<{t: number; at: number; x: number; y: number}> = ({t, at, x, y}) => {
  const land = tween(t, [at - 0.12, at], [0, 1], expoOut)
  const lift = tween(t, [at + 0.18, at + 0.45], [0, 1], expoOut)
  const ring = tween(t, [at, at + 0.55], [0, 1], expoOut)
  if (land <= 0 || lift >= 1) return null
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x - 30,
          top: y - 30,
          width: 60,
          height: 60,
          borderRadius: 30,
          background: "rgba(255,255,255,0.55)",
          border: "2px solid rgba(255,255,255,0.9)",
          boxShadow: "0 4px 18px rgba(0,0,0,0.25)",
          opacity: land * (1 - lift),
          transform: `scale(${1.3 - 0.3 * land})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - 30,
          top: y - 30,
          width: 60,
          height: 60,
          borderRadius: 30,
          border: `3px solid rgba(91,80,232,${0.6 * (1 - ring)})`,
          transform: `scale(${1 + ring * 1.4})`,
        }}
      />
    </>
  )
}
