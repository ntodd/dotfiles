// Records the real app for the product video, against the isolated
// instance on :4010 (see capture.sh, which resets and seeds it first).
//
//   node demo/record.mjs
//
// Output in public/captures/: one .mp4 per shot plus a .json with named
// markers, the invite email as a phone-width PNG, and the text message.
import {chromium} from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import {execFileSync} from "node:child_process"
import {startScreencast} from "./lib/screencast.mjs"
import {installActor, actor} from "./lib/actor.mjs"

const ROOT = path.resolve(import.meta.dirname, "..")
const REPO = path.resolve(ROOT, "../..")
const BASE = process.env.BASE_URL ?? "http://localhost:4010"
const OUT = path.join(ROOT, "public/captures")
fs.mkdirSync(OUT, {recursive: true})

const DESK = {width: 1280, height: 800, dpr: 2}
const PHONE = {width: 390, height: 844, dpr: 3}
const CAMERA = path.join(ROOT, ".work/camera")
// The fake camera plays marcus-idle forward and back (12 s), then he talks.
const TALK_AT = 12.0
const COUNTDOWN = 3

const TITLE = "Q4 kickoff: welcome from leadership"
const INSTRUCTIONS = "Record a 30-second welcome for the Q4 kickoff. Share one win from your team and say thank you."
const SCRIPT = [
  "Hi everyone. What a quarter!",
  "Before anything else, I just want to say **thank you**. [pause]",
  "This team shipped more this year than ever before, and our customers noticed.",
  "Here's what's next for Q4.",
].join("\n\n")
const PEOPLE = [
  ["Marc", "Marcus Bell"],
  ["Ele", "Elena Ruiz"],
  ["Sam", "Sam Okafor"],
  ["Priya", "Priya Nair"],
  ["Jona", "Jonah Weiss"],
  ["Aik", "Aiko Tanaka"],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const only = process.argv[2]

// Screencast frames come back in CSS pixels unless the whole browser runs at
// the target pixel density.
const desktopBrowser = await chromium.launch({args: [`--force-device-scale-factor=${DESK.dpr}`]})
const phoneBrowser = await chromium.launch({
  args: [
    `--force-device-scale-factor=${PHONE.dpr}`,
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
    `--use-file-for-fake-video-capture=${path.join(CAMERA, "marcus.mjpeg")}`,
    `--use-file-for-fake-audio-capture=${path.join(CAMERA, "marcus.wav")}`,
    "--autoplay-policy=no-user-gesture-required",
  ],
})

async function desktop() {
  const context = await desktopBrowser.newContext({
    viewport: {width: DESK.width, height: DESK.height},
    deviceScaleFactor: DESK.dpr,
  })
  await installActor(context)
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)
  page.on("pageerror", (e) => console.log("  desktop pageerror:", e.message))
  await page.goto(`${BASE}/users/log-in`)
  await page.waitForSelector(".phx-connected")
  await sleep(300)
  await page.fill("#login_form_password input[name='user[email]']", "maya@northpeak.test")
  await page.fill("#login_form_password input[name='user[password]']", "capsend-demo-1")
  await page.click("#login_form_password button[name='user[remember_me]']")
  await page.waitForURL(/\/o\//)
  const org = new URL(page.url()).pathname.split("/").slice(0, 3).join("/")
  return {context, page, org, act: actor(page)}
}

const cast = (page, name, size) =>
  startScreencast(page, name, {dir: OUT, width: size.width * size.dpr, height: size.height * size.dpr})

// Scrolls smoothly until the element sits comfortably in view.
async function bringIntoView(page, act, selector, top = 220) {
  const box = await page.locator(selector).first().boundingBox()
  if (!box) return
  const vh = page.viewportSize().height
  if (box.y < 80 || box.y + box.height > vh - 120) await act.scrollBy(box.y - top, 800)
  await sleep(250)
}

// 1. Maya creates the request.
async function createRequest(d) {
  const {page, org, act} = d
  console.log("• create")
  await page.goto(`${BASE}${org}/requests`)
  await page.waitForSelector(".phx-connected")
  await act.park(900, 560)
  await sleep(500)
  const rec = await cast(page, "create", DESK)
  await sleep(900)
  rec.mark("click-new")
  await act.click(page.locator("main a", {hasText: "New request"}).last(), {after: 100})
  await page.waitForURL(/requests\/new/)
  await page.waitForSelector(".phx-connected")
  rec.mark("form")
  await sleep(700)

  await act.click("#request_title")
  rec.mark("title", await act.box("#request_title"))
  await act.type(TITLE, {delay: 38})
  await sleep(300)

  await act.click("textarea[name='request[prompts][0][instructions]']")
  rec.mark("instructions", await act.box("textarea[name='request[prompts][0][instructions]']"))
  await act.type(INSTRUCTIONS, {delay: 22, jitter: 18})
  await sleep(300)

  await act.hover("label:has-text('Portrait')", {ms: 450})
  rec.mark("format", await act.box("label:has-text('Landscape') >> xpath=.."))
  await sleep(150)
  await act.click("label:has-text('Landscape')", {ms: 300})
  await sleep(300)

  rec.mark("script")
  await act.click("#script-toggle")
  await sleep(450)
  await act.click("textarea[name='request[prompts][0][script]']")
  rec.mark("script-paste", await act.box("textarea[name='request[prompts][0][script]']"))
  await act.paste(SCRIPT)
  await page.locator("textarea[name='request[prompts][0][script]']").blur()
  await sleep(700)
  await act.click("label:has-text('Teleprompter')")
  rec.mark("teleprompter", await act.box("label:has-text('Teleprompter')"))
  const wpm = page.locator("input[name='request[prompts][0][teleprompter_wpm]']")
  await act.click(wpm, {after: 80})
  await wpm.selectText()
  await act.type("170", {delay: 70})
  await wpm.blur()
  await sleep(400)

  await bringIntoView(page, act, "#more-toggle", 180)
  rec.mark("options")
  await act.click("#more-toggle")
  await sleep(500)
  await act.hover("label:has-text('1080p')", {ms: 500})
  rec.mark("quality", await act.box("label:has-text('720p') >> xpath=../.."))
  await sleep(250)
  await act.click("label:has-text('Up to 4K')", {ms: 350})
  await sleep(300)
  await act.click("select[name='request[capture_settings][max_duration_s]']", {after: 150})
  rec.mark("length", await act.box("select[name='request[capture_settings][max_duration_s]']"))
  await page.selectOption("select[name='request[capture_settings][max_duration_s]']", "120")
  await page.keyboard.press("Escape").catch(() => {})
  await sleep(600)

  await bringIntoView(page, act, "#recipients-query", 260)
  await act.click("#recipients-query")
  rec.mark("people", await act.box("#recipients"))
  for (const [prefix, name] of PEOPLE) {
    await act.type(prefix, {delay: 70})
    const pick = page.locator("#recipients-suggestions").getByText(name).first()
    await pick.waitFor({state: "visible"})
    await sleep(180)
    await page.keyboard.press("Enter")
    await page.locator("#recipients").getByText(name).first().waitFor({timeout: 5000})
    await sleep(220)
  }
  rec.mark("people-done", await act.box("#recipients"))
  await sleep(600)

  rec.mark("send", await act.box("#send-menu"))
  await act.click("button[aria-label='More ways to send']", {after: 350})
  rec.mark("send-menu", await act.box("#send-menu-menu"))
  await act.hover("button[value='both']", {ms: 350})
  await sleep(400)
  await act.click("button[value='both']", {ms: 150})
  await page.waitForURL(/requests\/[0-9a-f-]+$/)
  await page.waitForSelector(".phx-connected")
  rec.mark("sent", await act.box("#recipients-table"))
  await act.glideTo(1150, 700, 700)
  await sleep(2500)
  await rec.stop()
  return page.url()
}

// 2. Everyone's personal link, the invite email, and the text message.
async function collect(d, requestUrl) {
  const {page} = d
  console.log("• collect")
  await page.goto(requestUrl)
  await page.waitForSelector(".phx-connected")
  const links = {}
  for (const [, name] of PEOPLE) {
    links[name] = await page
      .locator("#recipients-table tr", {hasText: name})
      .locator("[id^='copy-link-']")
      .first()
      .getAttribute("data-value")
  }

  const mail = await (await fetch(`${BASE}/dev/mailbox/json`)).json()
  const invite = mail.data.find((m) => JSON.stringify(m.to).includes("marcus.bell"))
  const phone = await desktopBrowser.newContext({
    viewport: {width: PHONE.width, height: PHONE.height},
    deviceScaleFactor: PHONE.dpr,
  })
  const ep = await phone.newPage()
  await ep.setContent(invite.html_body, {waitUntil: "networkidle"})
  await ep.screenshot({path: path.join(OUT, "email.png"), fullPage: true})
  await phone.close()

  await page.goto(`${BASE}/dev/sms`)
  await page.waitForSelector(".phx-connected")
  const texts = await page.locator("li", {hasText: /Marcus|Q4 kickoff/}).allInnerTexts()
  fs.writeFileSync(
    path.join(OUT, "messages.json"),
    JSON.stringify({email: {subject: invite.subject, from: invite.from, to: invite.to}, sms: texts, links}, null, 2)
  )
  console.log(`  email "${invite.subject}", ${texts.length} text(s)`)
  return links
}

// 3. A few other leaders get there first.
function others(links) {
  console.log("• others")
  execFileSync(
    "mix",
    [
      "run", "--no-start", "marketing/video/demo/submit.exs",
      `send:${links["Elena Ruiz"]}:face-elena`,
      `send:${links["Sam Okafor"]}:face-sam`,
      `open:${links["Priya Nair"]}`,
    ],
    {cwd: REPO, stdio: "inherit"}
  )
}

// 4. Marcus records on his phone while Maya's page updates live.
async function live(d, requestUrl, link) {
  const {page, act} = d
  console.log("• live")
  await page.goto(requestUrl)
  await page.waitForSelector(".phx-connected")
  // Wait for the other two videos' posters so the row looks settled.
  await page.locator("[id^='submission-'] img").nth(1).waitFor({timeout: 120_000})
  await act.park(1180, 760)
  await sleep(800)

  const context = await phoneBrowser.newContext({
    viewport: {width: PHONE.width, height: PHONE.height},
    deviceScaleFactor: PHONE.dpr,
    isMobile: true,
    hasTouch: true,
    permissions: ["camera", "microphone"],
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  })
  await installActor(context, {cursor: false})
  // iPhone Safari before iOS 26 has no element fullscreen, and headless
  // Chrome's fullscreen breaks the screencast, so record in the page.
  await context.addInitScript(() => {
    Element.prototype.requestFullscreen = undefined
    Element.prototype.webkitRequestFullscreen = undefined
    Object.defineProperty(Document.prototype, "fullscreenEnabled", {get: () => false})
  })
  const phone = await context.newPage()
  phone.setDefaultTimeout(30_000)
  phone.on("pageerror", (e) => console.log("  phone pageerror:", e.message))
  const tap = actor(phone).tap
  const state = (s, timeout = 30_000) => phone.waitForSelector(`[data-recorder][data-state='${s}']`, {timeout})

  const desk = await cast(page, "live-desk", DESK)
  const row = page.locator("#recipients-table tr", {hasText: "Marcus Bell"})
  desk.mark("start", await act.box(row))
  await phone.goto(link)
  await phone.waitForSelector(".phx-connected")
  desk.mark("opened", await act.box(row))
  const portrait = await cast(phone, "phone-portrait", PHONE)
  await sleep(2200)
  await tap("button:has-text('Record')")
  portrait.mark("tap-record")
  await state("priming")
  portrait.mark("priming")
  await sleep(1400)
  await tap("[data-action='continue']")
  portrait.mark("tap-continue")
  const cameraOn = Date.now()
  await state("orientation_blocked")
  portrait.mark("rotate")
  await sleep(3000)
  await portrait.stop()

  await phone.setViewportSize({width: PHONE.height, height: PHONE.width})
  // An iPhone with a Dynamic Island reports these insets in landscape; the
  // recorder moves the teleprompter and controls clear of them.
  const cdp = await context.newCDPSession(phone)
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {insets: {left: 59, right: 59, top: 0, bottom: 21}})
  await state("preview")
  await sleep(300)
  const land = await cast(phone, "phone-landscape", {width: PHONE.height, height: PHONE.width, dpr: PHONE.dpr})
  land.mark("preview")
  // Tap Record so the countdown ends as he starts talking.
  const tapAt = cameraOn + (TALK_AT - COUNTDOWN - 0.15) * 1000
  const wait = tapAt - Date.now()
  if (wait < 1500) console.log(`  warning: only ${wait}ms of preview before recording`)
  await sleep(Math.max(wait, 0))
  await tap("[data-action='record']")
  land.mark("tap-record")
  await state("recording", 10_000)
  land.mark("recording")
  desk.mark("recording", await act.box(row))
  // Long enough to keep rolling after his "thank you" (marcus-more).
  await sleep(13000)
  await tap("[data-action='record']")
  land.mark("tap-stop")
  await state("review")
  land.mark("review")
  await sleep(2200)
  await tap("[data-action='send']")
  land.mark("tap-send")
  await phone.getByText("Sent!").first().waitFor({timeout: 60_000})
  land.mark("sent")
  desk.mark("sent", await act.box(row))
  await sleep(2800)
  await land.stop()
  await context.close()

  // The new video processes and its poster appears.
  await page.locator("[id^='submission-'] img").nth(2).waitFor({timeout: 180_000})
  desk.mark("arrived", await act.box(page.locator("[id^='submission-']").first()))
  await sleep(2500)
  await desk.stop()
}

