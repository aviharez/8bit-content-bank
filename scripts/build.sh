#!/usr/bin/env bash
# Build one video end to end: simulation -> music -> render.
# Usage: scripts/build.sh count-the-clacks CountTheClacks
set -euo pipefail
SLUG="${1:?video slug, e.g. count-the-clacks}"
COMP="${2:?composition id, e.g. CountTheClacks}"
cd "$(dirname "$0")/.."

echo "1/3 simulation"
npx tsx "sims/${SLUG}.ts"

echo "2/3 music (Audio as Code)"
uv run --locked python "music/${SLUG}/compose.py"

echo "3/3 render"
CHROME_FLAGS=()
if [ -n "${CHROME:-}" ]; then CHROME_FLAGS=(--browser-executable="$CHROME"); fi
npx remotion render src/index.ts "$COMP" "out/${SLUG}.mp4" --gl=swangle --codec=h264 --crf=18 "${CHROME_FLAGS[@]}"

# Dithered pixel art is noisy for h264: re-encode small enough to keep in git.
ffmpeg -y -loglevel error -i "out/${SLUG}.mp4" -c:v libx264 -preset slow -tune animation -crf 23 \
  -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart "renders/${SLUG}.mp4"
echo "done -> renders/${SLUG}.mp4"
