// Human-looking input for recordings: a visible cursor that glides with
// easing, presses on click, and a soft touch ripple for phone taps.

// Injected into every page. Lives on <html> so LiveView patches to <body>
// don't remove it, and remembers its position across full page loads.
const CURSOR_SCRIPT = `
(() => {
  if (window.__actor) return
  window.__actor = true
  const install = () => {
    if (!document.documentElement || document.getElementById("__cursor")) return
    const style = document.createElement("style")
    style.textContent = \`
      #__cursor{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;
        transform:translate(-3px,-2px);transition:transform .12s cubic-bezier(.16,1,.3,1);will-change:left,top}
      #__cursor.down{transform:translate(-3px,-2px) scale(.84)}
      #__cursor svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.28))}
      .__tap{position:fixed;z-index:2147483647;pointer-events:none;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;
        background:rgba(255,255,255,.55);border:2px solid rgba(255,255,255,.9);box-shadow:0 0 0 1px rgba(0,0,0,.12);
        animation:__tap .55s cubic-bezier(.16,1,.3,1) forwards}
      @keyframes __tap{0%{transform:scale(.4);opacity:.95}100%{transform:scale(1.25);opacity:0}}
    \`
    document.documentElement.appendChild(style)
    const c = document.createElement("div")
    c.id = "__cursor"
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2.5v19.2l5.3-5.1 3.4 7.7 3.4-1.5-3.3-7.5h7.3z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    const saved = JSON.parse(sessionStorage.getItem("__cursor") || "null")
    if (saved) { c.style.left = saved[0] + "px"; c.style.top = saved[1] + "px" } else { c.style.left = "-60px"; c.style.top = "-60px" }
    document.documentElement.appendChild(c)
    const move = (e) => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; sessionStorage.setItem("__cursor", JSON.stringify([e.clientX, e.clientY])) }
    addEventListener("mousemove", move, true)
    addEventListener("mousedown", () => c.classList.add("down"), true)
    addEventListener("mouseup", () => c.classList.remove("down"), true)
    addEventListener("touchstart", (e) => {
      for (const t of e.touches) {
        const r = document.createElement("div"); r.className = "__tap"
        r.style.left = t.clientX + "px"; r.style.top = t.clientY + "px"
        document.documentElement.appendChild(r); setTimeout(() => r.remove(), 700)
      }
    }, true)
    if (window.__hideCursor) c.style.display = "none"
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install); else install()
  new MutationObserver(install).observe(document, {childList: true, subtree: false})
})()
`

export async function installActor(context, {cursor = true} = {}) {
  if (!cursor) await context.addInitScript("window.__hideCursor = true")
  await context.addInitScript(CURSOR_SCRIPT)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

export function actor(page) {
  let pos = {x: 640, y: 420}

  async function glideTo(x, y, ms) {
    const dist = Math.hypot(x - pos.x, y - pos.y)
    const duration = ms ?? Math.min(900, 280 + dist * 0.9)
    const steps = Math.max(8, Math.round(duration / 16))
    const from = {...pos}
    // A slight arc reads as a hand, not a robot.
    const bend = Math.min(60, dist * 0.12)
    for (let i = 1; i <= steps; i++) {
      const t = ease(i / steps)
      const arc = Math.sin(Math.PI * t) * bend
      const nx = from.x + (x - from.x) * t
      const ny = from.y + (y - from.y) * t - arc
      await page.mouse.move(nx, ny)
      await sleep(duration / steps)
    }
    pos = {x, y}
  }

  async function smoothScroll(dy, ms = 700) {
    const steps = Math.max(8, Math.round(ms / 16))
    let done = 0
    for (let i = 1; i <= steps; i++) {
      const target = Math.round(dy * ease(i / steps))
      await page.mouse.wheel(0, target - done)
      done = target
      await sleep(16)
    }
    await sleep(120)
  }

  // Scrolls smoothly (never jumps) so the target sits clear of sticky
  // headers and footers, then returns its center.
  async function center(target, {dx = 0, dy = 0, margin = 150} = {}) {
    const loc = typeof target === "string" ? page.locator(target).first() : target
    let box = await loc.boundingBox()
    if (!box) throw new Error(`no box for ${target}`)
    const vh = page.viewportSize().height
    if (box.y < margin * 0.6 || box.y + box.height > vh - margin) {
      await smoothScroll(box.y + box.height / 2 - vh * 0.45)
      box = await loc.boundingBox()
    }
    return {x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 + dy}
  }

  return {
    get pos() {
      return pos
    },
    sleep,
    async park(x, y) {
      await page.mouse.move(x, y)
      pos = {x, y}
    },
    glideTo,
    async hover(target, opts = {}) {
      const p = await center(target, opts)
      await glideTo(p.x, p.y, opts.ms)
    },
    async click(target, opts = {}) {
      const p = await center(target, opts)
      await glideTo(p.x, p.y, opts.ms)
      await sleep(opts.settle ?? 90)
      await page.mouse.down()
      await sleep(70)
      await page.mouse.up()
      await sleep(opts.after ?? 250)
    },
    async type(text, {delay = 42, jitter = 30} = {}) {
      for (const ch of text) {
        await page.keyboard.type(ch)
        await sleep(delay + Math.random() * jitter + (/[ ,.]/.test(ch) ? 35 : 0))
      }
    },
    async paste(text) {
      await page.keyboard.insertText(text)
    },
    // Phone UIs here are fixed-position, so taps never scroll.
    async tap(target, opts = {}) {
      const loc = typeof target === "string" ? page.locator(target).first() : target
      const box = await loc.boundingBox()
      if (!box) throw new Error(`no box for ${target}`)
      const p = {x: box.x + box.width / 2, y: box.y + box.height / 2}
      await page.touchscreen.tap(p.x, p.y)
      await sleep(opts.after ?? 300)
    },
    scrollBy: smoothScroll,
    box: async (target) => (typeof target === "string" ? page.locator(target).first() : target).boundingBox(),
  }
}