// 5. Maya opens Marcus's video: the player, specs, and downloads.
async function submission(d, requestUrl) {
  const {page, act} = d
  console.log("• submission")
  await page.goto(requestUrl)
  await page.waitForSelector(".phx-connected")
  await act.park(1180, 760)
  const rec = await cast(page, "submission", DESK)
  await sleep(700)
  rec.mark("click-video")
  await act.click(page.locator("[id^='submission-']", {hasText: "Marcus Bell"}).locator("a").first())
  await page.waitForURL(/submissions/)
  await page.waitForSelector(".phx-connected")
  rec.mark("page", await act.box("video"))
  await sleep(900)
  rec.mark("play")
  await act.click("[data-action='big-play']").catch(async () => act.click("video"))
  await sleep(3500)
  await act.hover("text=Resolution", {ms: 600, dx: 160})
  rec.mark("specs", await act.box(page.locator("section, div", {has: page.getByText("Resolution", {exact: true})}).last()))
  await sleep(1400)
  await act.hover("a:has-text('Original')", {ms: 700})
  rec.mark("original", await act.box("a:has-text('Original')"))
  await sleep(1300)
  await act.hover("a:has-text('Edit-ready MP4')", {ms: 400})
  rec.mark("edit-ready", await act.box("a:has-text('Edit-ready MP4')"))
  await sleep(1100)
  await act.hover("text=Send to an editor", {ms: 400})
  rec.mark("editor", await act.box("text=Send to an editor"))
  await sleep(1500)
  await rec.stop()
}

