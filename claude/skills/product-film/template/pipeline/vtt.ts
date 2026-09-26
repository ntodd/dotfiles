// Prints WebVTT captions for the film, from the same timing as the
// burned-in captions.
import {captionCues} from "../src/components/Captions.tsx"

const ts = (t: number) => {
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`
}
const lines = ["WEBVTT", ""]
captionCues().forEach((c, i) => lines.push(String(i + 1), `${ts(c.start)} --> ${ts(c.end)}`, c.text, ""))
console.log(lines.join("\n"))
