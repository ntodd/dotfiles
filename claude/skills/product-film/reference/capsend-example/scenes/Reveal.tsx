import React from "react"
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from "remotion"
import {C, expoOut, inOut, pop, tween} from "../theme"
import {phrase, type SceneInfo} from "../data"
import {Mark, Wordmark} from "../components/Logo"
import {Words} from "../components/Words"
import type {Cue} from "../cues"

// "Meet CapSend. Send a link. Get back the original." The record dot from
// the last scene blooms into the mark on the music's drop.
const MARK = 200

export function revealCues(s: SceneInfo): Cue[] {
  return [
    {t: 0, sfx: "thump", volume: 0.9},
    {t: 0.02, sfx: "whoosh", volume: 0.35},
  ]
}

export const Reveal: React.FC<{s: SceneInfo}> = ({s}) => {
  const frame = useCurrentFrame()
  const {fps} = useVideoConfig()
  const t = frame / fps
  const p1 = phrase(s, 1)
  const p2 = phrase(s, 2)

  const tile = pop(frame, fps, 0.04, {damping: 13, stiffness: 160})
  const ring = tween(t, [0.12, 0.7], [0, 1], expoOut)
  const slide = tween(t, [0.55, 1.15], [0, 1], inOut)
  const word = tween(t, [0.7, 1.3], [0, 1], expoOut)
  const wave = tween(t, [0, 0.8], [0, 1], expoOut)

  // Mark + gap + wordmark, centered once assembled.
  const wordW = 690
  const shift = (-(wordW + 44) / 2) * slide

  return (
    <AbsoluteFill>
      {/* Shockwave from the dot. */}
      <div
        style={{
          position: "absolute",
          left: 960 - 600 * wave,
          top: 470 - 600 * wave,
          width: 1200 * wave,
          height: 1200 * wave,
          borderRadius: "50%",
          border: `${6 * (1 - wave)}px solid rgba(229,72,77,${0.5 * (1 - wave)})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 960 - MARK / 2 + shift,
          top: 470 - MARK / 2,
          filter: `drop-shadow(0 30px 50px rgba(22,22,29,${0.25 * tile}))`,
        }}
      >
        <Mark size={MARK} tile={tile} ring={ring} />
      </div>
      <div style={{position: "absolute", left: 960 + MARK / 2 + 44 + shift, top: 470 - 100}}>
        <Wordmark size={176} reveal={word} />
      </div>
      <div style={{position: "absolute", left: 0, right: 0, top: 660}}>
        <div style={{display: "flex", justifyContent: "center", gap: 26}}>
          <Words at={p1.start - 0.05} size={68} color={C.ink2}>
            Send a link.
          </Words>
          <Words at={p2.start - 0.05} size={68} color={C.ink2} accent={C.accent}>
            Get back the *original.*
          </Words>
        </div>
      </div>
    </AbsoluteFill>
  )
}

// The assembled logo and tagline, static, for handing off to the next scene.
export const Lockup: React.FC<{y?: number; opacity?: number}> = ({y = 0, opacity = 1}) => {
  const wordW = 690
  const shift = -(wordW + 44) / 2
  return (
    <AbsoluteFill style={{transform: `translateY(${y}px)`, opacity}}>
      <div style={{position: "absolute", left: 960 - MARK / 2 + shift, top: 470 - MARK / 2, filter: "drop-shadow(0 30px 50px rgba(22,22,29,0.25))"}}>
        <Mark size={MARK} />
      </div>
      <div style={{position: "absolute", left: 960 + MARK / 2 + 44 + shift, top: 470 - 100}}>
        <Wordmark size={176} />
      </div>
      <div style={{position: "absolute", left: 0, right: 0, top: 660}}>
        <div style={{display: "flex", justifyContent: "center", gap: 26}}>
          <Words at={-10} size={68} color={C.ink2}>
            Send a link.
          </Words>
          <Words at={-10} size={68} color={C.ink2} accent={C.accent}>
            Get back the *original.*
          </Words>
        </div>
      </div>
    </AbsoluteFill>
  )
}