// 6. The library, for the scale montage.
async function library(d) {
  const {page, org, act} = d
  console.log("• library")
  await page.goto(`${BASE}${org}/library`)
  await page.waitForSelector(".phx-connected")
  await act.park(1180, 760)
  const rec = await cast(page, "library", DESK)
  await sleep(800)
  const tiles = page.locator("[id^='lib-']")
  const n = Math.min(await tiles.count(), 6)
  for (let i = 0; i < n; i++) {
    await act.hover(tiles.nth(i), {ms: 420})
    await sleep(450)
  }
  await sleep(800)
  await rec.stop()
}

const d = await desktop()
try {
  let requestUrl
  let links
  if (!only || only === "create") {
    requestUrl = await createRequest(d)
    links = await collect(d, requestUrl)
    fs.writeFileSync(path.join(OUT, ".state.json"), JSON.stringify({requestUrl, links}))
  } else {
    ;({requestUrl, links} = JSON.parse(fs.readFileSync(path.join(OUT, ".state.json"), "utf8")))
  }
  if (!only || only === "live") {
    others(links)
    await live(d, requestUrl, links["Marcus Bell"])
  }
  if (!only || only === "submission" || only === "live") await submission(d, requestUrl)
  if (!only || only === "library" || only === "live") await library(d)
} finally {
  await desktopBrowser.close()
  await phoneBrowser.close()
}
console.log("done")
