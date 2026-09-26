// Thin OpenRouter client for the asset pipeline: chat (with audio/image
// output over SSE), text-to-speech, video jobs, and a cost ledger.
import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"

export const ROOT = path.resolve(import.meta.dirname, "..")
const API = "https://openrouter.ai/api/v1"

function loadEnv() {
  const file = path.join(ROOT, ".env")
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}
loadEnv()

function key() {
  const k = process.env.OPENROUTER_API_KEY
  if (!k) throw new Error("Set OPENROUTER_API_KEY in marketing/video/.env")
  return k
}

const headers = () => ({Authorization: `Bearer ${key()}`, "Content-Type": "application/json"})

// Every paid call is appended here so you can see what a regeneration costs.
export function logCost(kind: string, model: string, cost: number | undefined, note = "") {
  const line = JSON.stringify({at: new Date().toISOString(), kind, model, cost: cost ?? null, note})
  fs.mkdirSync(path.join(ROOT, ".work"), {recursive: true})
  fs.appendFileSync(path.join(ROOT, ".work", "costs.jsonl"), line + "\n")
}

export const hash = (v: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16)

async function check(res: Response) {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${(await res.text()).slice(0, 800)}`)
  return res
}

// Streams a chat completion and collects text, audio chunks, and images.
export async function chatStream(body: Record<string, unknown>) {
  const res = await check(
    await fetch(`${API}/chat/completions`, {method: "POST", headers: headers(), body: JSON.stringify({...body, stream: true})})
  )
  let text = ""
  const audio: Buffer[] = []
  const images: string[] = []
  let usage: any = null
  const decoder = new TextDecoder()
  let buf = ""
  for await (const chunk of res.body as any) {
    buf += decoder.decode(chunk, {stream: true})
    let i
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line.startsWith("data: ") || line === "data: [DONE]") continue
      const j = JSON.parse(line.slice(6))
      if (j.error) throw new Error(JSON.stringify(j.error))
      if (j.usage) usage = j.usage
      for (const c of j.choices ?? []) {
        const d = c.delta ?? {}
        if (d.content) text += d.content
        if (d.audio?.data) audio.push(Buffer.from(d.audio.data, "base64"))
        for (const img of d.images ?? []) images.push(img.image_url?.url ?? img.url)
      }
    }
  }
  return {text, audio: Buffer.concat(audio), images, usage}
}

export async function chat(body: Record<string, unknown>) {
  const res = await check(await fetch(`${API}/chat/completions`, {method: "POST", headers: headers(), body: JSON.stringify(body)}))
  const j: any = await res.json()
  return {message: j.choices?.[0]?.message ?? {}, usage: j.usage}
}

// Text-to-speech. Returns raw bytes (pcm s16le 24 kHz mono, or mp3).
export async function speech(body: Record<string, unknown>) {
  const res = await check(await fetch(`${API}/audio/speech`, {method: "POST", headers: headers(), body: JSON.stringify(body)}))
  return {bytes: Buffer.from(await res.arrayBuffer()), id: res.headers.get("x-generation-id")}
}

export async function generationCost(id: string | null) {
  if (!id) return undefined
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${API}/generation?id=${id}`, {headers: headers()})
    if (res.ok) {
      const j: any = await res.json()
      return j.data?.total_cost as number | undefined
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  return undefined
}

export const dataUrl = (file: string) => {
  const ext = path.extname(file).slice(1).replace("jpg", "jpeg")
  return `data:image/${ext};base64,${fs.readFileSync(file).toString("base64")}`
}

// Submits a video job, polls until done, and downloads the result.
export async function video(body: Record<string, unknown>, out: string, label = "") {
  const res = await check(await fetch(`${API}/videos`, {method: "POST", headers: headers(), body: JSON.stringify(body)}))
  const job: any = await res.json()
  const url = job.polling_url ?? `${API}/videos/${job.id}`
  console.log(`  ${label} job ${job.id} submitted`)
  const started = Date.now()
  for (;;) {
    await new Promise((r) => setTimeout(r, 15000))
    const s: any = await (await check(await fetch(url, {headers: headers()}))).json()
    if (s.status === "completed") {
      const content = s.unsigned_urls?.[0] ?? `${API}/videos/${job.id}/content?index=0`
      const v = await check(await fetch(content, {headers: headers()}))
      fs.writeFileSync(out, Buffer.from(await v.arrayBuffer()))
      logCost("video", String(body.model), s.usage?.cost, label)
      console.log(`  ${label} done in ${Math.round((Date.now() - started) / 1000)}s, $${s.usage?.cost ?? "?"}`)
      return s
    }
    if (s.status === "failed") throw new Error(`${label} failed: ${JSON.stringify(s.error ?? s)}`)
    if (Date.now() - started > 20 * 60_000) throw new Error(`${label} timed out`)
  }
}
