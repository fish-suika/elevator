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
function hudEnabled() { HUD.btns.forEach((b, i) => b.classList.toggle('off', !isEnabled(i))); }   // 使える階が広がったらボタンを有効に
function hudMemo(items) {                                          // 複数乗客のメモ [{ name, text, color, done }]。items が空 / CFG.game.showMemo=false なら隠す
  const m = $('memo'); m.innerHTML = '';
  if (!items || !items.length || !CFG.game.showMemo) { m.classList.remove('on'); return; }
  items.forEach(it => {
    const d = document.createElement('div'); d.className = 'm' + (it.done ? ' done' : '');
    const dot = document.createElement('i'); dot.style.background = it.color; d.appendChild(dot);
    d.appendChild(document.createTextNode(it.name + ':' + it.text)); m.appendChild(d);
  });
  m.classList.add('on');
}
function hudPop(delta, label) {                                    // 加点・減点を小さく浮かせる（label があれば「BONUS +30」）
  const p = document.createElement('div');
  p.className = 'pop ' + (delta > 0 ? 'plus' : 'minus'); p.textContent = (label ? label + ' ' : '') + (delta > 0 ? '+' : '') + delta;
  p.style.animationDuration = CFG.game.popSec + 's';
  $('pops').appendChild(p); setTimeout(() => p.remove(), CFG.game.popSec * 1000 + 100);
}
// ---- Phase 4：エンディング ----
function hudLabel(text) { $('curN').textContent = text; HUD.btns.forEach(b => b.classList.remove('here')); }   // 実在しない階の表示（ボタンの「今ここ」は消す）
function hudDim(a) { $('dim').style.opacity = a; }
function hudBanner(text) { const b = $('endBanner'); if (!text) { b.classList.remove('on'); return; } b.textContent = text; b.classList.add('on'); }
function hudRegMemo(items) {                                       // 常連メモ（見た目＝シャツ色ごとに最後に降りた階）[{ color, name, text }]。空なら隠す
  const m = $('regMemo'); m.innerHTML = '';
  if (!items || !items.length) { m.classList.remove('on'); return; }
  const h = document.createElement('small'); h.textContent = '常連メモ'; m.appendChild(h);
  items.forEach(it => {
    const d = document.createElement('div'); d.className = 'm'; const dot = document.createElement('i'); dot.style.background = it.color; d.appendChild(dot);
    d.appendChild(document.createTextNode(it.name + ':' + it.text)); m.appendChild(d);
  });
  m.classList.add('on');
}
let resTimer = 0;
function hudResult(info) {                                         // info = { score, rank, stars, title, heading } か null（閉じる）。星が順に出る→ランクがドンと出る→称号→もう一度
  const r = $('result'), A = CFG.game.resultAnim;
  clearInterval(resTimer);
  if (!info) { r.classList.remove('on'); return; }
  $('resHead').textContent = info.heading || '本日の勤務終了';
  const st = $('resStars'); st.innerHTML = '';
  for (let k = 0; k < 5; k++) {
    const s = document.createElement('span'); s.textContent = k < info.stars ? '★' : '☆';
    if (k < info.stars) { s.className = 'lit'; s.style.setProperty('--d', (A.firstSec + k * A.starSec) + 's'); } else { s.style.opacity = .35; s.style.transform = 'none'; }
    st.appendChild(s);
  }
  const t0 = A.firstSec + info.stars * A.starSec;                  // 星が出そろう時刻
  const rk = $('resRank'), tt = $('resTitle'), rt = $('retry'), sr = $('resScoreRow');
  [[rk, 'rise', t0 + A.rankDelay], [tt, 'fade', t0 + A.rankDelay + A.titleDelay], [sr, 'fade', 0.2], [rt, 'fade', t0 + A.rankDelay + A.titleDelay + 0.3]].forEach(a => { a[0].classList.remove('rise', 'fade'); void a[0].offsetWidth; a[0].style.setProperty('--d', a[2] + 's'); a[0].classList.add(a[1]); });
  rk.textContent = info.rank; tt.textContent = info.title;
  const sc = $('resScore'), t1 = performance.now(); sc.textContent = 0;                       // スコアは 0 から数え上げる
  resTimer = setInterval(() => { const p = Math.min(1, (performance.now() - t1) / (A.countSec * 1000)); sc.textContent = Math.round(info.score * p); if (p >= 1) clearInterval(resTimer); }, 40);
  r.classList.add('on');
}
