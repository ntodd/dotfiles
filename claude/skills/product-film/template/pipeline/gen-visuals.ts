// Generates stills and video clips from assets.yaml.
//   npx tsx pipeline/gen-visuals.ts images [--force id,id]
//   npx tsx pipeline/gen-visuals.ts clips  [--force id,id] [--only id,id]
import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"
import {ROOT, chat, dataUrl, hash, logCost, video} from "./openrouter.ts"

const [kind = "images", ...rest] = process.argv.slice(2)
const flag = (name: string) => {
  const i = rest.indexOf(name)
  return i >= 0 ? (rest[i + 1] ?? "").split(",").filter(Boolean) : null
}
const force = flag("--force") ?? []
const only = flag("--only")

const spec = YAML.parse(fs.readFileSync(path.join(ROOT, "assets.yaml"), "utf8"))
const imgDir = path.join(ROOT, "public/images")
const clipDir = path.join(ROOT, "public/clips")
fs.mkdirSync(imgDir, {recursive: true})
fs.mkdirSync(clipDir, {recursive: true})

const stampFile = (dir: string, id: string) => path.join(dir, `${id}.hash`)
const fresh = (dir: string, id: string, file: string, h: string) =>
  !force.includes(id) && fs.existsSync(file) && fs.existsSync(stampFile(dir, id)) &&
  fs.readFileSync(stampFile(dir, id), "utf8") === h

async function image(item: any) {
  const file = path.join(imgDir, `${item.id}.png`)
  const h = hash(item)
  if (fresh(imgDir, item.id, file, h)) return console.log(`= ${item.id} (cached)`)
  const content: any[] = []
  if (item.reference) {
    content.push({type: "image_url", image_url: {url: dataUrl(path.join(imgDir, `${item.reference}.png`))}})
  }
  content.push({type: "text", text: item.prompt})
  console.log(`+ ${item.id}`)
  const {message, usage} = await chat({
    model: item.model,
    modalities: ["image", "text"],
    image_config: {aspect_ratio: item.aspect, image_size: item.size},
    messages: [{role: "user", content}],
  })
  const url: string | undefined = message.images?.[0]?.image_url?.url
  if (!url) throw new Error(`${item.id}: no image returned: ${JSON.stringify(message).slice(0, 400)}`)
  fs.writeFileSync(file, Buffer.from(url.split(",")[1], "base64"))
  fs.writeFileSync(stampFile(imgDir, item.id), h)
  logCost("image", item.model, usage?.cost, item.id)
  console.log(`  saved ${path.relative(ROOT, file)} ($${usage?.cost?.toFixed?.(3) ?? "?"})`)
}

async function clip(item: any) {
  const file = path.join(clipDir, `${item.id}.mp4`)
  const h = hash(item)
  if (fresh(clipDir, item.id, file, h)) return console.log(`= ${item.id} (cached)`)
  const body: Record<string, unknown> = {
    model: item.model,
    prompt: item.prompt,
    duration: item.duration,
    resolution: item.resolution,
    aspect_ratio: item.aspect,
    generate_audio: item.audio ?? false,
  }
  const frames = [
    ["first_frame", item.first_frame],
    ["last_frame", item.last_frame],
  ].filter(([, id]) => id)
  if (frames.length) {
    body.frame_images = frames.map(([frame_type, id]) => ({
      type: "image_url",
      image_url: {url: dataUrl(path.join(imgDir, `${id}.png`))},
      frame_type,
    }))
  }
  console.log(`+ ${item.id}`)
  await video(body, file, item.id)
  fs.writeFileSync(stampFile(clipDir, item.id), h)
}

const list = (kind === "images" ? spec.images : spec.clips).filter((i: any) => !only || only.includes(i.id))
const run = kind === "images" ? image : clip
// Everything runs in parallel, except images that use another image as a
// reference, which wait for the first wave.
const first = list.filter((i: any) => !i.reference)
const second = list.filter((i: any) => i.reference)
const results = [
  ...(await Promise.allSettled(first.map((i: any) => run(i)))),
  ...(await Promise.allSettled(second.map((i: any) => run(i)))),
]
list.splice(0, list.length, ...first, ...second)
let failed = 0
results.forEach((r, i) => {
  if (r.status === "rejected") {
    failed++
    console.error(`! ${list[i].id}: ${r.reason?.message ?? r.reason}`)
  }
})
process.exit(failed ? 1 : 0)
