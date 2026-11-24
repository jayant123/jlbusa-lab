#!/usr/bin/env bash
# make_reel.sh BRAND WORDMARK  -> public/<brand>/reel-1080p.mp4, reel-vertical.mp4, poster.webp (optional music: build/music-<brand>.m4a|mp3|wav)
set -euo pipefail
brand=$1; word=$2
font=blender/fonts/Archivo-Expanded-Medium.ttf
spaced=$(echo "$word" | sed 's/./& /g; s/ $//')
music=$(ls build/music-$brand.* 2>/dev/null | head -1 || true)
card="drawtext=fontfile=$font:text='$spaced':fontcolor=0xE9E7E2:fontsize=h*0.055:x=(w-text_w)/2:y=h*0.44:alpha='if(lt(t,18.2),0,min(1,(t-18.2)/0.8))',drawtext=fontfile=$font:text='A concept by JLB USA':fontcolor=0xCFB488:fontsize=h*0.022:x=(w-text_w)/2:y=h*0.53:alpha='if(lt(t,18.7),0,min(1,(t-18.7)/0.8))'"
for aspect in wide tall; do
  out=public/$brand/reel-$([ $aspect = wide ] && echo 1080p || echo vertical).mp4
  if [ -n "$music" ]; then
    ffmpeg -y -loglevel error -framerate 24 -i build/reel-$brand-$aspect/f%04d.png -i "$music" -vf "$card" -af "afade=t=in:d=1.5,afade=t=out:st=18:d=2" \
      -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart "$out"
  else
    ffmpeg -y -loglevel error -framerate 24 -i build/reel-$brand-$aspect/f%04d.png -vf "$card" \
      -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -movflags +faststart "$out"
  fi
done
ffmpeg -y -loglevel error -i build/reel-$brand-wide/f0100.png -vf scale=1600:-2 -quality 82 public/$brand/poster.webp
tools/check_reel.sh public/$brand/reel-1080p.mp4 1920 1080
tools/check_reel.sh public/$brand/reel-vertical.mp4 1080 1920
