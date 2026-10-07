// ===== ゲームの純粋ロジック（オーダー・スコア・ランク。three.js 非依存で verify からも使う） =====
// 「オーダー」= 1 組の客の注文。kind: simple / change(到着後変更) / mid(移動中変更) / multi(複数乗客) / via(経由) / viaOpen(手前で一度開ける) / pass(通過時に止める) / forbid(行かない階) / basement(地下) / up(上に行きたい) / usual(いつもの) / swap(目的階の交換) / ghost(存在しない階)
// 判定は「止まった階（扉を開けた階）」ごとに resolveStop(S, order, idx) が行い、降りる／変更／経由／減点／ボーナスを返す。
function floorSpeech(i) { const n = FLOOR_NUMS[i]; return n < 0 ? '地下' + (-n) + '階' : n + '階'; }   // 台詞用（「3階」「地下1階」）

// ---- 階の選択 ----
function floorsIn(f) { const r = enabledRange(f), out = []; for (let i = r[0]; i <= r[1]; i++) out.push(i); return out; }
function floorsForLv(lv, g) {
  g = g || CFG.game;
  const mx = g.enabledMaxByLv[lv] != null ? g.enabledMaxByLv[lv] : 10, mn = g.enabledMinByLv && g.enabledMinByLv[lv] != null ? g.enabledMinByLv[lv] : 1;
  return { enabledMin: mn, enabledMax: mx };
}
function pickOne(arr, rng) { rng = rng || Math.random; return arr.length ? arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))] : -1; }
function strictlyBetween(a, b, list) { const lo = Math.min(a, b), hi = Math.max(a, b); return list.filter(i => i > lo && i < hi); }

// 現在階以外の使用可能階からランダムに 1 つ選ぶ（選べる階が無ければ -1）
function pickDest(cur, rng, f) { return pickOne(floorsIn(f).filter(i => i !== cur), rng); }

