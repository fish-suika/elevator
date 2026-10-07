// ===== 入力（コールバック経由。操作の意味づけは 90-boot.js） =====
const INPUT = { onFloor: null, onHere: null, onFirst: null, onRetry: null };
let inputFirst = false;
function inputFirstGesture() { if (!inputFirst) { inputFirst = true; if (INPUT.onFirst) INPUT.onFirst(); } }   // 最初の操作で音を有効化

function bindInput() {
  addEventListener('keydown', e => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    inputFirstGesture();
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (INPUT.onRetry && INPUT.onRetry()) return; INPUT.onHere(); return; }   // Enter / Space＝いまの階のボタン（扉が開く）。リザルト中は「もう一度」
    const i = keyToIndex(e.key);
    if (i >= 0) { INPUT.onFloor(i); return; }
  });
  addEventListener('pointerdown', inputFirstGesture, { passive: true });
  // ダブルタップ拡大・ピンチ・スクロール・長押しメニューを止める
  ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick'].forEach(n => addEventListener(n, e => e.preventDefault()));
  addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  let lastEnd = 0;
  addEventListener('touchend', e => { const n = Date.now(); if (n - lastEnd < 350) e.preventDefault(); lastEnd = n; }, { passive: false });
}
