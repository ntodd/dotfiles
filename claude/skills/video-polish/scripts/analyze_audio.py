"""Find tonal hum peaks and band energy in a speech recording.

usage: uv run --with numpy --with scipy python3 analyze_audio.py in.wav [noise_end_seconds]

Prints stereo correlation, tonal peaks (Hz, dB above local floor) measured in
the speech-free head of the clip (default first 1.3 s) and over the whole
file, per-band energy, and refined hum frequencies. Also render a spectrogram
to look at:
  ffmpeg -i in.wav -lavfi "showspectrumpic=s=1600x800:mode=combined:scale=log:fscale=log:legend=1:start=20:stop=12000" spec.png
"""
import sys
import numpy as np
import scipy.io.wavfile as w
import scipy.signal as ss

path = sys.argv[1]
noise_end = float(sys.argv[2]) if len(sys.argv) > 2 else 1.3
sr, x = w.read(path)
x = x.astype(np.float64) / 32768
if x.ndim == 2:
    L, R = x[:, 0], x[:, 1]
    print("stereo corr:", round(np.corrcoef(L, R)[0, 1], 3),
          "| L-R rms dB:", round(20 * np.log10(np.sqrt(np.mean((L - R) ** 2)) + 1e-12), 1))
    m = x.mean(1)
else:
    m = x


def peaks(seg, label, n=12):
    f, P = ss.welch(seg, sr, nperseg=32768, noverlap=16384)
    Pdb = 10 * np.log10(P + 1e-20)
    floor = ss.medfilt(Pdb, 301)
    prom = Pdb - floor
    idx, _ = ss.find_peaks(prom, height=8, distance=20)
    idx = idx[np.argsort(-prom[idx])][:n]
    print(f"\n{label}: tonal peaks (Hz, dB above local floor, abs dB)")
    for i in sorted(idx):
        print(f"  {f[i]:8.1f}  +{prom[i]:5.1f}  {Pdb[i]:6.1f}")
    return f, Pdb


peaks(m[: int(noise_end * sr)], f"noise-only 0-{noise_end}s")
f, Pdb = peaks(m, "full clip")
for lo, hi in [(20, 60), (60, 120), (120, 300), (300, 500), (500, 1000), (1000, 2500),
               (2500, 5000), (5000, 10000), (10000, 20000)]:
    sel = (f >= lo) & (f < hi)
    print(f"band {lo:5d}-{hi:5d} Hz mean {Pdb[sel].mean():6.1f} dB")

seg = m[: int(noise_end * sr)]
F = np.fft.rfft(seg * np.hanning(len(seg)), n=1 << 20)
fr = np.fft.rfftfreq(1 << 20, 1 / sr)
for lo, hi in [(40, 70), (100, 130), (300, 450), (700, 900)]:
    sel = (fr > lo) & (fr < hi)
    print(f"refined peak {lo}-{hi} Hz: {fr[sel][np.argmax(np.abs(F[sel]))]:.1f}")
