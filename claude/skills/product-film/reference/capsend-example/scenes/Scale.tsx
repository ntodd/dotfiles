import React from "react"
import {AbsoluteFill, Loop, useCurrentFrame, useVideoConfig} from "remotion"
import {C, inOut, pop, text, tween} from "../theme"
import {phrase, timeline, type SceneInfo} from "../data"
import {Clip} from "../components/Capture"
import type {Cue} from "../cues"

// "One CEO, or five hundred customers. Every video comes back looking the
// way it should." One tile, then a wall of them, popping in on the beat.
// Each clip, who it shows, and the name they go by where they appear
// elsewhere in the film.
const FACES: Array<{clip: string; gender: "f" | "m"; name: string}> = [
  {clip: "face-warehouse", gender: "f", name: "Rosa Delgado"},
  {clip: "face-cafe", gender: "m", name: "Kenji Mori"},
  {clip: "face-clinic", gender: "f", name: "Anjali Rao"},
  {clip: "face-elena", gender: "f", name: "Elena Ruiz"},
  {clip: "face-backstage", gender: "m", name: "Daniel Price"},
  {clip: "face-engineer", gender: "f", name: "Amara Okoye"},
  {clip: "face-homeoffice", gender: "f", name: "Claire Whitman"},
  {clip: "face-sam", gender: "m", name: "Sam Okafor"},
  {clip: "face-farmer", gender: "m", name: "Walt Henning"},
  {clip: "face-retail", gender: "m", name: "Marcus Hill"},
  {clip: "face-lab", gender: "f", name: "Leila Haddad"},
  {clip: "face-construction", gender: "m", name: "Sione Taufa"},
  {clip: "face-teacher", gender: "f", name: "Denise Carter"},
  {clip: "face-exec2", gender: "m", name: "Raj Malhotra"},
  {clip: "face-chef", gender: "m", name: "Diego Alvarez"},
  {clip: "face-student", gender: "f", name: "Mina Park"},
]
// Names for a person's second appearance on the wall.
const MORE: Record<"f" | "m", string[]> = {
  f: ["Priya Nair", "Aiko Tanaka", "Lena Fischer", "Grace Liu", "Sofia Marin", "Mei Chen", "Ana Ruiz", "Ivy Chen", "Zara Ali", "Maria Costa", "Nora Quinn"],
  m: ["Jonah Weiss", "Tom Hale", "Omar Haddad", "Ben Carter", "Luis Romero", "Kim Osei", "Noah Brooks", "Leo Martin", "Theo Grant", "Ravi Shah", "Owen Price"],
}

// The wall, laid out once. Repeats of a person sit at least two rows apart,
// are mirrored, and take the next unused name of the same gender.
const WALL = (() => {
  const used = {f: 0, m: 0}
  return Array.from({length: 7 * 5 - 1}, (_, n) => {
    const f = FACES[(n * 7) % FACES.length]
    const mirror = n >= FACES.length
    const name = mirror ? MORE[f.gender][used[f.gender]++ % MORE[f.gender].length] : f.name
    return {clip: f.clip, name, mirror}
  })
})()

const COLS = 7
const ROWS = 5
const TW = 330
const TH = (TW * 9) / 16
const GAP = 22
const HERO = Math.floor((ROWS * COLS) / 2) // the center tile

export function scalePlan(s: SceneInfo) {
  const p1 = phrase(s, 1)
  const p2 = phrase(s, 2)
  const beats = timeline.beats.map((b) => b - s.start).filter((b) => b >= p1.start - 0.2 && b < s.duration)
  return {wallAt: p1.start - 0.1, textAt: p2.start, beats}
}

export function scaleCues(s: SceneInfo): Cue[] {
  const p = scalePlan(s)
  return [
    {t: 0.02, sfx: "whoosh-short", volume: 0.35},
    ...p.beats.slice(0, 6).map((b) => ({t: b, sfx: "pop", volume: 0.3})),
  ]
}

