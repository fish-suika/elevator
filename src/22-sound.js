// ===== 音（WebAudio。最初のタップで有効化。無くても成立） =====
const SND = { ctx: null, master: null, rumble: null };
function sndInit() {
  if (SND.ctx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    SND.ctx = new AC(); SND.master = SND.ctx.createGain(); SND.master.gain.value = CFG.audio.master; SND.master.connect(SND.ctx.destination);
  } catch (e) { SND.ctx = null; }
}
function sndResume() { if (SND.ctx && SND.ctx.state === 'suspended') SND.ctx.resume(); }
function sndTone(freq, t0, dur, type, vol) {
  const c = SND.ctx; if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.value = freq;
  const t = c.currentTime + (t0 || 0);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.5, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(SND.master); o.start(t); o.stop(t + dur + 0.05);
}
function sndChime() { sndTone(880, 0, 0.7, 'sine', 0.5); sndTone(660, 0.28, 0.9, 'sine', 0.5); }
function sndClick() { sndTone(1200, 0, 0.06, 'square', 0.12); }
function sndTick() { sndTone(520, 0, 0.05, 'triangle', 0.18); }
function sndDoor() { sndTone(180, 0, 0.5, 'sawtooth', 0.06); }
function sndBad() { sndTone(160, 0, 0.18, 'square', 0.15); }
function sndRumbleStart(dir) {
  const c = SND.ctx; if (!c || SND.rumble) return;
  const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
  o.type = 'sawtooth'; o.frequency.value = 55; f.type = 'lowpass'; f.frequency.value = 220;
  g.gain.value = 0.0001; g.gain.exponentialRampToValueAtTime(0.35, c.currentTime + 0.3);
  o.connect(f); f.connect(g); g.connect(SND.master); o.start();
  SND.rumble = { o, g };
  o.frequency.linearRampToValueAtTime(dir > 0 ? 70 : 42, c.currentTime + 1.5);   // 上昇は少し上ずる／下降は下がる
}
function sndRumbleStop() {
  const c = SND.ctx, r = SND.rumble; if (!c || !r) return; SND.rumble = null;
  r.g.gain.cancelScheduledValues(c.currentTime); r.g.gain.setValueAtTime(Math.max(r.g.gain.value, 0.0001), c.currentTime); r.g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
  r.o.stop(c.currentTime + 0.3);
}
function sndCorrect() { sndTone(784, 0, 0.18, 'triangle', 0.4); sndTone(1175, 0.12, 0.35, 'triangle', 0.4); }          // 正解：上がる 2 音
function sndMiss() { sndTone(300, 0, 0.16, 'sawtooth', 0.18); sndTone(210, 0.14, 0.3, 'sawtooth', 0.18); }              // 間違い：下がる 2 音
function sndFanfare() { [523, 659, 784, 1047].forEach((f, k) => sndTone(f, k * 0.13, 0.4, 'triangle', 0.35)); }         // リザルト