// ---- 進行表（組ごとのレベルと種類） ----
function parseDebug(hash) {                                         // "#lv=4&n=2&kind=pass" → { lv, n, kind, end } / "#ending" → エンディングだけ / 指定なしは null
  hash = String(hash || '');
  if (/ending/.test(hash)) return { lv: 6, n: 0, kind: null, end: true, ending: true };
  const m = /lv=(\d)/.exec(hash); if (!m) return null;
  const lv = Number(m[1]); if (lv < 1 || lv > 6) return null;
  const n = /[#&]n=(\d+)/.exec(hash), k = /kind=(\w+)/.exec(hash);
  return { lv: lv, n: n ? Math.max(1, Math.min(30, Number(n[1]))) : CFG.game.debugGroups, kind: k ? k[1] : null, end: /[#&]end(&|$)/.test(hash), ending: false };   // end = デバッグ進行のあともエンディングを入れる
}
function buildPlan(rng, g, dbg) {                                   // [{ lv, kind, n(乗客数) }]
  rng = rng || Math.random; g = g || CFG.game;
  const lvs = dbg ? new Array(dbg.n).fill(dbg.lv) : g.levelPlan, ks = g.lv5Kinds, k6s = g.lv6Kinds;
  let k5 = Math.floor(rng() * ks.length), k6 = 0;
  return lvs.map(lv => {
    if (lv === 1) return { lv: lv, kind: 'simple', n: 1 };
    if (lv === 2) return { lv: lv, kind: 'change', n: 1 };
    if (lv === 3) return { lv: lv, kind: 'multi', n: pickOne(g.multiCounts, rng) };
    if (lv === 4) return { lv: lv, kind: 'mid', n: 1 };
    if (lv === 6) { const kind = dbg && dbg.kind && k6s.indexOf(dbg.kind) >= 0 ? dbg.kind : k6s[k6++ % k6s.length]; return { lv: lv, kind: kind, n: kind === 'swap' ? 3 : 1 }; }
    const kind = dbg && dbg.kind && ks.indexOf(dbg.kind) >= 0 ? dbg.kind : ks[k5++ % ks.length];
    return { lv: lv, kind: kind, n: 1 };
  });
}
function endingLabels(startIdx, maxNum) {                           // エンディングの上昇で順に出す階表示：現在階 → 10F までは実在の階 → 11F, 12F, … maxNum（最後に謎の階は別に出す）
  const out = [floorLabel(startIdx)];
  for (let i = startIdx + 1; i < FLOOR_NUMS.length; i++) out.push(floorLabel(i));
  for (let n = FLOOR_NUMS[FLOOR_NUMS.length - 1] + 1; n <= maxNum; n++) out.push(n + 'F');
  return out;
}
function endingStepSec(k, E) { E = E || CFG.ending; return Math.max(E.minSec, CFG.move.stepSec * Math.pow(E.mul, k)); }   // k 階目までの間隔（だんだん短くなる）
function planMax(plan, g) { g = g || CFG.game; return plan.reduce((s, e) => s + e.n * g.correct + (g.bonus[e.kind] || 0), 0); }

// ---- オーダーの生成（cur = 乗った階のインデックス） ----
function genOrder(entry, cur, rng, f, regulars) {   // regulars = [{ style, floor }]（直近に降りた客。usual 用・新しいほど後ろ）
  rng = rng || Math.random;
  const R = floorsIn(f), others = R.filter(i => i !== cur), kind = entry.kind;
  const base = k => ({ kind: k, lv: entry.lv || 1, riders: [], seq: [], seqDone: 0, forbid: -1, changeTo: -1, changed: false, midTo: -1, midState: '', violated: false, rule: '', from: cur, top: -1, ghost: 0, atTop: false, swapped: false, usualKnown: false });
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
    case 'basement': {                                              // 地下 B2/B1 への注文（ボタンは一番下にある）
      const bs = others.filter(i => FLOOR_NUMS[i] < 0); if (!bs.length) return simple();
      o = base('basement'); o.riders.push(rider('', pickOne(bs, rng))); return o;
    }
    case 'up': {                                                    // 「上に行きたいです」（最上階にいるときだけ「下」）：その向きならどの階で降りてもよい
      const top = R[R.length - 1], down = cur >= top && cur > R[0];
      o = base('up'); o.rule = down ? 'below' : 'above'; o.riders.push(rider('', -1)); return o;
    }
    case 'usual': {                                                 // 「いつものところで」：直近に降りた客と同じ見た目の客が、その客が降りた階を言う。覚えがなければ初見（どこでも可）
      const cand = (regulars || []).filter(x => x.floor !== cur && R.indexOf(x.floor) >= 0).slice(-CFG.game.regularPool);
      o = base('usual');
      if (cand.length) { const c = pickOne(cand, rng), r = rider('', c.floor); r.style = c.style; o.riders.push(r); o.usualKnown = true; }
      else { o.rule = 'any'; o.riders.push(rider('', -1)); }
      return o;
    }
    case 'swap': {                                                  // 3 人が別々の階を言い、1 人目が降りたあとに残る 2 人が行き先を変える（変更は rotateRiders）
      if (others.length < 4) return simple();
      const pool = others.slice(), names = ['A', 'B', 'C']; o = base('swap');
      for (let k = 0; k < 3; k++) { const j = Math.min(pool.length - 1, Math.floor(rng() * pool.length)); o.riders.push(rider(names[k], pool.splice(j, 1)[0])); }
      return o;
    }
    case 'ghost': {                                                 // 存在しない階：現存する最上階で扉を開ければ「無茶な注文を処理」
      const top = R[R.length - 1];
      o = base('ghost'); o.rule = 'ghost'; o.top = top; o.atTop = cur === top; o.ghost = pickOne(CFG.game.ghostFloors, rng); o.riders.push(rider('', -1)); return o;
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
    case 'swap': return o.riders.map(r => ({ who: r.name, text: floorSpeech(r.dest) + 'お願いします' }));
    case 'basement': return [{ who: '', text: d + 'お願いします' }];
    case 'ghost': return [{ who: '', text: o.ghost + '階お願いします' }, { who: '', text: o.atTop ? 'ここが一番上ですよね？ 一番上のボタンを押してください' : '……ボタンに無いですね。一番上までお願いします' }];
    case 'up': return [{ who: '', text: (o.rule === 'below' ? '下' : '上') + 'に行きたいです' }, { who: '', text: '……何階かって？ ' + (o.rule === 'below' ? '下' : '上') + 'です。' + (o.rule === 'below' ? '下' : '上') + '。' }];
    case 'usual': return [{ who: '', text: 'いつものところで' }, { who: '', text: '前にも乗りましたよね？ あそこです' }];
    default: return [{ who: '', text: d + 'お願いします' }];
  }
}
function changeLine(o) { return '……あ、やっぱり' + floorSpeech(o.changeTo) + 'です'; }
function midLine(o) { return 'すみません！' + floorSpeech(o.midTo) + 'にしてください！'; }
function viaDoneLine(o) { const d = floorSpeech(o.riders[0].dest); return o.kind === 'pass' ? 'あ、ここです。そのまま' + d + 'へ' : 'はい、次は' + d + 'お願いします'; }
function orderReminder(o) {                                         // 間違えたときに添える現在の注文
  const r = o.riders.find(x => !x.off); if (!r) return '';
  if (o.rule === 'ghost') return o.ghost + '階ですよ。一番上まで行ってみて';
  if (o.rule === 'above' || o.rule === 'below') return (o.rule === 'above' ? '上' : '下') + 'です、' + (o.rule === 'above' ? '上' : '下') + '！';
  if (o.rule === 'any') return 'いつものところ、です';
  if (o.kind === 'usual') return 'いつもの、前に降りた階です';
  const d = floorSpeech(r.dest);
  if (o.seqDone < o.seq.length) return o.kind === 'pass' ? floorSpeech(o.seq[0]) + 'で止めてから' + d + 'です' : '先に' + floorSpeech(o.seq[0]) + 'で止まってから' + d + 'です';
  if (o.kind === 'forbid') return d + 'です（' + floorSpeech(o.forbid) + 'は行かないで）';
  return d + 'です';
}
function moveInputAllowed(o) { return !!o && (o.kind === 'pass' || (o.kind === 'mid' && o.midState === 'shouted')); }   // 移動中でもボタンを受け付けるオーダー
function midShout(o) { if (o.kind !== 'mid' || o.midState !== 'pending') return null; o.midState = 'shouted'; o.riders[0].dest = o.midTo; return midLine(o); }   // 移動中の変更（目的階を差し替えて台詞を返す）
function isMulti(o) { return !!o && (o.kind === 'multi' || o.kind === 'swap'); }   // 複数乗客（HUD メモを出す）
function offLine(o, r) {                                            // 降りるときの台詞
  const w = r && r.name ? r.name + '：' : '';
  if (o.rule === 'ghost') return w + '……やっぱり' + o.ghost + '階は無いですよね。ここで降ります';
  if (o.rule === 'above' || o.rule === 'below') return w + 'ここでいいです。ありがとうございます';
  if (o.rule === 'any') return w + '……あ、初めてでした。ここでいいです';
  return w + 'ありがとうございます';
}
// swap：3 人のうち 1 人が降りて 2 人が残ったところ（cur = いまいる階）で、残る 2 人が行き先を変える。
// 先に言う方（x）は「もう一人（y）と同じ階」に、y は「まだ誰も行かない別の階」に。止まる階の集合が実際に変わる（{x, y} → {y, 新しい階}）。
// 台詞 [{ who, text }] を返す（まだ・済み・不成立なら null）。HUD のメモは自動では直らない（rider.shown に古い表示を残す）
function rotateRiders(o, cur, rng, f) {
  if (!o || o.kind !== 'swap' || o.swapped || o.riders.length !== 3 || orderLeft(o) !== 2) return null;
  const rest = o.riders.filter(r => !r.off), x = rest[0], y = rest[1];
  const pool = floorsIn(f).filter(i => i !== cur && i !== x.dest && i !== y.dest); if (!pool.length) return null;
  const n = pickOne(pool, rng || Math.random);
  x.shown = x.dest; y.shown = y.dest; o.swapped = true;
  x.dest = y.dest; y.dest = n;
  return [{ who: x.name, text: 'ごめん、行き先変えます。' + y.name + 'さんと同じ' + floorSpeech(x.dest) + 'で' }, { who: y.name, text: 'じゃあ私は' + floorSpeech(y.dest) + 'にします' }];
}
function sameStopJudges(o, idx) { return !!o && o.rule === 'ghost' && idx === o.top && orderLeft(o) > 0; }   // 最上階にいるまま「開く」を押しても判定する（ghost で最上階から乗った場合）
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
  const getOff = k => {                                             // k 番目の乗客が降りる（全員降りたら組終了＋ボーナス）
    o.riders[k].off = true; o.riders[k].offAt = idx; res.off = k; res.deltas.push({ v: scoreOff(S, g), label: '' });
    if (!orderLeft(o)) {
      res.done = true;
      const b = g.bonus[o.kind] || 0;
      if (b && !S.missed && !o.violated) { S.score += b; res.deltas.push({ v: b, label: 'BONUS' }); }
      scoreGroupDone(S);
    }
    return res;
  };
  if (o.rule) {                                                     // 階が決まっていない注文（上／初見の常連／存在しない階）
    const k = o.riders.findIndex(r => !r.off);
    const ok = k >= 0 && (o.rule === 'any' ? idx !== o.from : o.rule === 'above' ? idx > o.from : o.rule === 'below' ? idx < o.from : o.rule === 'ghost' ? idx === o.top : false);
    if (!ok) { wrong('wrong'); return res; }
    return getOff(k);
  }
  if (pending && idx === o.seq[o.seqDone]) { o.seqDone++; res.via = true; scoreProgress(S); return res; }
  if (hit >= 0) {
    if (pending) { wrong('early'); return res; }                    // 経由する前に最終階へ着いた
    if (o.changeTo >= 0 && !o.changed) {                            // 到着後の変更：降りない。減点もしない
      o.changed = true; o.riders[hit].dest = o.changeTo; res.changed = true; scoreProgress(S); return res;
    }
    return getOff(hit);
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

// ---- 常連の記録（usual 用）：見た目（style）ごとに「最後に降りた階」を新しいほど後ろに並べる ----
function noteRegular(list, style, floor) {
  for (let k = list.length - 1; k >= 0; k--) if (list[k].style === style) list.splice(k, 1);
  list.push({ style: style, floor: floor });
}

// ---- 吹き出しの改行（意味の切れ目で折る。「N階」「お願いします」などは分断しない） ----
// 区切り候補: 句読点（、。？！…）の直後（強）／空白／助詞（は が を に で と も へ まで から）の直後／「て」の直後（弱）。両側 3 文字以上。1 行 limit 文字を超えるときだけ折る
const BJ_ATOM = /(?:地下)?\d+階|お願いします|ありがとうございました|ありがとうございます|ありがとう|いいですか|ですか|ですよね|ですよ|ですね|ください|ません|ました|ます|です|一番上|そのあと|やっぱり|とりあえず|いつもの|ところ|あそこ|行き先|目的地|ごめん|すみません|ドア|扉|ボタン|初めて|通過する|[ァ-ヶー]+|[A-Z]：/g;
function bjTokens(s) {
  const out = []; let i = 0; BJ_ATOM.lastIndex = 0;
  while (i < s.length) {
    BJ_ATOM.lastIndex = i; const m = BJ_ATOM.exec(s);
    if (m && m.index === i) { out.push(m[0]); i += m[0].length; } else { out.push(s[i]); i++; }
  }
  return out;
}
function bjScore(prev, next) {                                      // prev の直後で折る良さ（0 = 折れない）
  if (!next || /^[、。？！…ー）」]/.test(next) || /：$/.test(prev)) return 0;
  if (/[、。？！]$/.test(prev) || /…$/.test(prev) && !/^…/.test(next)) return 3;
  if (/^\s+$/.test(prev) || /^\s/.test(next)) return 3;
  if (/^(?:は|が|を|に|で|と|も|へ|まで|から)$/.test(prev) && !/^(?:は|が|を|に|で|と|も|へ|の)/.test(next)) return 2;
  if (prev === 'て' && !/^[、。]/.test(next)) return 1;
  return 0;
}
function breakJa(text, limit) {
  limit = limit || (CFG.game.speech && CFG.game.speech.lineChars) || 13;
  const parts = String(text).split('\n'), out = [];
  parts.forEach(p => { const ls = bjWrap(p.trim(), limit); while (ls.length > 1 && ls[ls.length - 1].replace(/[、。？！…ー ]/g, '').length <= 3) { const l = ls.pop(); ls[ls.length - 1] += l; } out.push(...ls); });   // 末尾が 3 文字以下の行は作らない（前の行に詰める）
  return out.join('\n');
}
function bjWrap(s, limit) {
  if (s.length <= limit) return [s];
  const t = bjTokens(s), total = s.length; let best = -1, bestV = -1e9, left = 0;
  for (let i = 0; i < t.length - 1; i++) {
    left += t[i].length;
    const sc = bjScore(t[i], t[i + 1]), right = total - left;
    if (!sc || left < 3 || right < 4) continue;
    const v = sc * 10 - Math.abs(left - total / 2) - (left > limit ? 20 : 0);
    if (v > bestV) { bestV = v; best = left; }
  }
  if (best < 0) {                                                   // 折れる所が無い：短ければそのまま、長ければ limit で強制（原則ここには来ない）
    if (s.length <= limit + 3) return [s];
    return [s.slice(0, limit)].concat(bjWrap(s.slice(limit), limit));
  }
  return [s.slice(0, best).trim()].concat(bjWrap(s.slice(best).trim(), limit));
}
// 間違えて止まったときの台詞（第 1 回は「えっ、ここ？」、禁止階・複数乗客は専用）
function wrongLine(o, first, kind) {
  if (kind === 'forbid') return 'えっ！' + floorSpeech(o.forbid) + 'には行かないでって言ったのに';
  if (isMulti(o)) return first ? 'えっ、ここじゃないですよ' : 'そこじゃないです…';
  return (first ? 'えっ、ここ？ ' : 'そこじゃないです… ') + orderReminder(o);
}
