import React from "react"
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from "remotion"
import {C, expoOut, inOut, pop, shadow, text, tween} from "../theme"
import {mark, markBox, messages, phrase, scene, type SceneInfo} from "../data"
import {askPlan} from "./Ask"
import {DesktopShot, type ClipSpec, type Focus} from "../components/DesktopShot"
import {Phone} from "../components/Phone"
import type {Cue} from "../cues"

// "Add the people you need videos from. They get a link by email or text.
// No app. No account."
const CAP = "create"
const m = (l: string) => mark(CAP, l)

export function peoplePlan(s: SceneInfo) {
  const p1 = phrase(s, 1)
  const p2 = phrase(s, 2)
  const handoff = p1.start + 0.05
  // Pick up where the Ask scene's last clip left off.
  const ask = scene("ask")
  const askWide = askPlan(ask).clips.at(-1)!
  const start = askWide.from + (ask.duration - askWide.at) * (askWide.rate ?? 1)
  const typing = {at: 0, from: start, rate: Math.max(1, (m("people-done") + 0.7 - start) / handoff)}
  const clips: ClipSpec[] = [typing]
  const focus: Focus[] = [
    {at: 0, box: markBox(CAP, "people"), label: "Who should record it", highlight: true, pad: 60},
  ]
  const p1len = p1.end - p1.start
  return {
    clips,
    focus,
    handoff,
    email: p1.start + p1len * 0.45,
    sms: p1.start + p1len * 0.8,
    noApp: p2.start,
    noAccount: p2.start + (p2.end - p2.start) * 0.5,
  }
}

export function peopleCues(s: SceneInfo): Cue[] {
  const p = peoplePlan(s)
  const keys: Cue[] = []
  for (let t = 0.1; t < p.handoff - 0.9; t += 0.11) keys.push({t, sfx: "key", volume: 0.25})
  return [
    ...keys,
    {t: p.handoff, sfx: "whoosh", volume: 0.45},
    {t: p.email, sfx: "notify", volume: 0.55},
    {t: p.sms, sfx: "notify", volume: 0.45},
    {t: p.noApp, sfx: "pop", volume: 0.5},
    {t: p.noAccount, sfx: "pop", volume: 0.5},
  ]
}

export const People: React.FC<{s: SceneInfo}> = ({s}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const p = peoplePlan(s)
  const out = tween(t, [p.handoff - 0.05, p.handoff + 0.95], [0, 1], inOut)
  const phoneIn = pop(frame, fps, p.handoff + 0.1, {damping: 18, stiffness: 110})
  const emailIn = pop(frame, fps, p.email - 0.15, {damping: 18, stiffness: 120})
  const tapAt = s.duration - 0.45

  return (
    <AbsoluteFill>
      {out < 1 ? (
        <AbsoluteFill
          style={{
            transform: `translateX(${-out * 700}px) scale(${1 - out * 0.35}) rotateY(${out * 18}deg)`,
            opacity: 1 - out,
            perspective: 2000,
          }}
        >
          <DesktopShot
            capture={CAP}
            clips={p.clips}
            focus={p.focus}
            url="capsend.app/o/northpeak/requests/new"
            enter={null}
            move={0.8}
          />
        </AbsoluteFill>
      ) : null}

      {/* The real invite email, as Marcus sees it. */}
      {emailIn > 0.001 ? (
        <div
          style={{
            position: "absolute",
            left: 365,
            top: 120,
            width: 560,
            height: 620,
            borderRadius: 28,
            overflow: "hidden",
            background: "#fff",
            boxShadow: shadow.window,
            transform: `translateX(${(1 - emailIn) * -200}px) rotate(${-3 * emailIn}deg)`,
            opacity: Math.min(1, emailIn * 1.3),
          }}
        >
          <div style={{...text, height: 64, display: "flex", alignItems: "center", padding: "0 26px", gap: 12, borderBottom: `1px solid ${C.line}`, background: C.subtle}}>
            <MailIcon size={34} />
            <div style={{fontSize: 21, fontWeight: 600, color: C.ink}}>Inbox</div>
          </div>
          <Img src={staticFile("captures/email.png")} style={{width: 560, display: "block"}} />
        </div>
      ) : null}

      {/* Marcus's phone. */}
      {phoneIn > 0.001 ? <div
        style={{
          position: "absolute",
          left: 1115,
          top: 42,
          transform: `translateY(${(1 - phoneIn) * 900}px) rotate(${(1 - phoneIn) * 10}deg)`,
        }}
      >
        <Phone s={1.08} page={{width: 390, height: 844}} status="dark">
          <LockScreen t={t} emailAt={p.email} smsAt={p.sms} tapAt={tapAt} />
        </Phone>
      </div> : null}

      <Promise at={p.noApp} y={790} label="No app to install" />
      <Promise at={p.noAccount} y={876} label="No account to create" />
    </AbsoluteFill>
  )
}

