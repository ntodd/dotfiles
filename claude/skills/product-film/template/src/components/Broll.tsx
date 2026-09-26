import React from "react"
import {AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig} from "remotion"
import {inOut, pop, shadow, tween} from "../theme"
import {Clip} from "./Capture"

// Live-action b-roll framed as a card, graded a touch cooler and cleaner so
// it sits with the product shots instead of fighting them.
export const Broll: React.FC<{clip: string; from: number; start: number; end: number; width?: number}> = ({
  clip,
  from,
  start,
  end,
  width = 1640,
}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  if (t < start - 0.01 || t > end + 0.4) return null
  const k = pop(frame, fps, start, {damping: 20, stiffness: 140})
  const out = tween(t, [end - 0.05, end + 0.3], [0, 1], inOut)
  const h = (width * 9) / 16
  return (
    <AbsoluteFill style={{alignItems: "center", justifyContent: "center", opacity: Math.min(1, k * 2) * (1 - out)}}>
      <div
        style={{
          width,
          height: h,
          borderRadius: 30,
          overflow: "hidden",
          boxShadow: shadow.window,
          transform: `scale(${(0.92 + 0.08 * k) * (1 + out * 0.06)})`,
        }}
      >
        <Sequence from={Math.round(start * fps)} layout="none">
          <AbsoluteFill style={{transform: `scale(${1.03 + Math.max(0, t - start) * 0.025})`, filter: "saturate(0.92) contrast(1.05) brightness(1.02)"}}>
            <Clip name={clip} from={from} />
          </AbsoluteFill>
        </Sequence>
      </div>
    </AbsoluteFill>
  )
}
