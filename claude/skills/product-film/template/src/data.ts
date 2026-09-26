// Typed access to the generated timeline and capture markers.
import timelineJson from "./generated/timeline.json"
import capturesJson from "./generated/captures.json"

export type Box = {x: number; y: number; width: number; height: number}
export type SceneVo = {file: string; at: number; duration: number; text: string; speech: Array<[number, number]>}
export type SceneInfo = {
  id: string
  start: number
  duration: number
  in: number
  dip?: boolean
  component: string // which scene component renders it (script.yaml `component`, else the id)
  dark: boolean // studio (dark) background
  on_screen: any // free-form scene content from script.yaml
  vo: SceneVo | null
}

export const timeline = timelineJson as unknown as {
  fps: number
  width: number
  height: number
  duration: number
  durationInFrames: number
  drop: number
  endHit: number
  options: {broll: boolean; highlights: boolean}
  brand: {name?: string; tagline?: string; cta?: string; url?: string}
  tempo: number
  beats: number[]
  music: {file: string; plan: Array<{at: number; from: number; to: number}>; volume: number; duck: number; edit: string}
  voRanges: Array<{start: number; end: number}>
  scenes: SceneInfo[]
}

type Capture = {
  duration: number
  viewport: {width: number; height: number}
  markers: Record<string, {t: number; box: Box | null}>
}
export const captures = (capturesJson as any).captures as Record<string, Capture>
export const messages = (capturesJson as any).messages as {
  email: {subject: string; from: string}
  links: Record<string, string>
} | null

export function scene(id: string): SceneInfo {
  const s = timeline.scenes.find((x) => x.id === id)
  if (!s) throw new Error(`no scene ${id}`)
  return s
}

// Time of a capture marker in seconds (capture-local).
export function mark(capture: string, label: string, fallback = 0): number {
  return captures[capture]?.markers[label]?.t ?? fallback
}
export function markBox(capture: string, label: string): Box | null {
  return captures[capture]?.markers[label]?.box ?? null
}

// Phrase timing for a scene's VO, in scene-local seconds. Phrase i is the
// i-th stretch of speech between pauses.
export function phrase(s: SceneInfo, i: number): {start: number; end: number} {
  const vo = s.vo
  if (!vo) return {start: 0, end: 0}
  const at = vo.at - s.start
  const seg = vo.speech[Math.min(i, vo.speech.length - 1)] ?? [0, vo.duration]
  return {start: at + seg[0], end: at + seg[1]}
}
