# /// script
# requires-python = ">=3.10"
# dependencies = ["librosa>=0.10", "numpy", "soundfile"]
# ///
"""Beat grid and structure for the music bed.

Writes public/music/analysis.json: tempo, beat times, bar (downbeat) times,
the drop (biggest energy jump early in the track), and an energy curve. The
edit snaps cuts to beats and lands the logo reveal on the drop.
"""
import json
from pathlib import Path

import librosa
import numpy as np

root = Path(__file__).resolve().parent.parent
track = root / "public/music/track.wav"
y, sr = librosa.load(track, sr=22050, mono=True)
dur = len(y) / sr

tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units="time", tightness=120)
tempo = float(np.atleast_1d(tempo)[0])
beats = [float(b) for b in beats]

# Downbeats: pick the phase (0..3) whose beats carry the most low-end onset.
onset = librosa.onset.onset_strength(y=y, sr=sr, aggregate=np.median, fmax=200)
times = librosa.times_like(onset, sr=sr)
strength = np.interp(beats, times, onset) if beats else np.array([])
phase = int(np.argmax([strength[p::4].mean() if len(strength[p::4]) else 0 for p in range(4)])) if beats else 0
bars = beats[phase::4]

# Energy curve at 4 Hz.
hop = sr // 4
rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0]
rms_db = librosa.amplitude_to_db(rms, ref=np.max)
energy = [round(float(v), 2) for v in rms_db]

# The drop: the bar where energy after it most exceeds energy before it,
# looking between 6 s and 30 s.
def mean_db(t0, t1):
    a, b = int(t0 * 4), max(int(t1 * 4), int(t0 * 4) + 1)
    return float(np.mean(rms_db[a:b])) if a < len(rms_db) else -80.0

candidates = [b for b in bars if 6 <= b <= min(30, dur - 8)]
drop = max(candidates, key=lambda b: mean_db(b, b + 4) - mean_db(b - 4, b)) if candidates else None

# The ending hit: the last strong onset in the final stretch, after which
# the track decays.
full_onset = librosa.onset.onset_strength(y=y, sr=sr)
ot = librosa.times_like(full_onset, sr=sr)
window = (ot > dur - 16) & (ot < dur - 1)
end_hit = None
if window.any():
    peak = full_onset[window].max()
    for i in np.where(window)[0][::-1]:
        if full_onset[i] >= 0.5 * peak and mean_db(ot[i] + 0.3, ot[i] + 2.3) < mean_db(ot[i] - 2, ot[i]) - 3:
            end_hit = float(ot[i])
            break
    if end_hit is None:
        end_hit = float(ot[window][np.argmax(full_onset[window])])

out = {
    "duration": round(dur, 3),
    "tempo": round(tempo, 2),
    "beats": [round(b, 3) for b in beats],
    "bars": [round(b, 3) for b in bars],
    "drop": round(drop, 3) if drop else None,
    "end_hit": round(end_hit, 3) if end_hit else None,
    "energy_hz": 4,
    "energy_db": energy,
}
(root / "public/music/analysis.json").write_text(json.dumps(out))
print(f"tempo {tempo:.1f} bpm, {len(beats)} beats, {len(bars)} bars, drop at {drop}, end hit at {end_hit}, duration {dur:.1f}s")
