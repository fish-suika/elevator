// ===== ゲームの純粋ロジック（オーダー・スコア・ランク。three.js 非依存で verify からも使う） =====
// 「オーダー」= 1 組の客の注文。kind: simple / change(到着後変更) / mid(移動中変更) / multi(複数乗客) / via(経由) / viaOpen(手前で一度開ける) / pass(通過時に止める) / forbid(行かない階)
// 判定は「止まった階（扉を開けた階）」ごとに resolveStop(S, order, idx) が行い、降りる／変更／経由／減点／ボーナスを返す。
function floorSpeech(i) { const n = FLOOR_NUMS[i]; return n < 0 ? '地下' + (-n) + '階' : n + '階'; }   // 台詞用（「3階」「地下1階」）

// ---- 階の選択 ----
function floorsIn(f) { const r = enabledRange(f), out = []; for (let i = r[0]; i <= r[1]; i++) out.push(i); return out; }
function floorsForLv(lv, g) { g = g || CFG.game; const mx = g.enabledMaxByLv[lv] != null ? g.enabledMaxByLv[lv] : CFG.floors.enabledMax; return { enabledMin: CFG.floors.enabledMin, enabledMax: mx }; }
function pickOne(arr, rng) { rng = rng || Math.random; return arr.length ? arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))] : -1; }
function strictlyBetween(a, b, list) { const lo = Math.min(a, b), hi = Math.max(a, b); return list.filter(i => i > lo && i < hi); }

// 現在階以外の使用可能階からランダムに 1 つ選ぶ（選べる階が無ければ -1）
function pickDest(cur, rng, f) { return pickOne(floorsIn(f).filter(i => i !== cur), rng); }

