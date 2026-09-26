// Publishes a rendered version to the public Tigris bucket for the website.
//   npx tsx pipeline/publish.ts v2
// Encodes a web copy (1080p H.264, fast start) and uploads it with long-lived
// caching under a versioned key, then prints the public URL.
// Credentials: MEDIA_* in .env: create a public bucket with
//   fly storage create -n <name>-media -o <org> --public   (do NOT attach it to the app)
// and put its keys in .env as MEDIA_AWS_ACCESS_KEY_ID, MEDIA_AWS_SECRET_ACCESS_KEY,
// MEDIA_AWS_ENDPOINT_URL_S3, MEDIA_AWS_REGION, MEDIA_BUCKET_NAME.
import fs from "node:fs"
import path from "node:path"
import {execFileSync} from "node:child_process"
import {S3Client, PutObjectCommand, HeadObjectCommand} from "@aws-sdk/client-s3"
import {ROOT} from "./openrouter.ts"

const version = process.argv[2]
if (!version) throw new Error("usage: publish.ts <version>")
const env = (k: string) => {
  const v = process.env[`MEDIA_${k}`]
  if (!v) throw new Error(`MEDIA_${k} missing from .env`)
  return v
}
const bucket = env("BUCKET_NAME")
const s3 = new S3Client({
  region: env("AWS_REGION"),
  endpoint: env("AWS_ENDPOINT_URL_S3"),
  credentials: {accessKeyId: env("AWS_ACCESS_KEY_ID"), secretAccessKey: env("AWS_SECRET_ACCESS_KEY")},
})

const src = path.join(ROOT, "out", version, "film.mp4")
const web = path.join(ROOT, "out", version, "film-web.mp4")
execFileSync("ffmpeg", [
  "-hide_banner", "-loglevel", "error", "-y", "-i", src,
  "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-profile:v", "high", "-pix_fmt", "yuv420p",
  "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", web,
])

const uploads = [
  {file: web, key: `film/${version}/film-1080p.mp4`, type: "video/mp4"},
  {file: path.join(ROOT, "out", version, "film.vtt"), key: `film/${version}/film.vtt`, type: "text/vtt"},
  {file: path.join(ROOT, "out", version, "film-poster.jpg"), key: `film/${version}/film-poster.jpg`, type: "image/jpeg"},
]
for (const u of uploads) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: u.key,
      Body: fs.readFileSync(u.file),
      ContentType: u.type,
      CacheControl: "public, max-age=31536000, immutable",
    })
  )
  const head = await s3.send(new HeadObjectCommand({Bucket: bucket, Key: u.key}))
  const mb = (Number(head.ContentLength) / 1e6).toFixed(1)
  console.log(`https://${bucket}.fly.storage.tigris.dev/${u.key}  (${mb} MB)`)
}