export const Scale: React.FC<{s: SceneInfo}> = ({s}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const p = scalePlan(s)

  const gridW = COLS * TW + (COLS - 1) * GAP
  const gridH = ROWS * TH + (ROWS - 1) * GAP
  // The hero tile starts big and centered; the camera pulls back to the wall.
  const heroScale = 1500 / TW
  const pull = tween(t, [p.wallAt - 0.3, p.wallAt + 1.9], [0, 1], inOut)
  const zoom = heroScale + (0.86 - heroScale) * pull + tween(t, [p.wallAt + 1.9, s.duration + 0.6], [0, -0.05], (x) => x)
  const enter = pop(frame, fps, 0, {damping: 18, stiffness: 120})

  const hr = Math.floor(HERO / COLS)
  const hc = HERO % COLS
  const heroX = hc * (TW + GAP) + TW / 2 - gridW / 2
  const heroY = hr * (TH + GAP) + TH / 2 - gridH / 2

  return (
    <AbsoluteFill style={{alignItems: "center", justifyContent: "center"}}>
      <div
        style={{
          position: "relative",
          width: gridW,
          height: gridH,
          transform: `scale(${zoom * (0.92 + 0.08 * enter)}) translate(${-heroX * (1 - pull)}px, ${-heroY * (1 - pull)}px)`,
          opacity: enter,
        }}
      >
        {Array.from({length: COLS * ROWS}, (_, i) => {
          const r = Math.floor(i / COLS)
          const c = i % COLS
          const hero = i === HERO
          // Spread repeats of the same person at least two rows apart, and
          // mirror the second appearance.
          const w = WALL[i < HERO ? i : i - 1]
          const name = hero ? "Marcus Bell" : w.name
          const face = w.clip
          const mirror = w.mirror
          // Tiles pop in ring by ring, on the beat, as the camera pulls back.
          const ring = Math.max(Math.abs(r - hr), Math.abs(c - hc))
          const beat = p.beats[Math.min(ring - 1, p.beats.length - 1)] ?? p.wallAt
          const k = hero ? 1 : pop(frame, fps, beat + ((i * 7) % 5) * 0.03, {damping: 14, stiffness: 180})
          if (k <= 0.001) return null
          return (
            <Tile
              key={i}
              x={c * (TW + GAP)}
              y={r * (TH + GAP)}
              k={k}
              clip={hero ? "marcus-talk" : face}
              mirror={mirror}
              from={((i * 13) % 7) * 0.3}
              name={name}
              hero={hero}
              detail={hero ? 1 - pull : 0}
            />
          )
        })}
      </div>
    </AbsoluteFill>
  )
}

const Tile: React.FC<{x: number; y: number; k: number; clip: string; from: number; name: string; hero: boolean; detail: number; mirror?: boolean}> = ({
  x,
  y,
  k,
  clip,
  from,
  name,
  hero,
  detail,
  mirror = false,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: TW,
      height: TH,
      borderRadius: 14 - detail * 10,
      overflow: "hidden",
      background: C.studio3,
      transform: `scale(${0.6 + 0.4 * k})`,
      opacity: Math.min(1, k * 1.3),
      boxShadow: hero ? `0 0 0 ${3 - detail * 3}px ${C.success}` : "0 10px 30px rgba(0,0,0,0.35)",
    }}
  >
    {hero ? (
      <Clip name={clip} />
    ) : (
      <Loop durationInFrames={Math.round((4 - from) * 30 / 0.8) - 1}>
        <Clip name={clip} from={from} rate={0.8} style={mirror ? {transform: "scaleX(-1) scale(1.08)"} : undefined} />
      </Loop>
    )}
    <div
      style={{
        ...text,
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "22px 12px 9px",
        background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
        color: "#fff",
        fontSize: 15 - detail * 12,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 7,
        opacity: 1 - detail,
      }}
    >
      <div style={{width: 8, height: 8, borderRadius: 4, background: "#3ddc84"}} />
      {name}
    </div>
    <div
      style={{
        ...text,
        position: "absolute",
        left: 8,
        top: 8,
        padding: "2px 7px",
        borderRadius: 5,
        background: "rgba(0,0,0,0.55)",
        color: "#fff",
        fontSize: 11,
        fontWeight: 700,
        opacity: 1 - detail,
      }}
    >
      {hero ? "4K" : clip === "face-elena" || clip === "face-sam" ? "1080p" : ["4K", "1080p"][(x + y) % 2 === 0 ? 0 : 1]}
    </div>
  </div>
)