// ---- 進行表（組ごとのレベルと種類） ----
function parseDebug(hash) {                                         // "#lv=4&n=2&kind=pass" → { lv, n, kind } / 指定なしは null
  const m = /lv=(\d)/.exec(String(hash || '')); if (!m) return null;
  const lv = Number(m[1]); if (lv < 1 || lv > 5) return null;
  const n = /[#&]n=(\d+)/.exec(hash), k = /kind=(\w+)/.exec(hash);
  return { lv: lv, n: n ? Math.max(1, Math.min(30, Number(n[1]))) : CFG.game.debugGroups, kind: k ? k[1] : null };
}
function buildPlan(rng, g, dbg) {                                   // [{ lv, kind, n(乗客数) }]
  rng = rng || Math.random; g = g || CFG.game;
  const lvs = dbg ? new Array(dbg.n).fill(dbg.lv) : g.levelPlan, ks = g.lv5Kinds;
  let k5 = Math.floor(rng() * ks.length);
  return lvs.map(lv => {
    if (lv === 1) return { lv: lv, kind: 'simple', n: 1 };
    if (lv === 2) return { lv: lv, kind: 'change', n: 1 };
    if (lv === 3) return { lv: lv, kind: 'multi', n: pickOne(g.multiCounts, rng) };
    if (lv === 4) return { lv: lv, kind: 'mid', n: 1 };
    const kind = dbg && dbg.kind && ks.indexOf(dbg.kind) >= 0 ? dbg.kind : ks[k5++ % ks.length];
    return { lv: lv, kind: kind, n: 1 };
  });
}
function planMax(plan, g) { g = g || CFG.game; return plan.reduce((s, e) => s + e.n * g.correct + (g.bonus[e.kind] || 0), 0); }

// ---- オーダーの生成（cur = 乗った階のインデックス） ----
function genOrder(entry, cur, rng, f) {
  rng = rng || Math.random;
  const R = floorsIn(f), others = R.filter(i => i !== cur), kind = entry.kind;
  const base = k => ({ kind: k, lv: entry.lv || 1, riders: [], seq: [], seqDone: 0, forbid: -1, changeTo: -1, changed: false, midTo: -1, midState: '', violated: false });
  const rider = (name, d) => ({ name: name, dest: d, off: false });
  const simple = () => { const o = base('simple'); o.riders.push(rider('', pickOne(others, rng))); o.fallback = kind !== 'simple'; return o; };
  if (!others.length) return null;
  let o, d, far;
  switch (kind) {
    case 'change': {
      d = pickOne(others, rng); const m = pickOne(R.filter(i => i !== d), rng);
      if (m < 0) return simple();
      o = base('change'); o.riders.push(rider('', d)); o.changeTo = m; return o;
    }
    case 'mid': {
      far = others.filter(i => Math.abs(i - cur) >= 2); d = pickOne(far.length ? far : others, rng);   // 最初の目的階は遠めに（叫ぶ前に着かないように）
      const c = R.filter(i => i !== d && i !== cur), m = pickOne(c.length ? c : R.filter(i => i !== d), rng);
      if (m < 0) return simple();
      o = base('mid'); o.riders.push(rider('', d)); o.midTo = m; o.midState = 'pending'; return o;
    }
    case 'multi': {
      const n = Math.min(entry.n || 2, others.length); if (n < 2) return simple();
      const pool = others.slice(), names = ['A', 'B', 'C', 'D']; o = base('multi');
      for (let k = 0; k < n; k++) { const j = Math.min(pool.length - 1, Math.floor(rng() * pool.length)); o.riders.push(rider(names[k], pool.splice(j, 1)[0])); }
      return o;
    }
    case 'via': case 'pass': {
      far = others.filter(i => strictlyBetween(cur, i, R).length > 0); if (!far.length) return simple();   // 間に階がある目的階だけ
      d = pickOne(far, rng); const v = pickOne(strictlyBetween(cur, d, R), rng);
      o = base(kind); o.riders.push(rider('', d)); o.seq = [v]; return o;
    }
    case 'viaOpen': {
      far = others.filter(i => Math.abs(i - cur) >= 2 && R.indexOf(i - moveDir(cur, i)) >= 0); if (!far.length) return simple();
      d = pickOne(far, rng); o = base('viaOpen'); o.riders.push(rider('', d)); o.seq = [d - moveDir(cur, d)]; return o;   // 目的階の 1 つ手前
    }
    case 'forbid': {
      d = pickOne(others, rng); const c = R.filter(i => i !== cur && i !== d), bt = strictlyBetween(cur, d, R);
      if (!c.length) return simple();
      o = base('forbid'); o.riders.push(rider('', d)); o.forbid = pickOne(bt.length ? bt : c, rng); return o;
    }
    default: return simple();
  }
}

// ---- 台詞 ----
function orderLines(o) {                                            // 乗ったときの台詞 [{ who: 名前('' なら単独), text }]
  const r0 = o.riders[0], d = r0 ? floorSpeech(r0.dest) : '';
  switch (o.kind) {
    case 'multi': return o.riders.map(r => ({ who: r.name, text: floorSpeech(r.dest) + 'お願いします' }));
    case 'via': return [{ who: '', text: floorSpeech(o.seq[0]) + 'で一回止まって、そのあと' + d }];
    case 'viaOpen': return [{ who: '', text: d + '、でも' + floorSpeech(o.seq[0]) + 'で一度ドアを開けて' }];
    case 'pass': return [{ who: '', text: d + 'お願いします。' + floorSpeech(o.seq[0]) + 'を通過するときに止めて' }];
    case 'forbid': return [{ who: '', text: d + 'お願いします。' + floorSpeech(o.forbid) + 'には行かないで' }];
    default: return [{ who: '', text: d + 'お願いします' }];
  }
}
function changeLine(o) { return '……あ、やっぱり' + floorSpeech(o.changeTo) + 'です'; }
function midLine(o) { return 'すみません！' + floorSpeech(o.midTo) + 'にしてください！'; }
function viaDoneLine(o) { const d = floorSpeech(o.riders[0].dest); return o.kind === 'pass' ? 'あ、ここです。そのまま' + d + 'へ' : 'はい、次は' + d + 'お願いします'; }
function orderReminder(o) {                                         // 間違えたときに添える現在の注文
  const r = o.riders.find(x => !x.off); if (!r) return '';
  const d = floorSpeech(r.dest);
  if (o.seqDone < o.seq.length) return o.kind === 'pass' ? floorSpeech(o.seq[0]) + 'で止めてから' + d + 'です' : '先に' + floorSpeech(o.seq[0]) + 'で止まってから' + d + 'です';
  if (o.kind === 'forbid') return d + 'です（' + floorSpeech(o.forbid) + 'は行かないで）';
  return d + 'です';
}
function moveInputAllowed(o) { return !!o && (o.kind === 'pass' || (o.kind === 'mid' && o.midState === 'shouted')); }   // 移動中でもボタンを受け付けるオーダー
function midShout(o) { if (o.kind !== 'mid' || o.midState !== 'pending') return null; o.midState = 'shouted'; o.riders[0].dest = o.midTo; return midLine(o); }   // 移動中の変更（目的階を差し替えて台詞を返す）
function orderLeft(o) { return o.riders.filter(r => !r.off).length; }

// ---- スコア ----
// missed：この組でもう間違い減点したか（1 組 1 回）／waited：待たせ減点したか（客に進展があるまで 1 回）
function newScore(total) { return { score: 0, total: total, served: 0, missed: false, waited: false }; }
function scoreOff(S, g) { g = g || CFG.game; S.score += g.correct; S.waited = false; return g.correct; }                  // 1 人降りた
function scoreGroupDone(S) { S.served++; S.missed = false; S.waited = false; }                                            // 組が終わった
function scoreCorrect(S, g) { g = g || CFG.game; const v = scoreOff(S, g); scoreGroupDone(S); return v; }                  // 単独客：降りて組も終わる
function scoreWrong(S, g) { g = g || CFG.game; if (S.missed) return 0; S.missed = true; S.score += g.wrong; return g.wrong; }
function scoreWait(S, g) { g = g || CFG.game; if (S.waited) return 0; S.waited = true; S.score += g.wait; return g.wait; }
function scoreProgress(S) { S.waited = false; }                                                                           // 変更・経由など進展があった
function remaining(S) { return S.total - S.served; }                                                                     // 残り組数
function isFinished(S) { return S.served >= S.total; }

// ---- 止まった階の判定 ----
// 戻り値 { off: 降りた乗客の添字(-1=なし), changed, via, wrong, wrongKind('wrong'|'early'|'forbid'), done(組が終わった), deltas:[{ v, label }] }
function resolveStop(S, o, idx, g) {
  g = g || CFG.game;
  const res = { off: -1, changed: false, via: false, wrong: false, wrongKind: '', done: false, deltas: [] };
  const hit = o.riders.findIndex(r => !r.off && r.dest === idx), pending = o.seqDone < o.seq.length;
  const wrong = kind => { res.wrong = true; res.wrongKind = kind; const d = scoreWrong(S, g); if (d) res.deltas.push({ v: d, label: '' }); };
  if (pending && idx === o.seq[o.seqDone]) { o.seqDone++; res.via = true; scoreProgress(S); return res; }
  if (hit >= 0) {
    if (pending) { wrong('early'); return res; }                    // 経由する前に最終階へ着いた
    if (o.changeTo >= 0 && !o.changed) {                            // 到着後の変更：降りない。減点もしない
      o.changed = true; o.riders[hit].dest = o.changeTo; res.changed = true; scoreProgress(S); return res;
    }
    o.riders[hit].off = true; res.off = hit; res.deltas.push({ v: scoreOff(S, g), label: '' });
    if (!orderLeft(o)) {
      res.done = true;
      const b = g.bonus[o.kind] || 0;
      if (b && !S.missed && !o.violated) { S.score += b; res.deltas.push({ v: b, label: 'BONUS' }); }
      scoreGroupDone(S);
    }
    return res;
  }
  if (idx === o.forbid) { o.violated = true; wrong('forbid'); return res; }
  wrong('wrong');
  return res;
}

// ランク。満点（planMax）に対する割合で ranks の上から最初に当てはまるもの
function rankFor(score, max, g) {
  g = g || CFG.game;
  const ratio = Math.max(0, Math.min(1, score / Math.max(1, max)));
  for (let k = 0; k < g.ranks.length; k++) if (ratio >= g.ranks[k].min) return g.ranks[k];
  return g.ranks[g.ranks.length - 1];
}
