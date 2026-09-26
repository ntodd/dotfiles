import React from "react"
import {AbsoluteFill} from "remotion"
import {mark, markBox, phrase, type Box, type SceneInfo} from "../data"
import {DesktopShot, type ClipSpec, type Focus} from "../components/DesktopShot"
import {Lockup} from "./Reveal"
import {useCurrentFrame, useVideoConfig} from "remotion"
import {inOut, tween} from "../theme"
import type {Cue} from "../cues"

// "Say what you need, add a script for the teleprompter, and choose the
// format, quality, and length." Quick, zoomed cuts through the real form.
const CAP = "create"
const m = (label: string) => mark(CAP, label)

export const union = (...boxes: Array<Box | null>): Box | null => {
  const bs = boxes.filter(Boolean) as Box[]
  if (!bs.length) return null
  const x = Math.min(...bs.map((b) => b.x))
  const y = Math.min(...bs.map((b) => b.y))
  const r = Math.max(...bs.map((b) => b.x + b.width))
  const btm = Math.max(...bs.map((b) => b.y + b.height))
  return {x, y, width: r - x, height: btm - y}
}

// The form is one continuous take of the recording, speed-ramped: fast
// through typing and scrolling, never skipping, so the page and the camera
// never jump. Keyframes pin recording moments to beats in the voiceover.
function ramp(keys: Array<[number, number]>): ClipSpec[] {
  return keys.slice(0, -1).map(([at, from], i) => {
    const [nextAt, nextFrom] = keys[i + 1]
    return {at, from, rate: Math.max(0.3, (nextFrom - from) / (nextAt - at))}
  })
}

export function askPlan(s: SceneInfo) {
  const p1 = phrase(s, 1)
  const p2 = phrase(s, 2)
  const at = {
    title: 0,
    instructions: Math.max(0.9, p1.start - 0.7),
    script: p1.start + 0.05,
    options: p2.start + 0.05,
    wide: p2.end + 0.25,
  }
  // Shots dissolve into each other (no jumps, no fast-forward), and the
  // last one runs on, continuous, into the People scene.
  const optionsFrom = m("quality") - 0.7
  const optionsRate = Math.max(1, (m("length") + 0.5 - optionsFrom) / (at.wide - at.options))
  // The page scrolls down to "Who should record it?" between these two
  // points in the recording; play it slower than real time, camera wide.
  const scroll = {from: m("length") + 0.7, to: m("length") + 2.3}
  const clips: ClipSpec[] = [
    // Title, then on into the instructions: one take, the camera pans.
    {at: at.title, from: m("title") - 0.1, rate: 2.2},
    {at: at.script, from: m("script-paste") - 0.35, rate: 1.25, fade: 0.35},
    {at: at.options, from: optionsFrom, rate: optionsRate, fade: 0.35},
    ...ramp([
      [at.wide, m("length") + 0.5],
      [at.wide + 0.25, scroll.from],
      [at.wide + 0.25 + (scroll.to - scroll.from) / 0.85, scroll.to],
      [s.duration + 1, m("people") + 2.1],
    ]),
  ]
  const focus: Focus[] = [
    {at: at.title, box: markBox(CAP, "title"), label: "What you need", highlight: true, pad: 70},
    {at: at.instructions, box: markBox(CAP, "instructions"), label: "Instructions", highlight: true, pad: 60},
    {at: at.script, box: union(markBox(CAP, "script-paste"), markBox(CAP, "teleprompter")), label: "A script for the teleprompter", highlight: true, pad: 50},
    {at: at.options, box: union(markBox(CAP, "quality"), markBox(CAP, "length")), label: "Quality and length", highlight: true, pad: 40},
    {at: at.wide, box: null},
  ]
  return {clips, focus, at}
}

export function askCues(s: SceneInfo): Cue[] {
  const {clips} = askPlan(s)
  // A soft click where the recording clicks.
  const clicks = ["format", "teleprompter", "quality", "length"].map((l) => m(l))
  const cues: Cue[] = []
  clips.forEach((c, i) => {
    const end = clips[i + 1]?.at ?? s.duration
    for (const k of clicks) {
      const local = c.at + (k - c.from) / (c.rate ?? 1)
      if (local >= c.at && local < end) cues.push({t: local + 0.05, sfx: "click", volume: 0.5})
    }
  })
  cues.push({t: 0.05, sfx: "whoosh-short", volume: 0.35})
  return cues
}

export const Ask: React.FC<{s: SceneInfo}> = ({s}) => {
  const {clips, focus} = askPlan(s)
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const out = tween(frame / fps, [0, 0.55], [0, 1], inOut)
  return (
    <AbsoluteFill>
      {out < 1 ? <Lockup y={-out * 420} opacity={1 - out} /> : null}
      <DesktopShot capture={CAP} clips={clips} focus={focus} url="capsend.app/o/northpeak/requests/new" enter={0} enterFrom={340} />
    </AbsoluteFill>
  )
}
