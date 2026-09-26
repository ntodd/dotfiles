import React from "react"
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from "remotion"
import {timeline, type SceneInfo} from "./data"
import {Background} from "./components/Background"
import {Captions} from "./components/Captions"
import {tween} from "./theme"
import type {Cue} from "./cues"
import {Statement, statementCues} from "./scenes/Statement"
import {EndCard, endCardCues} from "./scenes/EndCard"

// Scene components by name. A scene in script.yaml picks one with
// `component:` (default: its id). Add your film's scenes here.
const SCENES: Record<string, [React.FC<{s: SceneInfo}>, (s: SceneInfo) => Cue[]]> = {
  Statement: [Statement, statementCues],
  EndCard: [EndCard, endCardCues],
}
const sceneOf = (s: SceneInfo) => {
  const entry = SCENES[s.component] ?? SCENES[s.id]
  if (!entry) throw new Error(`No scene component "${s.component}" for scene "${s.id}". Register it in src/Main.tsx.`)
  return entry
}

// Scenes marked `dark: true` in script.yaml get the studio background.
const SFX_GAIN = 1.25

function darkness(t: number) {
  let d = 0
  for (const s of timeline.scenes) {
    if (!s.dark) continue
    const a = s.start
    const b = s.start + s.duration
    d = Math.max(d, Math.min(tween(t, [a - 0.1, a + 0.45], [0, 1]), tween(t, [b - 0.2, b + 0.3], [1, 0])))
  }
  return d
}

// Music level: full between lines, ducked under the voice with a quick
// attack and a slower release, faded out after the final hit.
const ALL_CUES = timeline.scenes.flatMap((s) => sceneOf(s)[1](s).map((c) => ({...c, t: s.start + c.t})))
const DUCKS = [
  ...timeline.voRanges,
  ...ALL_CUES.filter((c) => c.duck).map((c) => ({start: c.t, end: c.t + (c.duration ?? 1)})),
]

function musicLevel(t: number) {
  const {volume, duck} = timeline.music
  let under = 0
  for (const r of DUCKS) {
    const attack = tween(t, [r.start - 0.25, r.start], [0, 1], (x) => x)
    const release = tween(t, [r.end, r.end + 0.45], [1, 0], (x) => x)
    under = Math.max(under, Math.min(attack, release))
  }
  const fadeOut = tween(t, [timeline.endHit + 1.6, timeline.duration], [1, 0], (x) => x * x)
  return (volume - (volume - duck) * under) * fadeOut
}

// `stems` renders only some audio (for mixing checks): e.g. ["sfx"].
// Cross-dissolve by default; a "dip" fades the old scene out first, then
// the new one in, so busy frames never overlap.
const Dissolve: React.FC<{inFor: number; inDip: boolean; outAt: number; outFor: number; outDip: boolean; children: React.ReactNode}> = ({
  inFor,
  inDip,
  outAt,
  outFor,
  outDip,
  children,
}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const smooth = (x: number) => x * x * (3 - 2 * x)
  // Dips overlap a touch in the middle so the frame is never empty.
  const a = inFor > 0 ? tween(t, [inDip ? inFor * 0.25 : 0, inFor], [0, 1], smooth) : 1
  const b = outFor > 0 ? tween(t, [outAt, outAt + (outDip ? outFor * 0.5 : outFor)], [1, 0], smooth) : 1
  return <AbsoluteFill style={{opacity: Math.min(a, b)}}>{children}</AbsoluteFill>
}

export const Main: React.FC<{captions?: boolean; stems?: Array<"vo" | "music" | "sfx">}> = ({captions = false, stems}) => {
  const on = (k: "vo" | "music" | "sfx") => !stems || stems.includes(k)
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const f = (x: number) => Math.round(x * fps)
  return (
    <AbsoluteFill>
      <Background dark={darkness(t)} />
      {timeline.scenes.map((s, i) => {
        const [Scene] = sceneOf(s)
        // A scene keeps playing under the next one while it dissolves in.
        const next = timeline.scenes[i + 1]
        const out = next?.in ?? 0
        return (
          <Sequence key={s.id} name={s.id} from={f(s.start)} durationInFrames={Math.max(1, f(s.duration + out))}>
            <Dissolve inFor={s.in ?? 0} inDip={!!s.dip} outAt={s.duration} outFor={out} outDip={!!next?.dip}>
              <Scene s={s} />
            </Dissolve>
          </Sequence>
        )
      })}

      {/* Voiceover. */}
      {on("vo") && timeline.scenes.map((s) =>
        s.vo ? (
          <Sequence key={`vo-${s.id}`} name={`vo ${s.id}`} from={f(s.vo.at)} durationInFrames={f(s.vo.duration + 0.3)} layout="none">
            <Audio src={staticFile(s.vo.file)} volume={1} />
          </Sequence>
        ) : null
      )}

      {/* Music, edited to fit (see build-timeline). */}
      {on("music") && timeline.music.plan.map((seg, i) => {
        const len = seg.to - seg.from
        return (
          <Sequence key={`music-${i}`} name={`music ${i}`} from={f(seg.at)} durationInFrames={f(len)} layout="none">
            <Audio
              src={staticFile(timeline.music.file)}
              trimBefore={f(seg.from)}
              volume={(fr) => {
                const local = fr / fps
                // Short equal-power crossfade at edit points.
                const edge = Math.min(tween(local, [0, 0.04], [i === 0 ? 1 : 0, 1], (x) => x), tween(local, [len - 0.04, len], [1, i === timeline.music.plan.length - 1 ? 1 : 0], (x) => x))
                return musicLevel(seg.at + local) * Math.sin((edge * Math.PI) / 2)
              }}
            />
          </Sequence>
        )
      })}

      {/* Sound effects. */}
      {on("sfx") &&
        ALL_CUES.map((c, i) => (
          <Sequence key={`cue-${i}`} name={c.sfx ? `sfx ${c.sfx}` : `audio ${c.src}`} from={Math.max(0, f(c.t))} durationInFrames={f(c.duration ?? 2.5)} layout="none">
            {c.sfx ? (
              <Audio src={staticFile(`sfx/${c.sfx}.wav`)} volume={(c.volume ?? 1) * SFX_GAIN} />
            ) : (
              <Audio
                src={staticFile(c.src!)}
                trimBefore={f(c.from ?? 0)}
                volume={(fr) => (c.volume ?? 1) * Math.min(1, fr / 3, (f(c.duration ?? 1) - fr) / 6)}
              />
            )}
          </Sequence>
        ))}

      {captions ? <Captions /> : null}
    </AbsoluteFill>
  )
}
