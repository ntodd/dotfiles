// Brand tokens (from DESIGN.md) and motion helpers shared by every scene.
import {Easing, interpolate, spring} from "remotion"
import {loadFont} from "@remotion/google-fonts/Inter"

export const {fontFamily} = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
})

export const C = {
  canvas: "#ffffff",
  subtle: "#f7f7f9",
  muted: "#efeff3",
  line: "#e7e7ec",
  ink: "#16161d",
  ink2: "#55556a",
  ink3: "#71717f",
  accent: "#5b50e8",
  accentSoft: "#efedfd",
  accentInk: "#3a30b8",
  record: "#e5484d",
  success: "#1a8a4a",
  successSoft: "#e6f6ec",
  warning: "#a35f00",
  warningSoft: "#fdf3e1",
  danger: "#d1293d",
  studio: "#0b0b0f",
  studio2: "#16161d",
  studio3: "#24242e",
  studioInk: "#f4f4f7",
  studioInk2: "#a9a9b8",
}

export const text = {
  fontFamily,
  fontFeatureSettings: '"cv11", "ss01", "ss03"',
} as const

// The house curve (DESIGN.md): expo-out.
export const expoOut = Easing.bezier(0.16, 1, 0.3, 1)
export const inOut = Easing.bezier(0.65, 0, 0.35, 1)
export const backOut = Easing.bezier(0.34, 1.56, 0.64, 1)

// Seconds-based interpolate with clamping and the house curve by default.
export function tween(
  t: number,
  [t0, t1]: [number, number],
  [v0, v1]: [number, number],
  easing: (x: number) => number = expoOut
) {
  return interpolate(t, [t0, t1], [v0, v1], {easing, extrapolateLeft: "clamp", extrapolateRight: "clamp"})
}

// A spring that starts at `at` seconds. SOFTEN relaxes every spring in the
// film at once: lower is calmer and less bouncy.
const SOFTEN = 0.72
export function pop(frame: number, fps: number, at: number, config: Partial<{damping: number; stiffness: number; mass: number}> = {}) {
  const c = {damping: 16, stiffness: 170, mass: 0.9, ...config}
  return spring({frame: frame - at * fps, fps, config: {...c, stiffness: c.stiffness * SOFTEN, damping: c.damping * (1 + (1 - SOFTEN) * 0.6)}})
}

export const shadow = {
  overlay: "0 40px 90px -30px rgba(22,22,29,0.35), 0 12px 30px -12px rgba(22,22,29,0.18)",
  window: "0 50px 120px -40px rgba(22,22,29,0.45), 0 20px 50px -20px rgba(22,22,29,0.25), 0 0 0 1px rgba(22,22,29,0.06)",
  soft: "0 16px 40px -12px rgba(22,22,29,0.24), 0 4px 10px -4px rgba(22,22,29,0.08)",
}