const LockScreen: React.FC<{t: number; emailAt: number; smsAt: number; tapAt: number}> = ({t, emailAt, smsAt, tapAt}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const e = pop(frame, fps, emailAt, {damping: 16, stiffness: 170})
  const m = pop(frame, fps, smsAt, {damping: 16, stiffness: 170})
  const tap = tween(t, [tapAt, tapAt + 0.4], [0, 1], expoOut)
  const subject = messages?.email.subject ?? "Maya asked you for a video: Q4 kickoff: welcome from leadership"
  return (
    <AbsoluteFill
      style={{
        ...text,
        background:
          "radial-gradient(120% 70% at 20% 10%, #6d5ff5 0%, rgba(109,95,245,0) 60%), radial-gradient(90% 60% at 90% 90%, #e5484d 0%, rgba(229,72,77,0) 55%), linear-gradient(160deg, #1d1840, #0b0b16)",
        color: "#fff",
        alignItems: "center",
      }}
    >
      <div style={{marginTop: 40, fontSize: 22, fontWeight: 600, opacity: 0.85}}>Monday, October 5</div>
      <div style={{fontSize: 104, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, marginTop: 4}}>9:41</div>
      <div style={{position: "absolute", top: 250, left: 12, right: 12}}>
        {/* The newest notification opens its own space, then fades in. */}
        <div style={{height: 116 * Math.min(1, Math.max(0, m)), overflow: "visible"}}>
        <Notice
          k={m}
          icon={<MessagesIcon />}
          app="Text message"
          title="Northpeak"
          body="Maya Chen at Northpeak asked you for a video: Q4 kickoff. Record here: capsend.app/r/x26gyx"
          press={tap}
          fadeOnly
        />
        </div>
        <div style={{height: 12 * Math.min(1, Math.max(0, m))}} />
        <Notice k={e} icon={<MailIcon size={38} />} app="Email" title="Maya Chen (Northpeak) via CapSend" body={subject} />
      </div>
      {tap > 0 && tap < 1 ? (
        <div
          style={{
            position: "absolute",
            left: 195 - 40,
            top: 300,
            width: 80,
            height: 80,
            borderRadius: 40,
            background: "rgba(255,255,255,0.5)",
            transform: `scale(${0.5 + tap})`,
            opacity: 1 - tap,
          }}
        />
      ) : null}
    </AbsoluteFill>
  )
}

const Notice: React.FC<{k: number; icon: React.ReactNode; app: string; title: string; body: string; press?: number; fadeOnly?: boolean}> = ({
  k,
  icon,
  app,
  title,
  body,
  press = 0,
  fadeOnly = false,
}) => {
  if (k <= 0.001) return null
  const fade = fadeOnly ? Math.max(0, Math.min(1, (k - 0.55) / 0.45)) : Math.min(1, k * 1.4)
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 24,
        background: "rgba(245,245,250,0.78)",
        color: C.ink,
        display: "flex",
        gap: 12,
        transform: fadeOnly ? `scale(${(0.96 + 0.04 * fade) * (1 - press * 0.04)})` : `translateY(${(1 - k) * -60}px) scale(${(0.9 + 0.1 * Math.min(1, k)) * (1 - press * 0.04)})`,
        opacity: fade,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{flexShrink: 0}}>{icon}</div>
      <div style={{minWidth: 0, flex: 1}}>
        <div style={{display: "flex", justifyContent: "space-between", fontSize: 13, color: C.ink3, marginBottom: 1}}>
          <span>{app}</span>
          <span>now</span>
        </div>
        <div style={{fontSize: 16.5, fontWeight: 600}}>{title}</div>
        <div style={{fontSize: 16, lineHeight: 1.3, color: C.ink, marginTop: 2}}>{body}</div>
      </div>
    </div>
  )
}

const MessagesIcon = () => (
  <div style={{width: 38, height: 38, borderRadius: 9, background: "linear-gradient(#67e27a, #1fbf3f)", display: "flex", alignItems: "center", justifyContent: "center"}}>
    <svg width="24" height="24" viewBox="0 0 24 24">
      <path d="M12 4C7 4 3 7.2 3 11.2c0 2.3 1.3 4.3 3.4 5.6-.2 1.3-.9 2.4-1.9 3.2 2 0 3.7-.7 4.9-1.8.8.2 1.7.3 2.6.3 5 0 9-3.2 9-7.3S17 4 12 4Z" fill="#fff" />
    </svg>
  </div>
)

const MailIcon: React.FC<{size: number}> = ({size}) => (
  <div style={{width: size, height: size, borderRadius: size * 0.24, background: "linear-gradient(#5ab0ff, #1d77f2)", display: "flex", alignItems: "center", justifyContent: "center"}}>
    <svg width={size * 0.64} height={size * 0.64} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="#fff" strokeWidth="1.8" />
      <path d="m4 7 8 6 8-6" stroke="#fff" strokeWidth="1.8" />
    </svg>
  </div>
)

const Promise: React.FC<{at: number; y: number; label: string}> = ({at, y, label}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const k = pop(frame, fps, at, {damping: 14, stiffness: 190})
  if (k <= 0.001) return null
  return (
    <div
      style={{
        ...text,
        position: "absolute",
        left: 365,
        top: y,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 26px 14px 16px",
        borderRadius: 999,
        background: C.ink,
        color: "#fff",
        fontSize: 34,
        fontWeight: 600,
        letterSpacing: "-0.01em",
        boxShadow: shadow.soft,
        transform: `scale(${0.85 + 0.15 * k}) translateX(${(1 - k) * -30}px)`,
        transformOrigin: "left center",
        opacity: Math.min(1, k * 1.6),
      }}
    >
      <div style={{width: 40, height: 40, borderRadius: 20, background: C.success, display: "flex", alignItems: "center", justifyContent: "center"}}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="m5 12.5 4.5 4.5L19 7.5" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {label}
    </div>
  )
}
