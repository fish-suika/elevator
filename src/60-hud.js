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
