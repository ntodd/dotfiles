// Renders stills at given seconds for quick visual review.
//   npx tsx pipeline/stills.ts 3 6.5 17 ...   -> out/stills/t003.00.jpg
import path from "node:path"
import fs from "node:fs"
import {bundle} from "@remotion/bundler"
import {renderStill, selectComposition} from "@remotion/renderer"

const ROOT = path.resolve(import.meta.dirname, "..")
const times = process.argv.slice(2).map(Number)
const out = path.join(ROOT, "out/stills")
fs.mkdirSync(out, {recursive: true})
const serveUrl = await bundle({entryPoint: path.join(ROOT, "src/index.ts"), publicDir: path.join(ROOT, "public")})
const composition = await selectComposition({serveUrl, id: "Film"})
for (const t of times) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(t * composition.fps))
  const file = path.join(out, `t${t.toFixed(2).padStart(6, "0")}.jpg`)
  await renderStill({composition, serveUrl, output: file, frame, imageFormat: "jpeg", jpegQuality: 85})
  console.log(file)
}
