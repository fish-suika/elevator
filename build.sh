#!/bin/sh
# 分割ソースを1枚のHTMLに結合する
cd "$(dirname "$0")"

# --- 本体 ---
cat src/00-head.html \
    src/10-config.js \
    src/20-floors.js \
    src/25-game.js \
    src/22-sound.js \
    src/30-car.js \
    src/40-people.js \
    src/50-input.js \
    src/60-hud.js \
    src/90-boot.js \
    src/99-tail.html > elevator.html
cp elevator.html index.html   # GitHub Pages はルートの index.html を配信する

# --- 検証ページ（three.js を使わない部分だけ） ---
cat src/verify-head.html \
    src/10-config.js \
    src/20-floors.js \
    src/25-game.js \
    src/verify-tests.js \
    src/99-tail.html > verify.html

echo "built elevator.html + index.html ($(wc -c < elevator.html) bytes)"
echo "built verify.html ($(wc -c < verify.html) bytes)"
