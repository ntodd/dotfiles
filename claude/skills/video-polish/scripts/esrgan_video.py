"""Real-ESRGAN x2 over a whole clip on the Apple GPU (MPS), frames piped through ffmpeg.

usage:
  uv run --quiet --python 3.11 --with "torch==2.1.2" --with "torchvision==0.16.2" \
     --with realesrgan --with "numpy<2" --with opencv-python \
     python3 esrgan_video.py in.mp4 out_2x.mp4 [pre_filter]

pre_filter: ffmpeg -vf applied before upscaling (default light hqdn3d).
Benchmark first: ~0.4 s/frame on an M5 Max (CPU is ~10 s/frame). Grade and
downscale to the delivery size afterwards; drop hqdn3d from that grade since it
already ran here. Output frame count may exceed the source's nb_frames for VFR
sources; check duration instead.
"""
import subprocess, sys, time
import cv2, numpy as np, torch
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer

src, dst = sys.argv[1], sys.argv[2]
pre = sys.argv[3] if len(sys.argv) > 3 else "hqdn3d=1.5:1.5:4:4"

probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries",
                        "stream=width,height,r_frame_rate", "-of", "csv=p=0", src],
                       capture_output=True, text=True).stdout.strip().split(",")
W, H, FPS = int(probe[0]), int(probe[1]), probe[2]

model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=2)
dev = "mps" if torch.backends.mps.is_available() else "cpu"
up = RealESRGANer(scale=2, model=model, tile=0, half=False, device=torch.device(dev),
                  model_path="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth")
print("device", dev, flush=True)

dec = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", src, "-vf", pre,
                        "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
enc = subprocess.Popen(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
                        "-pix_fmt", "bgr24", "-s", f"{W*2}x{H*2}", "-r", FPS, "-i", "-",
                        "-c:v", "libx264", "-preset", "medium", "-crf", "14", "-pix_fmt", "yuv420p", dst],
                       stdin=subprocess.PIPE)
n, t0 = 0, time.time()
while True:
    buf = dec.stdout.read(W * H * 3)
    if len(buf) < W * H * 3:
        break
    out, _ = up.enhance(np.frombuffer(buf, np.uint8).reshape(H, W, 3), outscale=2)
    enc.stdin.write(np.ascontiguousarray(out).tobytes())
    n += 1
    if n % 100 == 0:
        print(f"{n} frames, {time.time()-t0:.0f}s", flush=True)
enc.stdin.close(); enc.wait(); dec.wait()
print(f"done {n} frames in {time.time()-t0:.0f}s")
