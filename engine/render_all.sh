#!/usr/bin/env bash
# Render every scene of a production from its timeline (clip durations), two scenes in parallel.
set -euo pipefail
PROD=$1; ENGINE=$(cd "$(dirname "$0")/three" && pwd)
python3 -c "import json;t=json.load(open('$PROD/build/timeline.json'));[print(s['id'],s['clip']) for s in t['scenes']]" > "$PROD/build/clips.txt"
mkdir -p "$PROD/build/frames"
cat "$PROD/build/clips.txt" | xargs -P 2 -L 1 bash -c 'rm -rf "'"$PROD"'/build/frames/$0"; node "'"$ENGINE"'/render.mjs" --scene $0 --dur $1 --out "'"$PROD"'/build/frames/$0" | tail -1'
echo ALL_DONE
