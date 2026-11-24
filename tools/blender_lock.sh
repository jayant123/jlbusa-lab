#!/bin/zsh
# Run one Blender job at a time across parallel agents. Usage: tools/blender_lock.sh blender -b ...
# The lock holds the owner's PID. A lock whose PID is gone (killed job) is stale and gets taken over.
LOCK=/tmp/jlbusa-lab-blender.lock
while ! mkdir "$LOCK" 2>/dev/null; do
  pid=$(cat "$LOCK/pid" 2>/dev/null)
  if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then rm -rf "$LOCK"; continue; fi
  sleep 5
done
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT INT TERM HUP
"$@"
