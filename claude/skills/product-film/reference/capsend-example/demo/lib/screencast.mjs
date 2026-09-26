// High-resolution screen recording of a Playwright page over CDP.
//
// Chrome pushes a frame whenever the page repaints. We keep every frame with
// its timestamp, then rebuild a constant 30 fps video with ffmpeg, holding
// each frame until the next one. Markers let the edit find moments by name
// ("clicked-record") instead of by hard-coded seconds.
import fs from "node:fs"
import path from "node:path"
import {execFileSync} from "node:child_process"

export async function startScreencast(page, name, {dir, width, height, quality = 92} = {}) {
  const frameDir = path.join(dir, `.frames-${name}`)
  fs.rmSync(frameDir, {recursive: true, force: true})
  fs.mkdirSync(frameDir, {recursive: true})
  const cdp = await page.context().newCDPSession(page)
  const frames = []
  const markers = []
  const t0 = Date.now() / 1000
  let stopped = false

  cdp.on("Page.screencastFrame", async ({data, metadata, sessionId}) => {
    if (!stopped) {
      const file = path.join(frameDir, `${String(frames.length).padStart(6, "0")}.jpg`)
      fs.writeFileSync(file, Buffer.from(data, "base64"))
      frames.push({file, t: metadata.timestamp ?? Date.now() / 1000, size: `${metadata.deviceWidth}x${metadata.deviceHeight}`})
    }
    try {
      await cdp.send("Page.screencastFrameAck", {sessionId})
    } catch {}
  })
  await cdp.send("Page.startScreencast", {format: "jpeg", quality, maxWidth: width, maxHeight: height, everyNthFrame: 1})

  return {
    // Seconds since recording started.
    now: () => Date.now() / 1000 - t0,
    // box: the element the shot is about, in CSS pixels, for the edit's
    // virtual camera.
    mark(label, box = null) {
      markers.push({label, t: Date.now() / 1000 - t0, box})
      console.log(`    [${name}] ${label} @ ${(Date.now() / 1000 - t0).toFixed(2)}s`)
    },
    async stop() {
      const tEnd = Date.now() / 1000
      stopped = true
      await cdp.send("Page.stopScreencast").catch(() => {})
      await cdp.detach().catch(() => {})
      if (!frames.length) throw new Error(`${name}: no frames captured`)
      // Drop frames from a different viewport shape (mid-rotation), which
      // would otherwise set the size of the whole video.
      const size = frames.at(-1).size
      const dropped = frames.length
      for (let i = frames.length - 1; i >= 0; i--) if (frames[i].size !== size) frames.splice(i, 1)
      if (frames.length < dropped) console.log(`  ${name}: dropped ${dropped - frames.length} frame(s) of another size`)
      // Frame timestamps are wall-clock; align them to t0.
      const list = []
      for (let i = 0; i < frames.length; i++) {
        const start = frames[i].t
        const end = i + 1 < frames.length ? frames[i + 1].t : tEnd
        list.push(`file '${path.basename(frames[i].file)}'`, `duration ${Math.max(end - start, 0.001).toFixed(4)}`)
      }
      list.push(`file '${path.basename(frames.at(-1).file)}'`)
      // The first frame arrives a little after t0; hold it from zero so
      // markers and video time agree.
      const lead = Math.max(frames[0].t - t0, 0)
      fs.writeFileSync(path.join(frameDir, "list.txt"), list.join("\n"))
      const out = path.join(dir, `${name}.mp4`)
      execFileSync("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-f", "concat", "-safe", "0", "-i", path.join(frameDir, "list.txt"),
        "-vf", `tpad=start_duration=${lead.toFixed(3)}:start_mode=clone,fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`,
        "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-tune", "animation", "-movflags", "+faststart",
        out,
      ])
      const meta = {name, duration: tEnd - t0, frames: frames.length, fps: frames.length / (tEnd - t0), viewport: page.viewportSize(), markers}
      fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(meta, null, 2))
      fs.rmSync(frameDir, {recursive: true, force: true})
      console.log(`  saved ${name}.mp4 (${meta.duration.toFixed(1)}s, ${meta.frames} frames, ~${meta.fps.toFixed(0)} fps)`)
      return meta
    },
  }
}
