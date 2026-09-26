import React from "react"
import {C, text} from "../theme"

// A modern, notchless phone with a dynamic island. `s` is screen pixels per
// CSS pixel of the recorded page. In portrait a status bar sits above the
// page (the recording has none), so the screen is page height + STATUS.
export const STATUS = 47

export const Phone: React.FC<{
  orientation?: "portrait" | "landscape"
  s: number
  page: {width: number; height: number}
  status?: "light" | "dark"
  children: React.ReactNode
  style?: React.CSSProperties
}> = ({orientation = "portrait", s, page, status = "light", children, style}) => {
  const portrait = orientation === "portrait"
  const screenW = page.width * s
  const screenH = (page.height + (portrait ? STATUS : 0)) * s
  const bezel = 13 * s
  const radius = 54 * s
  const W = screenW + bezel * 2
  const H = screenH + bezel * 2
  return (
    <div
      style={{
        position: "relative",
        width: W,
        height: H,
        borderRadius: radius + bezel,
        background: "linear-gradient(145deg, #3a3a42 0%, #111114 38%, #0a0a0c 62%, #2d2d34 100%)",
        padding: 2 * s,
        boxShadow:
          "0 60px 120px -40px rgba(0,0,0,0.55), 0 24px 50px -20px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.08)",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 2 * s,
          borderRadius: radius + bezel - 2 * s,
          background: "#050506",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: bezel,
          top: bezel,
          width: screenW,
          height: screenH,
          borderRadius: radius,
          overflow: "hidden",
          background: status === "dark" ? C.studio : "#fff",
        }}
      >
        {portrait ? <StatusBar s={s} tone={status} /> : null}
        <div style={{position: "absolute", left: 0, top: portrait ? STATUS * s : 0, width: screenW, height: page.height * s}}>
          {children}
        </div>
        {/* Glass sheen. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 32%)",
            pointerEvents: "none",
          }}
        />
      </div>
      <Island s={s} portrait={portrait} bezel={bezel} screenW={screenW} screenH={screenH} />
      <SideButtons s={s} portrait={portrait} W={W} H={H} />
    </div>
  )
}

const Island: React.FC<{s: number; portrait: boolean; bezel: number; screenW: number; screenH: number}> = ({s, portrait, bezel, screenW, screenH}) => {
  const long = 118 * s
  const short = 35 * s
  return (
    <div
      style={{
        position: "absolute",
        left: portrait ? bezel + screenW / 2 - long / 2 : bezel + 11 * s,
        top: portrait ? bezel + 11 * s : bezel + screenH / 2 - long / 2,
        width: portrait ? long : short,
        height: portrait ? short : long,
        borderRadius: short,
        background: "#000",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 11 * s,
          height: 11 * s,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, #2a3350, #07080c 70%)",
          left: portrait ? long - 26 * s : short / 2 - 5.5 * s,
          top: portrait ? short / 2 - 5.5 * s : long - 26 * s,
        }}
      />
    </div>
  )
}

const StatusBar: React.FC<{s: number; tone: "light" | "dark"}> = ({s, tone}) => {
  const ink = tone === "dark" ? "#fff" : C.ink
  return (
    <div
      style={{
        ...text,
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: STATUS * s,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `${6 * s}px ${34 * s}px 0 ${40 * s}px`,
        color: ink,
        fontSize: 16 * s,
        fontWeight: 600,
      }}
    >
      <span>9:41</span>
      <span style={{display: "flex", gap: 6 * s, alignItems: "center"}}>
        <svg width={18 * s} height={12 * s} viewBox="0 0 18 12">
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 4.8} y={9 - i * 3} width={3.2} height={3 + i * 3} rx={0.8} fill={ink} />
          ))}
        </svg>
        <svg width={16 * s} height={12 * s} viewBox="0 0 16 12">
          <path d="M8 11.2 5.6 8.6a3.4 3.4 0 0 1 4.8 0L8 11.2Z" fill={ink} />
          <path d="M3.4 6.4a6.6 6.6 0 0 1 9.2 0l-1.3 1.4a4.7 4.7 0 0 0-6.6 0L3.4 6.4Z" fill={ink} />
          <path d="M1.2 4.1a9.8 9.8 0 0 1 13.6 0l-1.3 1.4a7.9 7.9 0 0 0-11 0L1.2 4.1Z" fill={ink} />
        </svg>
        <svg width={27 * s} height={13 * s} viewBox="0 0 27 13">
          <rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={ink} strokeOpacity="0.4" fill="none" />
          <rect x="2" y="2" width="19" height="9" rx="2" fill={ink} />
          <path d="M25 4.5v4a2 2 0 0 0 0-4Z" fill={ink} fillOpacity="0.45" />
        </svg>
      </span>
    </div>
  )
}

const SideButtons: React.FC<{s: number; portrait: boolean; W: number; H: number}> = ({s, portrait, W, H}) => {
  const btn = (pos: React.CSSProperties) => (
    <div style={{position: "absolute", background: "linear-gradient(#2c2c33, #15151a)", borderRadius: 2 * s, ...pos}} />
  )
  return portrait ? (
    <>
      {btn({left: -3 * s, top: H * 0.2, width: 4 * s, height: 30 * s})}
      {btn({left: -3 * s, top: H * 0.27, width: 4 * s, height: 56 * s})}
      {btn({left: -3 * s, top: H * 0.35, width: 4 * s, height: 56 * s})}
      {btn({right: -3 * s, top: H * 0.3, width: 4 * s, height: 86 * s})}
    </>
  ) : (
    <>
      {btn({bottom: -3 * s, left: W * 0.2, height: 4 * s, width: 30 * s})}
      {btn({bottom: -3 * s, left: W * 0.27, height: 4 * s, width: 56 * s})}
      {btn({bottom: -3 * s, left: W * 0.35, height: 4 * s, width: 56 * s})}
      {btn({top: -3 * s, left: W * 0.3, height: 4 * s, width: 86 * s})}
    </>
  )
}
