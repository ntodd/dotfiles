#!/bin/zsh
# Dialogue cleanup: DeepFilterNet3 neural denoise, then ffmpeg post chain.
#
# usage: clean_audio.sh input.(mp4|wav) out.wav [hum_hz]
#   hum_hz: residual notch frequency from analyze_audio.py (default 409.3)
#
# Output: 48 kHz stereo WAV normalized to -16 LUFS. Mux a preview immediately:
#   ffmpeg -i input.mp4 -i out.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest preview.mp4
set -e
IN="$1"; OUT="$2"; HUM="${3:-409.3}"
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"

ffmpeg -hide_banner -loglevel error -y -i "$IN" -vn -ac 1 -ar 48000 "$TMP/mono48.wav"

uv run --quiet --python 3.11 \
  --with deepfilternet --with "torch==2.1.2" --with "torchaudio==2.1.2" --with numpy --with soundfile \
  python3 - "$TMP/mono48.wav" "$TMP/df.wav" <<'PY'
import sys
from df.enhance import enhance, init_df, load_audio, save_audio
model, df_state, _ = init_df()
audio, _ = load_audio(sys.argv[1], sr=df_state.sr())
# atten_lim_db caps the denoise so word gaps keep some room tone (avoids a gated sound)
save_audio(sys.argv[2], enhance(model, df_state, audio, atten_lim_db=30), df_state.sr())
PY

POST="$(sed "s/HUM_HZ/$HUM/" "$HERE/post_chain.txt" | tr -d '\n')"
ffmpeg -hide_banner -loglevel error -y -i "$TMP/df.wav" -af "$POST" -ar 48000 -ac 2 "$OUT"
rm -rf "$TMP"
echo "wrote $OUT"
ffmpeg -hide_banner -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|LRA|Peak):"
