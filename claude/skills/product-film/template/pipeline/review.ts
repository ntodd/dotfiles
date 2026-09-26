// AI review passes, since generated audio and video need a listener.
//   npx tsx pipeline/review.ts vo              check every VO line against the script
//   npx tsx pipeline/review.ts music           rank the music takes for this film
//   npx tsx pipeline/review.ts video out/x.mp4 critique a render like a creative director
import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"
import {execFileSync} from "node:child_process"
import {ROOT, chat, logCost} from "./openrouter.ts"

const MODEL = process.env.REVIEW_MODEL ?? "google/gemini-3.8-flash"
const [cmd, file] = process.argv.slice(2)
const script = YAML.parse(fs.readFileSync(path.join(ROOT, "script.yaml"), "utf8"))
const b64 = (f: string) => fs.readFileSync(f).toString("base64")
const audioPart = (f: string) => ({
  type: "input_audio",
  input_audio: {data: b64(f), format: path.extname(f).slice(1)},
})

async function ask(content: any[], label: string) {
  const {message, usage} = await chat({model: MODEL, messages: [{role: "user", content}]})
  logCost("review", MODEL, usage?.cost, label)
  const text = String(message.content ?? "")
  const out = path.join(ROOT, ".work", `review-${label}.md`)
  fs.writeFileSync(out, text)
  console.log(text)
  console.log(`\n(saved ${path.relative(ROOT, out)}, $${usage?.cost?.toFixed?.(4) ?? "?"})`)
}

// A small 720p copy, so the upload stays well under request limits.
function proxy(file: string) {
  const out = path.join(ROOT, ".work", "review-proxy.mp4")
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", file, "-vf", "scale=1280:-2", "-c:v", "libx264", "-crf", "28", "-preset", "fast", "-c:a", "aac", "-b:a", "128k", out])
  return out
}

if (cmd === "vo") {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "public/vo/manifest.json"), "utf8"))
  const content: any[] = [
    {
      type: "text",
      text:
        "You are the audio QA lead on a premium product film. Each clip below is one voiceover line with its intended script. " +
        "For each: (1) transcribe exactly, (2) list any word that differs from the script, is mispronounced (especially the brand name, " + JSON.stringify(script.brand?.name ?? script.title) + "), " +
        "clipped, slurred or has artifacts (clicks, breaths, robotic glitches), (3) rate delivery 1-10 for a warm, upbeat, premium read, and " +
        "(4) say RETAKE or OK. Also note if one line's tone, pace, or loudness clearly doesn't match the others. Finish with a table.",
    },
  ]
  for (const [id, m] of Object.entries<any>(manifest)) {
    content.push({type: "text", text: `Line "${id}". Script: ${m.text}`})
    content.push(audioPart(path.join(ROOT, "public", m.file)))
  }
  await ask(content, "vo")
} else if (cmd === "music") {
  const dir = path.join(ROOT, "public/music")
  const takes = fs.readdirSync(dir).filter((f) => /^take-\d+\.mp3$/.test(f)).sort()
  const content: any[] = [
    {
      type: "text",
      text:
        "You are the music supervisor for a ~75 second, peppy, premium SaaS product film (Apple / Notion / Loom quality). " +
        "The film opens on a playful problem (about 12 s), then a logo reveal that should land on a big, bright drop, then an " +
        "upbeat product demo with voiceover on top, then a clean ending. The brief given to the composer:\n\n" +
        script.music.prompt +
        "\n\nFor each take: describe its structure with timestamps (intro, riser, drop, sections, ending), tempo feel, whether it " +
        "has any vocals or vocal chops (bad), whether it leaves room for voiceover (no busy lead melody in the mids), production " +
        "quality, and anything cheesy or dated. Give the exact timestamp of the main drop and of the final ending hit. " +
        "Then rank them and pick one.",
    },
  ]
  for (const t of takes) {
    content.push({type: "text", text: `Take: ${t}`})
    content.push(audioPart(path.join(dir, t)))
  }
  await ask(content, "music")
} else if (cmd === "video") {
  if (!file) throw new Error("pass a video file")
  const scenes = script.scenes.map((s: any) => `- ${s.id}: VO "${String(s.vo ?? "").trim()}"` + (s.visual ? ` / visual: ${String(s.visual).trim()}` : "")).join("\n")
  const content: any[] = [
    {
      type: "text",
      text:
        "You are an exacting creative director reviewing a cut of a product marketing film. The product: " +
        String(script.product ?? script.title).trim() +
        " The bar is a high-budget launch film (Apple, Linear, Loom). Watch and listen closely. Intended script and storyboard:\n" +
        scenes +
        "\n\nGive specific, timestamped notes on: pacing and rhythm (cuts on the beat?), VO/music balance and mix, any sync " +
        "problems, readability of UI and text (too small, on screen too briefly), visual polish (jank, jumps, bad crops, aliasing, " +
        "blank frames, stutter, dead air), story clarity (would a comms manager get it?), and the ending. Separate MUST FIX from " +
        "NICE TO HAVE. Be blunt; don't praise for the sake of it. End with a 1-10 score.",
    },
    {type: "video_url", video_url: {url: `data:video/mp4;base64,${b64(proxy(file))}`}},
  ]
  await ask(content, `video-${path.basename(file, ".mp4")}`)
} else {
  console.log("usage: review.ts vo | music | video <file>")
}
