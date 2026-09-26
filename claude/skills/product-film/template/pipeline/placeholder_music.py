# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy", "soundfile"]
# ///
"""A stand-in music bed for dry runs: 118 BPM clicks, quiet for 16 s, a
louder groove to 80 s (the "drop"), one low hit at 80 s, then a tail. Enough
for the beat and drop analysis to lay out the timeline without generating
real music."""
from pathlib import Path

import numpy as np
import soundfile as sf

sr, dur, bpm = 48000, 86.0, 118.0
t = np.arange(int(sr * dur)) / sr
beat = 60 / bpm
level = np.where(t < 16, 0.15, np.where(t < 80, 0.6, 0.0))
clicks = level * np.exp(-40 * np.mod(t, beat)) * np.sin(2 * np.pi * 80 * t)
hit = np.where((t >= 80) & (t < 82), 0.9 * np.exp(-3 * (t - 80)) * np.sin(2 * np.pi * 55 * t), 0)
out = Path(__file__).resolve().parent.parent / "public/music/track.wav"
out.parent.mkdir(parents=True, exist_ok=True)
sf.write(out, np.stack([clicks + hit] * 2, axis=1).astype(np.float32), sr)
print(out)
