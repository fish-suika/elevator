// ===== HTML UI =====
const $ = id => document.getElementById(id);
const HUD = { btns: [] };

function hudBuild() {
  const grid = $('grid'); grid.innerHTML = '';
  gridIndices().forEach(i => {
    const b = document.createElement('button');
    b.className = 'fb'; b.textContent = floorLabel(i); b.dataset.i = i;
    if (!isEnabled(i)) b.classList.add('off');
    b.addEventListener('pointerdown', e => { e.preventDefault(); INPUT.onFloor(i); });
    grid.appendChild(b); HUD.btns[i] = b;
  });
  $('openBtn').addEventListener('pointerdown', e => { e.preventDefault(); INPUT.onOpen(); });
  $('closeBtn').addEventListener('pointerdown', e => { e.preventDefault(); INPUT.onClose(); });
}
function hudSetFloor(i) {
  $('curN').textContent = floorLabel(i);
  HUD.btns.forEach((b, k) => b.classList.toggle('here', k === i));
}
function hudArrow(dir) { const a = $('arrow'); a.textContent = dir > 0 ? '▲' : dir < 0 ? '▼' : ''; a.classList.toggle('on', dir !== 0); }
function hudLit(i, on) { if (HUD.btns[i]) HUD.btns[i].classList.toggle('lit', on); }
function hudFlash(a) { $('flash').style.opacity = a; }
let msgTimer = 0;
function hudMsg(text) { const m = $('msg'); m.textContent = text; m.classList.add('on'); clearTimeout(msgTimer); msgTimer = setTimeout(() => m.classList.remove('on'), 1400); }

// ---- Phase 2：スコア・台詞・リザルト ----
function hudScore(S) { $('scoreN').textContent = S.score; $('leftN').textContent = remaining(S); }
function hudSpeech(text) { const s = $('speech'); if (!text) { s.classList.remove('on'); return; } s.textContent = text; s.classList.add('on'); }
function hudPop(delta) {                                           // 加点・減点を小さく浮かせる
  const p = document.createElement('div');
  p.className = 'pop ' + (delta > 0 ? 'plus' : 'minus'); p.textContent = (delta > 0 ? '+' : '') + delta;
  p.style.animationDuration = CFG.game.popSec + 's';
  $('pops').appendChild(p); setTimeout(() => p.remove(), CFG.game.popSec * 1000 + 100);
}
function hudResult(info) {                                         // info = { score, rank, stars, title } か null（閉じる）
  const r = $('result');
  if (!info) { r.classList.remove('on'); return; }
  $('resScore').textContent = info.score;
  $('resStars').textContent = '★'.repeat(info.stars) + '☆'.repeat(5 - info.stars);
  $('resRank').textContent = info.rank; $('resTitle').textContent = info.title;
  r.classList.add('on');
}
