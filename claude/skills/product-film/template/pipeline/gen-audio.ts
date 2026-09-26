// Voiceover and music from script.yaml.
//   npx tsx pipeline/gen-audio.ts voice [--force hook,end]
//   npx tsx pipeline/gen-audio.ts music [--takes 2]
//   npx tsx pipeline/gen-audio.ts pick-music <take number>
import fs from "node:fs"
import path from "node:path"
import {execFileSync, spawnSync} from "node:child_process"
import YAML from "yaml"
import {ROOT, chatStream, generationCost, hash, logCost, speech} from "./openrouter.ts"

const [cmd = "voice", ...rest] = process.argv.slice(2)
const arg = (name: string) => {
  const i = rest.indexOf(name)
  return i >= 0 ? rest[i + 1] : undefined
}
const script = YAML.parse(fs.readFileSync(path.join(ROOT, "script.yaml"), "utf8"))
const ff = (args: string[]) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args])
// Speech segments (start/end seconds) between pauses, so the edit can hit
// on-screen text on the phrase it belongs to.
function speechSegments(file: string, total: number) {
  const {stderr} = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-38dB:d=0.14", "-f", "null", "-"],
    {encoding: "utf8"}
  )
  const starts = [...stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]))
  const ends = [...stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]))
  const segs: Array<[number, number]> = []
  let cursor = 0
  starts.forEach((st, i) => {
    if (st - cursor > 0.05) segs.push([+cursor.toFixed(3), +st.toFixed(3)])
    cursor = ends[i] ?? total
  })
  if (total - cursor > 0.05) segs.push([+cursor.toFixed(3), +total.toFixed(3)])
  return segs
}
const duration = (file: string) =>
  Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString())

// Speech from any provider, returned as a wav path.
async function synth(text: string, out: string) {
  const v = script.voice
  const raw = out.replace(/\.wav$/, ".raw")
  if (v.provider === "gemini") {
    const {bytes, id} = await speech({
      model: v.model,
      input: text,
      voice: v.voice,
      response_format: "pcm",
      provider: {options: {"google-ai-studio": {speech_metadata: {style: v.style}}}},
    })
    fs.writeFileSync(raw, bytes)
    ff(["-f", "s16le", "-ar", "24000", "-ac", "1", "-i", raw, out])
    logCost("voice", v.model, await generationCost(id), text.slice(0, 40))
  } else if (v.provider === "minimax") {
    const {bytes, id} = await speech({model: v.model, input: text, voice: v.voice, response_format: "mp3"})
    fs.writeFileSync(raw, bytes)
    ff(["-i", raw, out])
    logCost("voice", v.model, await generationCost(id), text.slice(0, 40))
  } else if (v.provider === "openai-audio") {
    const {audio, usage} = await chatStream({
      model: v.model,
      modalities: ["text", "audio"],
      audio: {voice: v.voice, format: "pcm16"},
      messages: [
        {role: "system", content: `You are a voice actor. Read the user's text exactly, word for word. Delivery: ${v.style}`},
        {role: "user", content: text},
      ],
    })
    fs.writeFileSync(raw, audio)
    ff(["-f", "s16le", "-ar", "24000", "-ac", "1", "-i", raw, out])
    logCost("voice", v.model, usage?.cost, text.slice(0, 40))
  } else {
    throw new Error(`Unknown voice provider ${v.provider}`)
  }
  fs.rmSync(raw, {force: true})
}

async function voice() {
  const dir = path.join(ROOT, "public/vo")
  fs.mkdirSync(dir, {recursive: true})
  const force = (arg("--force") ?? "").split(",")
  const manifestFile = path.join(dir, "manifest.json")
  const old = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, "utf8")) : {}
  const manifest: Record<string, {file: string; duration: number; text: string; hash: string; speech: Array<[number, number]>}> = {}

  await Promise.all(
    script.scenes.map(async (scene: any) => {
      const text = String(scene.vo ?? "").replace(/\s+/g, " ").trim()
      if (!text) return
      const h = hash({text, voice: script.voice})
      const file = `vo/${scene.id}.wav`
      const abs = path.join(ROOT, "public", file)
      if (old[scene.id]?.hash === h && fs.existsSync(abs) && !force.includes(scene.id)) {
        manifest[scene.id] = {...old[scene.id], speech: speechSegments(abs, old[scene.id].duration)}
        return console.log(`= ${scene.id} (cached)`)
      }
      console.log(`+ ${scene.id}`)
      const tmp = abs.replace(/\.wav$/, ".take.wav")
      await synth(text, tmp)
      // Trim silence at both ends so timing follows the words, then
      // resample to 48 kHz for the mix.
      ff([
        "-i", tmp, "-af",
        "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse",
        "-ar", "48000", abs,
      ])
      fs.rmSync(tmp)
      const d = duration(abs)
      manifest[scene.id] = {file, duration: d, text, hash: h, speech: speechSegments(abs, d)}
      console.log(`  ${scene.id}: ${manifest[scene.id].duration.toFixed(2)}s`)
    })
  )
  const ordered = Object.fromEntries(script.scenes.filter((s: any) => manifest[s.id]).map((s: any) => [s.id, manifest[s.id]]))
  fs.writeFileSync(manifestFile, JSON.stringify(ordered, null, 2))
  const total = Object.values(ordered).reduce((a: number, m: any) => a + m.duration, 0)
  console.log(`VO total ${total.toFixed(1)}s -> ${path.relative(ROOT, manifestFile)}`)
}

async function music() {
  const dir = path.join(ROOT, "public/music")
  fs.mkdirSync(dir, {recursive: true})
  const takes = Number(arg("--takes") ?? 1)
  const m = script.music
  await Promise.all(
    Array.from({length: takes}, async (_, i) => {
      const n = i + 1
      const {audio, text, usage} = await chatStream({
        model: m.model,
        modalities: ["text", "audio"],
        messages: [{role: "user", content: m.prompt}],
      })
      const file = path.join(dir, `take-${n}.mp3`)
      fs.writeFileSync(file, audio)
      fs.writeFileSync(file.replace(/\.mp3$/, ".txt"), text)
      logCost("music", m.model, usage?.cost, `take ${n}`)
      console.log(`take ${n}: ${duration(file).toFixed(1)}s -> ${path.relative(ROOT, file)}`)
    })
  )
  console.log("Pick one with: npm run music:pick -- <n>")
}

function pickMusic() {
  const n = rest[0]
  const dir = path.join(ROOT, "public/music")
  ff(["-i", path.join(dir, `take-${n}.mp3`), "-ar", "48000", path.join(dir, "track.wav")])
  execFileSync("uv", ["run", "--quiet", path.join(ROOT, "pipeline/analyze_music.py")], {stdio: "inherit"})
}

if (cmd === "voice") await voice()
else if (cmd === "music") await music()
else if (cmd === "pick-music") pickMusic()
else throw new Error(`unknown command ${cmd}`)
