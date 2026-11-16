#!/usr/bin/env bash
# cover.sh <production_dir> <scene> <frame> "<line1>" "<line2>"  -> output/cover.jpg (1080x1920; title inside the 1080x1350 centre crop)
set -euo pipefail
P=$1; F=$(cd "$(dirname "$0")/three/fonts" && pwd)
ffmpeg -hide_banner -loglevel error -y -i "$P/build/frames/$2/f$(printf %04d $3).png" -vf "\
vignette=PI/4.2,noise=alls=4,\
drawtext=fontfile=$F/Fraunces-Regular.ttf:text='$4':fontcolor=0xEDE6D6:fontsize=92:x=(w-tw)/2:y=360,\
drawtext=fontfile=$F/Fraunces-Regular.ttf:text='$5':fontcolor=0xFF8A1F:fontsize=92:x=(w-tw)/2:y=470,\
drawtext=fontfile=$F/Inter-SemiBold.ttf:text='oddlight':fontcolor=0xEDE6D6@0.8:fontsize=38:x=(w-tw)/2:y=1560" -q:v 2 "$P/output/cover.jpg"
echo "$P/output/cover.jpg"
