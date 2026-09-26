import React from "react"
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion"
import {timeline} from "../data"
import {text} from "../theme"

export type Cap = {start: number; end: number; text: string}

// Splits each VO line into sentences and times them against the detected
// speech segments, in proportion to their length. Also used for the .vtt.
export function captionCues(): Cap[] {
  const out: Cap[] = []
  for (const s of timeline.scenes) {
    const vo = s.vo
    if (!vo) continue
    const sentences = vo.text.match(/[^.?!…]+(?:\.\.\.|[.?!…])?/g)?.map((x) => x.trim()).filter(Boolean) ?? [vo.text]
    const segs = vo.speech.length ? vo.speech : [[0, vo.duration] as [number, number]]
    const speechLen = segs.reduce((a, [x, y]) => a + (y - x), 0)
    const total = sentences.reduce((a, x) => a + x.length, 0)
    // Map a fraction of the speech onto real time, skipping pauses.
    const at = (frac: number) => {
      let left = frac * speechLen
      for (const [x, y] of segs) {
        if (left <= y - x) return x + left
        left -= y - x
      }
      return segs.at(-1)![1]
    }
    let acc = 0
    for (const sentence of sentences) {
      const a = at(acc / total)
      acc += sentence.length
      const b = at(acc / total)
      out.push({start: vo.at + a, end: vo.at + b + 0.15, text: sentence})
    }
  }
  out.forEach((c, i) => {
    if (out[i + 1]) c.end = Math.min(c.end, out[i + 1].start - 0.02)
  })
  return out
}

export const Captions: React.FC = () => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const cue = captionCues().find((c) => t >= c.start && t < c.end)
  if (!cue) return null
  return (
    <AbsoluteFill style={{justifyContent: "flex-end", alignItems: "center", paddingBottom: 54}}>
      <div
        style={{
          ...text,
          maxWidth: 1400,
          padding: "12px 26px",
          borderRadius: 14,
          background: "rgba(11,11,15,0.78)",
          color: "#fff",
          fontSize: 38,
          fontWeight: 500,
          lineHeight: 1.3,
          textAlign: "center",
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  )
}
