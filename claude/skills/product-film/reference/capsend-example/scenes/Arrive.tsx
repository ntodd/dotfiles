import React from "react"
import {AbsoluteFill, Sequence, useVideoConfig} from "remotion"
import {mark, markBox, phrase, timeline, type SceneInfo} from "../data"
import {Broll} from "../components/Broll"
import {DesktopShot, type ClipSpec, type Focus} from "../components/DesktopShot"
import type {Cue} from "../cues"

// "Back at your desk, watch every video arrive, live. Download the
// original, exactly as it was recorded, or hand an edit-ready copy straight
// to your editor."
const D = "live-desk"
const S = "submission"

export function arrivePlan(s: SceneInfo) {
  const p0 = phrase(s, 0)
  const p2 = phrase(s, 2)
  const p3 = phrase(s, 3)
  const broll = timeline.options.broll ? {start: 0, end: p0.start + 0.9} : {start: 0, end: 0}
  const desk = broll.end
  const arrivedAt = p0.end - 0.35 // the tile pops in on "arrive"
  const page = p2.start - 0.6
  const original = p2.start + 0.25
  const specs = p2.start + (p2.end - p2.start) * 0.6
  const edit = p3.start + 0.15
  const editor = p3.start + (p3.end - p3.start) * 0.62
  // One window, one camera: the dashboard dissolves into the video's page
  // while the camera glides from the videos row to the player.
  const clips: ClipSpec[] = [
    {at: desk, capture: D, from: mark(D, "arrived") - (arrivedAt - desk), rate: 1},
    {at: page, capture: S, from: mark(S, "page") + 0.2, rate: 1.1, fade: 0.45},
    {at: original, capture: S, from: mark(S, "original") - 0.5, rate: 1, fade: 0.3},
    {at: specs, capture: S, from: mark(S, "specs") - 0.15, rate: 1, fade: 0.3},
    {at: edit, capture: S, from: mark(S, "edit-ready") - 0.4, rate: 1, fade: 0.3},
    {at: editor, capture: S, from: mark(S, "editor") - 0.4, rate: 0.85, fade: 0.3},
  ]
  const tiles = markBox(D, "arrived")
  const focus: Focus[] = [
    {at: desk, box: tiles ? {...tiles, width: tiles.width * 3 + 32} : null, label: "Arrives live", highlight: true, pad: 50},
    {at: page, box: markBox(S, "page"), pad: 40},
    {at: original, box: markBox(S, "original"), highlight: true, pad: 110},
    {at: specs, box: markBox(S, "specs"), label: "Exactly as recorded", highlight: true, pad: 30},
    {at: edit, box: markBox(S, "edit-ready"), highlight: true, pad: 110},
    {at: editor, box: markBox(S, "editor"), label: "Straight to your editor", highlight: true, pad: 120, side: "left"},
  ]
  return {broll, desk, arrivedAt, page, clips, focus}
}

export function arriveCues(s: SceneInfo): Cue[] {
  const p = arrivePlan(s)
  return [
    {t: p.desk, sfx: "whoosh-short", volume: 0.35},
    {t: p.arrivedAt, sfx: "notify", volume: 0.55},
    {t: p.page, sfx: "click", volume: 0.5},
  ]
}

export const Arrive: React.FC<{s: SceneInfo}> = ({s}) => {
  const {fps} = useVideoConfig()
  const p = arrivePlan(s)
  const f = (x: number) => Math.round(x * fps)
  return (
    <AbsoluteFill>
      <Sequence from={f(p.desk)}>
        <DesktopShot
          capture={D}
          clips={p.clips.map((c) => ({...c, at: c.at - p.desk}))}
          focus={p.focus.map((x) => ({...x, at: x.at - p.desk}))}
          url="capsend.app/o/northpeak"
          enter={0}
          enterFrom={120}
        />
      </Sequence>
      {p.broll.end > 0 ? <Broll clip="maya-happy" from={2.0} start={0} end={p.broll.end} /> : null}
    </AbsoluteFill>
  )
}
