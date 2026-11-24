#!/usr/bin/env bash
# check_reel.sh file.mp4 WIDTH HEIGHT  -> PASS/FAIL: 15-30 s, exact size, H.264, <= 12 MB
f=$1; W=$2; H=$3
[ -f "$f" ] || { echo "FAIL $f missing"; exit 1; }
read -r w h c < <(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name -of csv=p=0 "$f" | awk -F, '{print $2, $3, $1}')
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
mb=$(python3 -c "import os;print(round(os.path.getsize('$f')/1e6,2))")
ok=$(python3 -c "print(15<=$d<=30 and $w==$W and $h==$H and '$c'=='h264' and $mb<=12)")
echo "$([ "$ok" = True ] && echo PASS || echo FAIL) $f ${w}x${h} $c ${d}s ${mb}MB"
[ "$ok" = True ]
