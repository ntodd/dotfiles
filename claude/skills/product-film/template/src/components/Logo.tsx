import React from "react"
import {C, text} from "../theme"

// The CapSend mark (from layouts.ex): a rounded ink tile, a white ring, and
// the record-red dot. Each part can be animated separately (0..1).
export const Mark: React.FC<{size: number; tile?: number; ring?: number; dot?: number; inverted?: boolean}> = ({
  size,
  tile = 1,
  ring = 1,
  dot = 1,
  inverted = false,
}) => {
  const circ = 2 * Math.PI * 5.75
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{overflow: "visible"}}>
      <rect
        x={12 - 12 * tile}
        y={12 - 12 * tile}
        width={24 * tile}
        height={24 * tile}
        rx={7 * tile}
        fill={inverted ? "#fff" : C.ink}
        opacity={Math.min(1, tile * 1.5)}
      />
      <circle
        cx="12"
        cy="12"
        r="5.75"
        stroke={inverted ? C.ink : "#fff"}
        strokeWidth="2"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - ring)}
        transform="rotate(-90 12 12)"
        strokeLinecap="round"
        opacity={ring > 0 ? 1 : 0}
      />
      <circle cx="12" cy="12" r={2.6 * dot} fill={C.record} />
    </svg>
  )
}

export const Wordmark: React.FC<{size: number; color?: string; reveal?: number}> = ({size, color = C.ink, reveal = 1}) => (
  <div style={{overflow: "hidden", paddingRight: size * 0.1}}>
    <div
      style={{
        ...text,
        fontSize: size,
        fontWeight: 650 as any,
        letterSpacing: "-0.035em",
        color,
        lineHeight: 1.1,
        transform: `translateX(${(1 - reveal) * -105}%)`,
        opacity: Math.min(1, reveal * 2),
      }}
    >
      CapSend
    </div>
  </div>
)
