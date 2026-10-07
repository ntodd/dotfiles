"""Render a lower-third PNG (transparent) for overlay in ffmpeg.

usage: uv run --quiet --with pillow python3 make_lower_third.py "Name" "Title, Org" out.png [accent_hex]

Design: Avenir Next demi-bold 64 px name, medium 34 px title, 8 px accent bar
spanning exactly the text's alpha bbox (so it is visually centred on the
text), soft drop shadow for legibility over light clothing. Overlay in ffmpeg:
  -loop 1 -t 13 -i lower_third.png ...
  [N:v]format=rgba,fade=in:st=6.0:d=0.5:alpha=1,fade=out:st=11.5:d=0.6:alpha=1,setpts=PTS-STARTPTS[lt];
  [v0][lt]overlay=x='96-40*(1-min(1,max(0,(t-6.0)/0.6)))':y=H-h-96:eval=frame:enable='between(t,6.0,12.2)'[v]
"""
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

NAME, TITLE, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ACCENT = sys.argv[4] if len(sys.argv) > 4 else "8df397"
accent = tuple(int(ACCENT[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
FONT = "/System/Library/Fonts/Avenir Next.ttc"
W, H = 1400, 240


def font(variation, size):
    f = ImageFont.truetype(FONT, size)
    try:
        f.set_variation_by_name(variation)
    except Exception:
        pass
    return f


txt = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(txt)
d.text((40, 30), NAME, font=font("Demi Bold", 64), fill=(255, 255, 255, 255))
d.text((42, 126), TITLE, font=font("Medium", 34), fill=(232, 234, 238, 255))
tb = txt.getbbox()

shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
shadow.paste((0, 0, 0, 200), (0, 0, W, H), txt.getchannel("A"))
shadow = shadow.transform(shadow.size, Image.AFFINE, (1, 0, -2, 0, 1, -3)).filter(ImageFilter.GaussianBlur(7))
out = Image.alpha_composite(shadow, txt)
ImageDraw.Draw(out).rectangle([0, tb[1], 8, tb[3]], fill=accent)
bb = out.getbbox()
out = out.crop((0, 0, bb[2] + 14, H))
out.save(OUT)
print(OUT, out.size)
