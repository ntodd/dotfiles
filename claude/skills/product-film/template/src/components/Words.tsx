import React from "react"
import {useCurrentFrame, useVideoConfig} from "remotion"
import {C, pop, text} from "../theme"

// Words rise into place one after another from behind a mask. Wrap a word
// in *asterisks* to color it with the accent.
export const Words: React.FC<{
  children: string
  at: number
  stagger?: number
  size: number
  weight?: number
  color?: string
  accent?: string
  style?: React.CSSProperties
  out?: number | null
}> = ({children, at, stagger = 0.07, size, weight = 600, color = C.ink, accent = C.accent, style, out = null}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const words = children.split(" ")
  return (
    <div
      style={{
        ...text,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        columnGap: size * 0.26,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: "-0.03em",
        lineHeight: 1.12,
        ...style,
      }}
    >
      {(() => {
        let inside = false
        return words.map((w) => {
          const starts = w.startsWith("*")
          const hot = inside || starts
          if (starts) inside = true
          if (w.endsWith("*")) inside = false
          return hot
        })
      })().map((hot, i) => {
        const w = words[i]
        const k = pop(frame, fps, at + i * stagger, {damping: 18, stiffness: 150})
        const o = out === null ? 0 : pop(frame, fps, out + i * 0.03, {damping: 20, stiffness: 160})
        const clean = w.replace(/\*/g, "")
        return (
          <span key={i} style={{display: "inline-block", overflow: "hidden", paddingBottom: size * 0.12, marginBottom: -size * 0.12}}>
            <span
              style={{
                display: "inline-block",
                transform: `translateY(${(1 - k) * 110 - o * 110}%)`,
                color: hot ? accent : color,
              }}
            >
              {clean}
            </span>
          </span>
        )
      })}
    </div>
  )
}
