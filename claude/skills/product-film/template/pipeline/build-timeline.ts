// Lays out the film: scene times, VO placement, and the music edit.
//   npx tsx pipeline/build-timeline.ts
//
// Inputs:  script.yaml, public/vo/manifest.json, public/music/analysis.json,
//          public/captures/*.json
// Output:  src/generated/timeline.json and src/generated/captures.json
//
// Rules, in order:
//   1. Each scene is lead + VO + tail long, and at least `min`.
//   2. The reveal starts on the music's drop. Spare time before it goes to
//      the hook's opening and the hold before the drop.
//   3. The last VO line ends right on the music's ending hit. If the film
//      is shorter than the music, whole 4-bar phrases are cut from the
//      track where the join sounds most seamless (or repeated if longer),
//      and the remainder is shared across the demo scenes as breathing room.
//   4. Every cut after the drop snaps to the nearest beat.
import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"

const ROOT = path.resolve(import.meta.dirname, "..")
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"))
const script = YAML.parse(fs.readFileSync(path.join(ROOT, "script.yaml"), "utf8"))
const vo = read("public/vo/manifest.json")
const music = read("public/music/analysis.json")

const DROP_SCENE = script.music.drop_scene ?? "reveal"
// Where spare time goes, by scene weight: music.breathe in script.yaml, or a
// scene's own `breathe:`, else 1 for every scene between the drop and the end.
const BREATHE: Record<string, number> = script.music.breathe ?? Object.fromEntries(
  script.scenes.map((s: any, i: number) => [s.id, s.breathe ?? (i > script.scenes.findIndex((x: any) => x.id === (script.music.drop_scene ?? "reveal")) && i < script.scenes.length - 1 ? 1 : 0)])
)
const phrase = 4 * 4 * (60 / music.tempo) // 4 bars of 4 beats

type Scene = {
  id: string
  lead: number
  tail: number
  min: number
  vo: number
  dissolve: number
  dip: boolean
  extraLead: number
  extraTail: number
  start: number
  duration: number
}

const scenes: Scene[] = script.scenes.map((s: any) => ({
  id: s.id,
  lead: s.lead ?? 0.2,
  tail: s.tail ?? 0.3,
  min: s.min ?? 0,
  vo: vo[s.id]?.duration ?? 0,
  dissolve: s.in ?? 0,
  dip: s.in_style === "dip",
  extraLead: 0,
  extraTail: 0,
  start: 0,
  duration: 0,
}))
const natural = (s: Scene) => Math.max(s.min, s.lead + s.vo + s.tail) + s.extraLead + s.extraTail
const revealIdx = scenes.findIndex((s) => s.id === DROP_SCENE)
const sum = (xs: Scene[]) => xs.reduce((a, s) => a + natural(s), 0)

// 2. Land the reveal on the drop.
const pre = sum(scenes.slice(0, revealIdx))
let musicDelay = 0 // video time at which track time 0 plays
if (pre <= music.drop) {
  const spare = music.drop - pre
  scenes[0].extraLead += spare * 0.35
  scenes[revealIdx - 1].extraTail += spare * 0.65
} else {
  musicDelay = pre - music.drop
}
const dropAt = music.drop + musicDelay

// 3. Fit the music's ending to the last line.
const last = scenes.at(-1)!
const body = sum(scenes.slice(revealIdx, -1)) + last.lead + last.vo
let slack = music.end_hit + musicDelay - (dropAt + body)

const energyAt = (t: number) => music.energy_db[Math.max(0, Math.min(music.energy_db.length - 1, Math.round(t * music.energy_hz)))]
const around = (t: number, a: number, b: number) => {
  let s = 0
  let n = 0
  for (let x = t + a; x < t + b; x += 0.25) {
    s += energyAt(x)
    n++
  }
  return s / n
}
// Candidate phrase boundaries after the first 8 bars of groove, well
// before the final build.
const bounds: number[] = []
for (let t = music.drop + 2 * phrase; t < music.end_hit - 2 * phrase; t += phrase) bounds.push(t)

type Segment = {from: number; to: number}
let segments: Segment[] = [{from: 0, to: music.duration}]
let edit = "none"
if (slack >= phrase) {
  const n = Math.floor(slack / phrase)
  let best: {a: number; score: number} | null = null
  for (const a of bounds) {
    const b = a + n * phrase
    if (b > music.end_hit - 2 * phrase + 0.01) continue
    const score = Math.abs(around(a, -2, 0) - around(b, -2, 0)) + Math.abs(around(a, 0, 2) - around(b, 0, 2))
    if (!best || score < best.score) best = {a, score}
  }
  if (best) {
    segments = [
      {from: 0, to: best.a},
      {from: best.a + n * phrase, to: music.duration},
    ]
    slack -= n * phrase
    edit = `cut ${n} phrase(s) at ${best.a.toFixed(2)}s (join score ${best.score.toFixed(1)})`
  }
} else if (slack < 0) {
  const n = Math.ceil(-slack / phrase)
  const a = bounds[0]
  segments = [
    {from: 0, to: a + n * phrase},
    {from: a, to: music.duration},
  ]
  slack += n * phrase
  edit = `repeated ${n} phrase(s) at ${a.toFixed(2)}s`
}

