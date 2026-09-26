# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile", "scipy"]
# ///
"""Synthesizes the film's UI sound effects into public/sfx/*.wav.

Everything is made from sine partials and filtered noise, so the sounds
are clean, license-free, and easy to retune here.
"""
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
out = Path(__file__).resolve().parent.parent / "public/sfx"
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


def t(d):
    return np.arange(int(SR * d)) / SR


def env(n, attack=0.004, decay=0.2, curve=4.0):
    x = np.arange(n) / SR
    a = np.clip(x / attack, 0, 1)
    d = np.exp(-curve * np.clip(x - attack, 0, None) / decay)
    return a * d


def band(x, lo, hi, order=2):
    sos = butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return sosfilt(sos, x)


def lowpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="low", fs=SR, output="sos"), x)


def highpass(x, f, order=2):
    return sosfilt(butter(order, f, btype="high", fs=SR, output="sos"), x)


def stereo(x, width=0.0):
    # A touch of Haas width keeps small sounds from feeling mono and dry.
    d = int(SR * 0.0007 * width)
    left = x
    right = np.concatenate([np.zeros(d), x[: len(x) - d]]) if d else x
    return np.stack([left, right], axis=1)


def reverb(x, amount=0.18, length=0.6):
    n = int(SR * length)
    ir = rng.standard_normal(n) * np.exp(-6 * np.arange(n) / n)
    ir = lowpass(ir, 6000)
    wet = np.convolve(x, ir)[: len(x) + n]
    dry = np.concatenate([x, np.zeros(len(wet) - len(x))])
    wet = wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(x))
    return dry + amount * wet


def save(name, x, peak_db=-3.0, width=0.6):
    x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (peak_db / 20)
    fade = min(len(x), int(SR * 0.01))
    x[-fade:] *= np.linspace(1, 0, fade)
    sf.write(out / f"{name}.wav", stereo(x, width), SR, subtype="PCM_24")
    print(f"{name}.wav {len(x) / SR:.2f}s")


# Message bubble: a rounded pitch-dropping blip.
x = t(0.16)
f = 880 * np.exp(-x * 9) + 520
pop = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.002, 0.05)
pop += 0.3 * np.sin(2 * np.pi * 2 * np.cumsum(f) / SR) * env(len(x), 0.001, 0.02)
save("pop", reverb(pop, 0.12, 0.3), -6)

# Outgoing message: brighter, rising swoosh-blip.
x = t(0.22)
f = 600 + 900 * (1 - np.exp(-x * 25))
swish = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.004, 0.06)
noise = band(rng.standard_normal(len(x)), 2000, 8000) * env(len(x), 0.01, 0.05) * 0.25
save("send", reverb(swish + noise, 0.12, 0.3), -7)

# Notification: two soft bell partials.
x = t(0.9)
ding = sum(a * np.sin(2 * np.pi * fr * x) * env(len(x), 0.002, dec, 3)
           for fr, a, dec in [(1318.5, 1, 0.35), (1975.5, 0.45, 0.25), (2637, 0.2, 0.15)])
x2 = t(0.9)
ding2 = sum(a * np.sin(2 * np.pi * fr * x2) * env(len(x2), 0.002, dec, 3)
            for fr, a, dec in [(987.8, 1, 0.4), (1479.9, 0.4, 0.3)])
d = np.zeros(int(SR * 1.1))
d[: len(ding)] += ding
d[int(SR * 0.11): int(SR * 0.11) + len(ding2)] += ding2
save("notify", reverb(d, 0.2, 0.8), -8)

# Error buzz for "file too large": two short dull tones.
x = t(0.12)
buzz = np.sign(np.sin(2 * np.pi * 180 * x)) * env(len(x), 0.003, 0.08)
buzz = lowpass(buzz, 1800)
e = np.zeros(int(SR * 0.34))
e[: len(buzz)] += buzz
e[int(SR * 0.16): int(SR * 0.16) + len(buzz)] += buzz
save("error", e, -12)

# Mouse / tap click: a tiny filtered transient.
x = t(0.05)
click = band(rng.standard_normal(len(x)), 1500, 7000) * env(len(x), 0.0005, 0.008, 5)
click += 0.4 * np.sin(2 * np.pi * 2200 * x) * env(len(x), 0.0005, 0.006)
save("click", click, -10, 0.2)

# Keyboard tick, softer and duller than a click.
x = t(0.04)
key = band(rng.standard_normal(len(x)), 800, 4000) * env(len(x), 0.0005, 0.006, 5)
save("key", key, -16, 0.2)

# Whoosh: band-passed noise with a sweeping center.
def whoosh(dur, lo, hi, name, peak):
    n = int(SR * dur)
    noise = rng.standard_normal(n)
    chunks = []
    step = 512
    for i in range(0, n, step):
        p = i / n
        center = lo * (hi / lo) ** p
        seg = noise[max(0, i - 2048): i + step]
        filt = band(seg, center * 0.3, min(center * 2.8, SR / 2 - 100))[-min(step, n - i):]
        chunks.append(filt)
    w = np.concatenate(chunks)[:n]
    shape = np.sin(np.pi * np.linspace(0, 1, n)) ** 2
    save(name, reverb(w * shape, 0.25, 0.7), peak, 1.0)


whoosh(0.7, 300, 5000, "whoosh", -6)
whoosh(0.45, 600, 7000, "whoosh-short", -8)

# Riser into the logo reveal.
n = int(SR * 2.0)
x = np.arange(n) / SR
f = 200 * (12 ** (x / 2.0))
tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
riser = band(rng.standard_normal(n), 800, 9000) * (x / 2.0) ** 2 + tone * (x / 2.0) ** 3
save("riser", riser, -9, 1.0)

# Record start: the classic two-note chirp.
x = t(0.12)
beep = np.sin(2 * np.pi * 1046.5 * x) * env(len(x), 0.003, 0.05)
b2 = np.sin(2 * np.pi * 1568 * x) * env(len(x), 0.003, 0.07)
r = np.zeros(int(SR * 0.4))
r[: len(beep)] += beep
r[int(SR * 0.1): int(SR * 0.1) + len(b2)] += b2
save("record", reverb(r, 0.15, 0.4), -9)

# Success: a bright rising major arpeggio.
notes = [1046.5, 1318.5, 1568.0, 2093.0]
s = np.zeros(int(SR * 1.2))
for i, fr in enumerate(notes):
    x = t(0.7)
    tone = np.sin(2 * np.pi * fr * x) + 0.25 * np.sin(2 * np.pi * 2 * fr * x)
    tone *= env(len(x), 0.004, 0.3, 3)
    start = int(SR * 0.07 * i)
    s[start: start + len(tone)] += tone * (0.8 + 0.1 * i)
save("success", reverb(s, 0.25, 0.9), -8)

# Soft sub thump for big moments.
x = t(0.6)
f = 90 * np.exp(-x * 6) + 40
thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(len(x), 0.002, 0.25, 3)
save("thump", thump, -4, 0.0)

# Glitch crunch for the degrading video.
n = int(SR * 0.35)
g = rng.standard_normal(n)
g = np.round(g * 3) / 3  # bit-crush
hold = 30
g = np.repeat(g[::hold], hold)[:n]  # sample-rate crush
g = band(g, 400, 6000) * env(n, 0.002, 0.12, 3)
save("glitch", g, -10, 0.8)

# Counter tick for rolling numbers.
x = t(0.03)
tick = np.sin(2 * np.pi * 3200 * x) * env(len(x), 0.0005, 0.005)
save("tick", tick, -16, 0.2)
