#!/bin/zsh
# Run one Blender job at a time across parallel agents. Usage: tools/blender_lock.sh blender -b -P ... -- ...
LOCK=/tmp/jlbusa-lab-blender.lock
until mkdir "$LOCK" 2>/dev/null; do sleep 5; done
trap 'rmdir "$LOCK"' EXIT INT TERM
"$@"
