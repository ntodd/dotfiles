import React from "react"
import {OffthreadVideo, staticFile, useVideoConfig} from "remotion"

// A screen recording from public/captures, starting at `from` seconds of
// the recording and playing at `rate`.
export const CaptureVideo: React.FC<{name: string; from?: number; rate?: number; style?: React.CSSProperties}> = ({
  name,
  from = 0,
  rate = 1,
  style,
}) => {
  const {fps} = useVideoConfig()
  return (
    <OffthreadVideo
      src={staticFile(`captures/${name}.mp4`)}
      trimBefore={Math.max(0, Math.round(from * fps))}
      playbackRate={rate}
      muted
      style={{width: "100%", height: "100%", display: "block", objectFit: "cover", ...style}}
    />
  )
}

// A generated clip from public/clips.
export const Clip: React.FC<{name: string; from?: number; rate?: number; style?: React.CSSProperties; muted?: boolean; volume?: number}> = ({
  name,
  from = 0,
  rate = 1,
  style,
  muted = true,
  volume = 1,
}) => {
  const {fps} = useVideoConfig()
  return (
    <OffthreadVideo
      src={staticFile(`clips/${name}.mp4`)}
      trimBefore={Math.max(0, Math.round(from * fps))}
      playbackRate={rate}
      muted={muted}
      volume={volume}
      style={{width: "100%", height: "100%", display: "block", objectFit: "cover", ...style}}
    />
  )
}
