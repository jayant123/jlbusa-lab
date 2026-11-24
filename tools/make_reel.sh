#!/usr/bin/env bash
# make_reel.sh BRAND WORDMARK  -> public/<brand>/reel-1080p.mp4, reel-vertical.mp4, poster.webp (optional music: build/music-<brand>.m4a|mp3|wav)
set -euo pipefail
brand=$1; word=$2
font=blender/fonts/Archivo-Expanded-Medium.ttf
spaced=$(echo "$word" | sed 's/./& /g; s/ $//')
music=$(ls build/music-$brand.* 2>/dev/null | head -1 || true)
card_png() {  # end card as a transparent PNG (this ffmpeg has no drawtext)
  python3 - "$1" "$2" "$3" "$spaced" "$font" <<'PY'
import sys
from PIL import Image, ImageDraw, ImageFont
w, h, out, word, font = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3], sys.argv[4], sys.argv[5]
im = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
f1 = ImageFont.truetype(font, int(h * 0.055)); f2 = ImageFont.truetype(font, int(h * 0.022))
for text, f, y, col in ((word, f1, 0.44, (233, 231, 226, 255)), ('A concept by JLB USA', f2, 0.53, (207, 180, 136, 255))):
    tw = d.textlength(text, font=f); d.text(((w - tw) / 2, h * y), text, font=f, fill=col)
im.save(out)
PY
}
for aspect in wide tall; do
  if [ $aspect = wide ]; then card_png 1920 1080 build/card-$brand-$aspect.png; else card_png 1080 1920 build/card-$brand-$aspect.png; fi
  card="[1:v]format=rgba,fade=t=in:st=18.2:d=0.9:alpha=1[c];[0:v][c]overlay=0:0:shortest=1"
  out=public/$brand/reel-$([ $aspect = wide ] && echo 1080p || echo vertical).mp4
  if [ -n "$music" ]; then
    ffmpeg -y -loglevel error -framerate 24 -i build/reel-$brand-$aspect/f%04d.png -loop 1 -framerate 24 -t 20 -i build/card-$brand-$aspect.png -i "$music" -filter_complex "$card" -map 2:a -af "afade=t=in:d=1.5,afade=t=out:st=18:d=2" \
      -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart "$out"
  else
    ffmpeg -y -loglevel error -framerate 24 -i build/reel-$brand-$aspect/f%04d.png -loop 1 -framerate 24 -t 20 -i build/card-$brand-$aspect.png -filter_complex "$card" -shortest \
      -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart "$out"
  fi
done
ffmpeg -y -loglevel error -i build/reel-$brand-wide/f0100.png -vf scale=1600:-2 -quality 82 public/$brand/poster.webp
tools/check_reel.sh public/$brand/reel-1080p.mp4 1920 1080
tools/check_reel.sh public/$brand/reel-vertical.mp4 1080 1920