// Spread the remainder over the demo scenes: a third before each VO line,
// the rest after it, so the picture breathes around the words.
const weights = scenes.map((s) => BREATHE[s.id] ?? 0)
const total = weights.reduce((a, b) => a + b, 0)
scenes.forEach((s, i) => {
  const extra = total ? (slack * weights[i]) / total : 0
  s.extraLead += extra * 0.33
  s.extraTail += extra * 0.67
})

// Lay out, snapping cuts after the drop to beats (in video time).
const segLength = (s: Segment) => s.to - s.from
const trackToVideo = (t: number) => {
  let v = musicDelay
  for (const seg of segments) {
    if (t >= seg.from && t <= seg.to) return v + (t - seg.from)
    v += segLength(seg)
  }
  return NaN
}
const endHitVideo = trackToVideo(music.end_hit)
const beats: number[] = music.beats.map(trackToVideo).filter((t: number) => !Number.isNaN(t))
const snap = (t: number) => {
  let best = t
  for (const b of beats) if (Math.abs(b - t) < Math.abs(best - t)) best = b
  return Math.abs(best - t) <= 0.3 ? best : t
}

let t = 0
scenes.forEach((s, i) => {
  s.start = t
  let end = t + natural(s)
  if (i === revealIdx - 1) end = dropAt
  else if (i >= revealIdx && i < scenes.length - 1 && script.music.snap !== false) {
    const snapped = snap(end)
    const floor = t + s.lead + s.vo + 0.1
    end = snapped >= floor ? snapped : end
  }
  s.duration = end - t
  t = end
})
// The last scene: its VO ends on the hit, then the tail rings out.
const lastStart = last.start
last.extraLead = Math.max(0, endHitVideo - 0.05 - last.vo - last.lead - lastStart)
last.duration = last.lead + last.extraLead + last.vo + last.tail
const duration = lastStart + last.duration

// VO ranges, for ducking the music.
const voRanges = scenes
  .filter((s) => s.vo > 0)
  .map((s) => ({start: s.start + s.lead + s.extraLead, end: s.start + s.lead + s.extraLead + s.vo}))

// Music playback: segments back to back in video time.
let at = musicDelay
const musicPlan = segments.map((seg) => {
  const p = {at, from: seg.from, to: Math.min(seg.to, seg.from + (duration - at))}
  at += segLength(seg)
  return p
}).filter((p) => p.to > p.from)

const out = {
  fps: script.fps,
  width: script.width,
  height: script.height,
  duration,
  durationInFrames: Math.ceil(duration * script.fps),
  drop: dropAt,
  endHit: endHitVideo,
  options: {broll: false, highlights: true, ...(script.options ?? {})},
  brand: script.brand ?? {},
  tempo: music.tempo,
  beats: beats.filter((b) => b <= duration),
  music: {
    file: "music/track.wav",
    plan: musicPlan,
    volume: script.music.volume ?? 0.55,
    duck: script.music.duck ?? 0.2,
    edit,
  },
  voRanges,
  scenes: scenes.map((s) => ({
    id: s.id,
    start: +s.start.toFixed(3),
    duration: +s.duration.toFixed(3),
    in: s.dissolve,
    dip: s.dip,
    component: script.scenes.find((x: any) => x.id === s.id)?.component ?? s.id,
    dark: !!script.scenes.find((x: any) => x.id === s.id)?.dark,
    on_screen: script.scenes.find((x: any) => x.id === s.id)?.on_screen ?? null,
    vo: vo[s.id]
      ? {file: vo[s.id].file, at: +(s.start + s.lead + s.extraLead).toFixed(3), duration: vo[s.id].duration, text: vo[s.id].text, speech: vo[s.id].speech ?? []}
      : null,
  })),
}

const gen = path.join(ROOT, "src/generated")
fs.mkdirSync(gen, {recursive: true})
fs.writeFileSync(path.join(gen, "timeline.json"), JSON.stringify(out, null, 2))

// Capture markers, keyed by capture and label.
const captures: Record<string, any> = {}
const capDir = path.join(ROOT, "public/captures")
for (const f of fs.existsSync(capDir) ? fs.readdirSync(capDir) : []) {
  if (!f.endsWith(".json") || f.startsWith(".") || f === "messages.json") continue
  const m = JSON.parse(fs.readFileSync(path.join(capDir, f), "utf8"))
  captures[m.name] = {
    duration: m.duration,
    viewport: m.viewport,
    markers: Object.fromEntries(m.markers.map((k: any) => [k.label, {t: k.t, box: k.box ?? null}])),
  }
}
const messages = fs.existsSync(path.join(capDir, "messages.json")) ? read("public/captures/messages.json") : null
fs.writeFileSync(path.join(gen, "captures.json"), JSON.stringify({captures, messages}, null, 2))

console.log(`duration ${duration.toFixed(2)}s (${out.durationInFrames} frames), drop at ${dropAt.toFixed(2)}s, music: ${edit}`)
for (const s of out.scenes) {
  console.log(
    `  ${s.id.padEnd(8)} ${s.start.toFixed(2).padStart(6)}s  ${s.duration.toFixed(2).padStart(5)}s` +
      (s.vo ? `  vo @ ${s.vo.at.toFixed(2)} (${s.vo.duration.toFixed(2)}s)` : "")
  )
}
