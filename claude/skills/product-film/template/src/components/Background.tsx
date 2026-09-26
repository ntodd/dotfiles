import React from "react"
import {AbsoluteFill, interpolateColors, useCurrentFrame, useVideoConfig} from "remotion"
import {C} from "../theme"

// Soft studio backdrop: a cool white (or near-black) field with slow,
// blurred color glows and a whisper of grain. `dark` blends 0..1.
export const Background: React.FC<{dark?: number; glow?: number; hue?: "violet" | "red"}> = ({
  dark = 0,
  glow = 1,
  hue = "violet",
}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const base = interpolateColors(dark, [0, 1], ["#f6f6f9", C.studio])
  const edge = interpolateColors(dark, [0, 1], ["#ececf3", "#050507"])
  const a = hue === "red" ? "229,72,77" : "91,80,232"
  const b = hue === "red" ? "91,80,232" : "229,72,77"
  const glowAlpha = (0.16 + dark * 0.12) * glow
  return (
    <AbsoluteFill style={{background: `radial-gradient(120% 90% at 50% 40%, ${base} 40%, ${edge} 100%)`}}>
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          left: 1100 + Math.sin(t * 0.35) * 120,
          top: -380 + Math.cos(t * 0.28) * 80,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${a},${glowAlpha}) 0%, rgba(${a},0) 65%)`,
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 900,
          height: 900,
          left: -260 + Math.cos(t * 0.3) * 100,
          top: 420 + Math.sin(t * 0.25) * 90,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(${b},${glowAlpha * 0.55}) 0%, rgba(${b},0) 65%)`,
          filter: "blur(40px)",
        }}
      />
      <Grain opacity={0.045 + dark * 0.03} seed={Math.floor(frame / 2) % 8} />
    </AbsoluteFill>
  )
}

const Grain: React.FC<{opacity: number; seed: number}> = ({opacity, seed}) => (
  <AbsoluteFill style={{opacity, mixBlendMode: "overlay", pointerEvents: "none"}}>
    <svg width="100%" height="100%">
      <filter id={`grain-${seed}`}>
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
    </svg>
  </AbsoluteFill>
)
