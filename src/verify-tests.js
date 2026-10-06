// ===== 検証（three.js を使わない純粋ロジック） =====
const $out = document.getElementById('out');
let nOk = 0, nNg = 0;
function check(name, cond, why) {
  const d = document.createElement('div'); d.className = 'r ' + (cond ? 'ok' : 'ng'); d.textContent = name;
  if (!cond) { nNg++; const w = document.createElement('div'); w.className = 'why'; w.textContent = why || ''; d.appendChild(w); } else nOk++;
  $out.appendChild(d);
}
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 階リスト
check('階は 12 個（B2〜10F）', FLOOR_NUMS.length === 12);
check('ラベル順 B2,B1,1F,2F,…,10F', eq(FLOOR_NUMS.map((_, i) => floorLabel(i)), ['B2', 'B1', '1F', '2F', '3F', '4F', '5F', '6F', '7F', '8F', '9F', '10F']), JSON.stringify(FLOOR_NUMS.map((_, i) => floorLabel(i))));
check('0階は存在しない', floorIndexOf(0) === -1);
check('階番号→インデックス：B2=0, B1=1, 1F=2, 10F=11', floorIndexOf(-2) === 0 && floorIndexOf(-1) === 1 && floorIndexOf(1) === 2 && floorIndexOf(10) === 11);
check('存在しない階（11, 100, -3）は -1', floorIndexOf(11) === -1 && floorIndexOf(100) === -1 && floorIndexOf(-3) === -1);
check('ラベル→インデックス往復', FLOOR_NUMS.every((_, i) => floorIndexFromLabel(floorLabel(i)) === i));
check('ラベル解釈："3" "B1" "10F" "x"', floorIndexFromLabel('3') === 4 && floorIndexFromLabel('B1') === 1 && floorIndexFromLabel('10F') === 11 && floorIndexFromLabel('x') === -1);

// 有効範囲
check('既定の有効範囲は 1F〜5F（インデックス 2〜6）', eq(enabledRange(), [2, 6]), JSON.stringify(enabledRange()));
check('1F〜5F は有効', [1, 2, 3, 4, 5].every(n => isEnabled(floorIndexOf(n))));
check('B2・B1・6F・10F は無効', [-2, -1, 6, 10].every(n => !isEnabled(floorIndexOf(n))));
check('範囲外インデックス（-1, 12, NaN, 小数）は無効', !isEnabled(-1) && !isEnabled(12) && !isEnabled(NaN) && !isEnabled(2.5));
check('範囲を広げると反映（B2〜10F で全部有効）', FLOOR_NUMS.every((_, i) => isEnabled(i, { enabledMin: -2, enabledMax: 10 })));
check('開始階 1F は有効', isEnabled(floorIndexOf(CFG.floors.startFloor)));

// 移動経路
check('1F→4F の経路 2F,3F,4F', eq(pathBetween(floorIndexOf(1), floorIndexOf(4)).map(floorLabel), ['2F', '3F', '4F']));
check('4F→1F の経路 3F,2F,1F', eq(pathBetween(floorIndexOf(4), floorIndexOf(1)).map(floorLabel), ['3F', '2F', '1F']));
check('同じ階は空の経路', pathBetween(5, 5).length === 0);
check('隣の階は 1 手', eq(pathBetween(floorIndexOf(2), floorIndexOf(3)), [floorIndexOf(3)]));
check('1F→B1 は 0階を飛ばさず B1 の 1 手', eq(pathBetween(floorIndexOf(1), floorIndexOf(-1)).map(floorLabel), ['B1']));
check('2F→B2 の経路 1F,B1,B2', eq(pathBetween(floorIndexOf(2), floorIndexOf(-2)).map(floorLabel), ['1F', 'B1', 'B2']));
check('経路の長さ = 階差の絶対値（全組）', (() => { for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) if (pathBetween(a, b).length !== Math.abs(a - b)) return false; return true; })());
check('経路の最後は目的階', (() => { for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) if (a !== b && pathBetween(a, b).slice(-1)[0] !== b) return false; return true; })());
check('向き：上=1 下=-1 同=0', moveDir(2, 5) === 1 && moveDir(5, 2) === -1 && moveDir(3, 3) === 0);

// キー
check('数字キー 1〜9 は 1F〜9F', ['1', '2', '3', '4', '5', '6', '7', '8', '9'].every((k, n) => keyToIndex(k) === floorIndexOf(n + 1)));
check('0 キーは 10F', keyToIndex('0') === floorIndexOf(10));
check('数字以外のキーは -1', keyToIndex('a') === -1 && keyToIndex('Enter') === -1 && keyToIndex('12') === -1);

// ボタン配置
check('ボタン順は 10F 始まり B2 終わり（上が高い階）', (() => { const g = gridIndices().map(floorLabel); return g[0] === '10F' && g[11] === 'B2' && g.length === 12; })());
check('ボタン順に重複なし', new Set(gridIndices()).size === 12);


// ---- Phase 2：目的階・スコア・ランク（Phase 3 でオーダー化。ここでは単独客の基本動作） ----
const G2 = CFG.game, PLAN = G2.levelPlan, NG = PLAN.length, fl = n => floorIndexOf(n);
check('目的階：現在階と必ず異なる（全現在階 × 乱数 0〜0.9999 を総当たり）', (() => { for (let c = 0; c < 12; c++) for (let k = 0; k < 100; k++) { const d = pickDest(c, () => k / 100); if (d === c) return false; } return true; })());
check('目的階：使用可能階（1F〜5F）の中だけ', (() => { for (let c = 2; c <= 6; c++) for (let k = 0; k < 100; k++) { const d = pickDest(c, () => k / 100); if (!isEnabled(d)) return false; } return true; })());
check('目的階：乱数 0 と 0.9999 で境界を超えない', (() => { const a = pickDest(fl(1), () => 0), b = pickDest(fl(1), () => 0.9999999); return a === fl(2) && b === fl(5); })());
check('目的階：現在階が範囲外（B1）でも 1F〜5F から選ぶ', isEnabled(pickDest(fl(-1), () => 0.5)));
check('目的階：Math.random で 500 回、現在階 3F に当たらない', (() => { for (let k = 0; k < 500; k++) if (pickDest(fl(3)) === fl(3)) return false; return true; })());
check('目的階：全階が出る（現在 1F から 2F〜5F をすべて引ける）', (() => { const s = new Set(); for (let k = 0; k < 100; k++) s.add(pickDest(fl(1), () => k / 100)); return s.size === 4; })());
check('目的階：選べる階が無ければ -1', pickDest(fl(3), null, { enabledMin: 3, enabledMax: 3 }) === -1);
check('台詞用の階名：3階 / 地下1階', floorSpeech(fl(3)) === '3階' && floorSpeech(fl(-1)) === '地下1階');
check('調整値：正解 +100・間違い -50・待たせる -10', G2.correct === 100 && G2.wrong === -50 && G2.wait === -10);

(function () {
  const S = newScore(8);
  check('スコア：初期 0、残り 8 組', S.score === 0 && remaining(S) === 8 && !isFinished(S));
  check('スコア：正解 +100、残り 7 組', scoreCorrect(S) === 100 && S.score === 100 && remaining(S) === 7);
  check('スコア：間違い -50（1 回目）', scoreWrong(S) === -50 && S.score === 50);
  check('スコア：同じ組の 2 回目の間違いは減点なし（1 組 1 回）', scoreWrong(S) === 0 && S.score === 50);
  check('スコア：待たせる -10（1 回目）', scoreWait(S) === -10 && S.score === 40);
  check('スコア：2 回目の待たせるは減点なし', scoreWait(S) === 0 && S.score === 40);
  check('スコア：進展（変更・経由）があると待たせるがまた有効', (() => { scoreProgress(S); return scoreWait(S) === -10 && S.score === 30; })());
  check('スコア：間違えた組もそのまま正解で +100（継続できる）', scoreCorrect(S) === 100 && S.score === 130 && remaining(S) === 6);
  check('スコア：次の組では間違い・待たせるがまた減点される', scoreWrong(S) === -50 && scoreWait(S) === -10 && S.score === 70);
  const T = newScore(8); for (let k = 0; k < 8; k++) scoreCorrect(T);
  check('スコア：8 組全員正解で 800・終了判定', T.score === 800 && isFinished(T) && remaining(T) === 0);
})();

// ---- Phase 3：進行表・生成・各オーダーの判定 ----
check('進行表：組数 12・レベルは 1〜5 で非減少・Lv1 から始まり Lv5 で終わる', NG === 12 && PLAN[0] === 1 && PLAN[NG - 1] === 5 && PLAN.every((v, k) => v >= 1 && v <= 5 && (k === 0 || v >= PLAN[k - 1])));
check('進行表：Lv1〜5 がすべて登場', [1, 2, 3, 4, 5].every(l => PLAN.indexOf(l) >= 0));
check('進行表：序盤 3 組は Lv1（従来どおり単純）', PLAN.slice(0, 3).every(v => v === 1));
check('使える階：Lv1 は 5F まで、Lv5 は 10F まで、レベルが上がって縮まない', floorsForLv(1).enabledMax === 5 && floorsForLv(5).enabledMax === 10 && [1, 2, 3, 4, 5].every(l => l === 1 || floorsForLv(l).enabledMax >= floorsForLv(l - 1).enabledMax));
check('使える階：全レベルが階リストの範囲内（B 階は Phase 4 まで使わない）', [1, 2, 3, 4, 5].every(l => { const f = floorsForLv(l); return f.enabledMin === 1 && floorIndexOf(f.enabledMax) >= 0 && f.enabledMax <= 10; }));
check('ボーナス表：全オーダー種別に定義があり 0 以上', ['simple', 'change', 'mid', 'multi', 'via', 'viaOpen', 'pass', 'forbid'].every(k => typeof G2.bonus[k] === 'number' && G2.bonus[k] >= 0));
check('ボーナス表：特殊注文（via/viaOpen/pass/forbid/mid/change）は 1 以上、単純と複数は 0', ['change', 'mid', 'via', 'viaOpen', 'pass', 'forbid'].every(k => G2.bonus[k] > 0) && G2.bonus.simple === 0 && G2.bonus.multi === 0);
check('スロット：1〜3 人分の立ち位置があり、重ならない', [1, 2, 3].every(n => G2.slots[n].length === n && new Set(G2.slots[n].map(s => s.join(','))).size === n));
check('デバッグハッシュ："#lv=4" → Lv4・既定の組数', (() => { const d = parseDebug('#lv=4'); return d.lv === 4 && d.n === G2.debugGroups && d.kind === null; })());
check('デバッグハッシュ："#lv=5&n=2&kind=pass"', (() => { const d = parseDebug('#lv=5&n=2&kind=pass'); return d.lv === 5 && d.n === 2 && d.kind === 'pass'; })());
check('デバッグハッシュ：なし・範囲外は null', parseDebug('') === null && parseDebug('#lv=0') === null && parseDebug('#lv=9') === null && parseDebug('#x=1') === null);

(function () {
  const plan = buildPlan(() => 0.5);
  check('進行表の展開：組数・レベルが一致', plan.length === NG && plan.every((e, k) => e.lv === PLAN[k]));
  check('進行表の展開：Lv1=simple / Lv2=change / Lv3=multi / Lv4=mid / Lv5 は特殊 4 種', plan.every(e => ({ 1: e.kind === 'simple', 2: e.kind === 'change', 3: e.kind === 'multi', 4: e.kind === 'mid', 5: G2.lv5Kinds.indexOf(e.kind) >= 0 })[e.lv]));
  check('進行表の展開：Lv3 の乗客数は 2〜3 人、他は 1 人', plan.every(e => e.lv === 3 ? e.n >= 2 && e.n <= 3 : e.n === 1));
  check('進行表の展開：Lv5 の 3 組は別々の種類', new Set(plan.filter(e => e.lv === 5).map(e => e.kind)).size === 3);
  check('進行表の展開：Lv5 の種類は乱数開始位置が違えば全 4 種が出うる', (() => { const s = new Set(); for (let k = 0; k < 4; k++) buildPlan(() => k / 4 + 0.01).filter(e => e.lv === 5).forEach(e => s.add(e.kind)); return s.size === 4; })());
  check('デバッグ進行表：Lv4 を 3 組、すべて mid', (() => { const p = buildPlan(Math.random, G2, { lv: 4, n: 3, kind: null }); return p.length === 3 && p.every(e => e.kind === 'mid' && e.lv === 4); })());
  check('デバッグ進行表：Lv5 kind=forbid 指定', buildPlan(Math.random, G2, { lv: 5, n: 3, kind: 'forbid' }).every(e => e.kind === 'forbid'));
  check('満点：simple×1 = 100、multi 3 人 = 300、pass = 100+ボーナス', planMax([{ kind: 'simple', n: 1 }]) === 100 && planMax([{ kind: 'multi', n: 3 }]) === 300 && planMax([{ kind: 'pass', n: 1 }]) === 100 + G2.bonus.pass);
  check('満点：進行表の合計 = 乗客数×100 + ボーナス', planMax(plan) === plan.reduce((s, e) => s + e.n * 100 + G2.bonus[e.kind], 0));
})();

// 生成：全現在階・乱数で性質を総当たり
const RNGS = []; for (let k = 0; k < 40; k++) RNGS.push(() => (k * 0.0251) % 0.9999);
function eachGen(kind, lv, fn) {
  const f = floorsForLv(lv);
  for (let c = 0; c < 12; c++) for (let q = 0; q < RNGS.length; q++) { const o = genOrder({ kind: kind, lv: lv, n: 3 }, c, RNGS[q], f); if (o && !fn(o, c, f)) return false; }
  return true;
}
check('生成 simple：目的階は現在階以外で使用可能', eachGen('simple', 1, (o, c, f) => o.kind === 'simple' && o.riders.length === 1 && o.riders[0].dest !== c && isEnabled(o.riders[0].dest, f)));
check('生成 change：変更先は最初の目的階と異なり使用可能', eachGen('change', 2, (o, c, f) => o.kind === 'change' && o.changeTo !== o.riders[0].dest && isEnabled(o.changeTo, f) && isEnabled(o.riders[0].dest, f) && o.riders[0].dest !== c));
check('生成 mid：変更先は最初の目的階と異なる・最初の目的階は遠め（1F 発なら 2 階以上離れる）', eachGen('mid', 4, (o, c, f) => o.kind === 'mid' && o.midState === 'pending' && o.midTo !== o.riders[0].dest && isEnabled(o.midTo, f)) && RNGS.every(g => Math.abs(genOrder({ kind: 'mid', lv: 4 }, fl(1), g, floorsForLv(4)).riders[0].dest - fl(1)) >= 2));
check('生成 multi：3 人は互いに異なる階で現在階以外、名前 A,B,C', eachGen('multi', 3, (o, c, f) => o.kind === 'multi' && o.riders.length === 3 && new Set(o.riders.map(r => r.dest)).size === 3 && o.riders.every(r => r.dest !== c && isEnabled(r.dest, f)) && o.riders.map(r => r.name).join('') === 'ABC'));
check('生成 multi：2 人指定なら 2 人', genOrder({ kind: 'multi', lv: 3, n: 2 }, fl(1), () => 0.3, floorsForLv(3)).riders.length === 2);
check('生成 via：経由階は出発階と最終階のあいだ（厳密に内側）', eachGen('via', 5, (o, c) => { if (o.kind !== 'via') return true; const v = o.seq[0], d = o.riders[0].dest; return v > Math.min(c, d) && v < Math.max(c, d); }));
check('生成 pass：通過階は出発階と最終階のあいだ（厳密に内側）', eachGen('pass', 5, (o, c) => { if (o.kind !== 'pass') return true; const v = o.seq[0], d = o.riders[0].dest; return v > Math.min(c, d) && v < Math.max(c, d); }));
check('生成 viaOpen：開ける階は最終階の 1 つ手前（現在階側）で現在階ではない', eachGen('viaOpen', 5, (o, c) => { if (o.kind !== 'viaOpen') return true; const v = o.seq[0], d = o.riders[0].dest; return Math.abs(v - d) === 1 && v !== c && Math.abs(c - v) < Math.abs(c - d); }));
check('生成 forbid：禁止階は現在階でも目的階でもない', eachGen('forbid', 5, (o, c) => o.kind !== 'forbid' || (o.forbid !== c && o.forbid !== o.riders[0].dest && o.forbid >= 0)));
check('生成 forbid：間に階があるときは通過する階を禁止（1F→10F など）', (() => { const o = genOrder({ kind: 'forbid', lv: 5 }, fl(1), () => 0.99, floorsForLv(5)); const d = o.riders[0].dest; return Math.abs(d - fl(1)) < 2 || (o.forbid > Math.min(fl(1), d) && o.forbid < Math.max(fl(1), d)); })());
check('生成：階が足りなければ単純な注文へ戻る（2 階しか無い範囲で via）', (() => { const o = genOrder({ kind: 'via', lv: 5 }, fl(1), () => 0.5, { enabledMin: 1, enabledMax: 2 }); return o.kind === 'simple' && o.fallback === true && o.riders[0].dest === fl(2); })());
check('生成：1 階しか無ければ null', genOrder({ kind: 'simple', lv: 1 }, fl(1), () => 0.5, { enabledMin: 1, enabledMax: 1 }) === null);
check('生成：全種別が使用可能階の外へ出さない', ['simple', 'change', 'mid', 'multi', 'via', 'viaOpen', 'pass', 'forbid'].every(k => eachGen(k, 3, (o, c, f) => o.riders.every(r => isEnabled(r.dest, f)) && o.seq.every(v => isEnabled(v, f)) && (o.forbid < 0 || isEnabled(o.forbid, f)) && (o.changeTo < 0 || isEnabled(o.changeTo, f)) && (o.midTo < 0 || isEnabled(o.midTo, f)))));

// 判定のテスト用に、決まった階でオーダーを組む（f = 階番号）
function mk(kind, riders, ex) { return Object.assign({ kind: kind, lv: 1, riders: riders.map(r => ({ name: r.name || '', dest: fl(r.f), off: false })), seq: [], seqDone: 0, forbid: -1, changeTo: -1, changed: false, midTo: -1, midState: '', violated: false }, ex || {}); }
const sum = r => r.deltas.reduce((s, d) => s + d.v, 0);

(function () {   // simple
  const S = newScore(3), o = mk('simple', [{ f: 3 }]);
  let r = resolveStop(S, o, fl(5));
  check('simple：違う階は -50・降りない・組は続く', r.wrong && r.wrongKind === 'wrong' && sum(r) === -50 && r.off < 0 && !r.done && S.served === 0);
  r = resolveStop(S, o, fl(2));
  check('simple：同じ組の 2 つ目の違う階は減点なし', r.wrong && sum(r) === 0 && S.score === -50);
  r = resolveStop(S, o, fl(3));
  check('simple：目的階で +100・降りる・組終了（ボーナスなし）', r.off === 0 && r.done && sum(r) === 100 && S.score === 50 && S.served === 1 && r.deltas.length === 1);
})();
(function () {   // change（到着後変更）
  const S = newScore(3), o = mk('change', [{ f: 3 }], { changeTo: fl(5) });
  let r = resolveStop(S, o, fl(3));
  check('change：最初の目的階に着くと「変更」。降りない・減点なし・得点なし', r.changed && r.off < 0 && !r.wrong && sum(r) === 0 && S.score === 0 && !r.done);
  check('change：目的階が変更先に変わる', o.riders[0].dest === fl(5));
  r = resolveStop(S, o, fl(3));
  check('change：変更後に元の階へ止まると普通の間違い（-50）', r.wrong && sum(r) === -50);
  r = resolveStop(S, o, fl(5));
  check('change：変更後に着けば降りる +100（ノーミスでないのでボーナスなし）', r.off === 0 && r.done && sum(r) === 100 && S.score === 50);
  const S2 = newScore(3), o2 = mk('change', [{ f: 2 }], { changeTo: fl(4) });
  resolveStop(S2, o2, fl(2)); const r2 = resolveStop(S2, o2, fl(4));
  check('change：ノーミスなら +100 とボーナス', sum(r2) === 100 + G2.bonus.change && r2.deltas.length === 2 && r2.deltas[1].label === 'BONUS' && S2.score === 100 + G2.bonus.change);
  check('change：変更は 1 度だけ（変更後の最終階では降りる）', (() => { const S3 = newScore(1), o3 = mk('change', [{ f: 2 }], { changeTo: fl(4) }); resolveStop(S3, o3, fl(2)); resolveStop(S3, o3, fl(4)); return o3.changed && S3.served === 1; })());
})();
(function () {   // mid（移動中変更）
  const S = newScore(3), o = mk('mid', [{ f: 3 }], { midTo: fl(6), midState: 'pending' });
  check('mid：叫ぶ前は移動中の入力を受け付けない', !moveInputAllowed(o));
  const line = midShout(o);
  check('mid：叫ぶと目的階が差し替わり台詞が出る（「すみません！6階にしてください！」）', line === 'すみません！6階にしてください！' && o.riders[0].dest === fl(6) && o.midState === 'shouted');
  check('mid：叫んだあとは移動中の入力を受け付ける', moveInputAllowed(o));
  check('mid：叫びは 1 度だけ', midShout(o) === null && o.riders[0].dest === fl(6));
  let r = resolveStop(S, o, fl(3));
  check('mid：古い目的階に止まると間違い -50', r.wrong && sum(r) === -50 && r.off < 0);
  r = resolveStop(S, o, fl(6));
  check('mid：新しい目的階で +100（ノーミスでないのでボーナスなし）', r.off === 0 && r.done && sum(r) === 100);
  const S2 = newScore(1), o2 = mk('mid', [{ f: 3 }], { midTo: fl(7), midState: 'pending' }); midShout(o2);
  check('mid：ノーミスなら +100 とボーナス', sum(resolveStop(S2, o2, fl(7))) === 100 + G2.bonus.mid);
  check('mid：他のオーダー種別では叫ばない', midShout(mk('simple', [{ f: 2 }])) === null && midShout(mk('change', [{ f: 2 }], { changeTo: fl(3) })) === null);
})();
(function () {   // multi
  const S = newScore(2), o = mk('multi', [{ name: 'A', f: 3 }, { name: 'B', f: 5 }, { name: 'C', f: 2 }]);
  let r = resolveStop(S, o, fl(5));
  check('multi：B の階で B だけ降りる +100・組は続く', r.off === 1 && !r.done && sum(r) === 100 && o.riders[1].off && !o.riders[0].off && S.served === 0);
  r = resolveStop(S, o, fl(4));
  check('multi：誰の目的階でもない階は -50', r.wrong && sum(r) === -50 && r.off < 0);
  r = resolveStop(S, o, fl(5));
  check('multi：降りた人の階にもう一度止まるのは間違い（同じ組なので減点なし）', r.wrong && sum(r) === 0);
  r = resolveStop(S, o, fl(2));
  check('multi：C が降りる +100', r.off === 2 && !r.done && S.score === 150);
  r = resolveStop(S, o, fl(3));
  check('multi：全員降りたら組終了。1 組として数える', r.off === 0 && r.done && S.served === 1 && remaining(S) === 1);
  check('multi：ボーナスなし（各人 +100 のみ）・3 人ノーミスで +300', (() => { const S2 = newScore(1), o2 = mk('multi', [{ f: 2 }, { f: 3 }, { f: 4 }]); let t = 0; [2, 3, 4].forEach(n => { t += sum(resolveStop(S2, o2, fl(n))); }); return t === 300 && S2.served === 1; })());
  check('multi：降りる順番は自由（逆順でも全員 +100）', (() => { const S2 = newScore(1), o2 = mk('multi', [{ f: 2 }, { f: 3 }]); [3, 2].forEach(n => resolveStop(S2, o2, fl(n))); return S2.score === 200 && S2.served === 1; })());
  check('multi：orderLeft は降りるごとに減る', (() => { const o2 = mk('multi', [{ f: 2 }, { f: 3 }, { f: 4 }]); const a = orderLeft(o2); resolveStop(newScore(1), o2, fl(3)); return a === 3 && orderLeft(o2) === 2; })());
})();
(function () {   // via / viaOpen / pass（順に止まる系）
  ['via', 'viaOpen', 'pass'].forEach(kind => {
    const S = newScore(2), o = mk(kind, [{ f: 8 }], { seq: [fl(4)] });
    let r = resolveStop(S, o, fl(8));
    check(kind + '：経由前に最終階へ着くと間違い（early）・降りない -50', r.wrong && r.wrongKind === 'early' && r.off < 0 && sum(r) === -50 && !r.done);
    r = resolveStop(S, o, fl(4));
    check(kind + '：経由階に止まると進展（得点なし・減点なし・降りない）', r.via && sum(r) === 0 && r.off < 0 && !r.wrong && o.seqDone === 1);
    r = resolveStop(S, o, fl(4));
    check(kind + '：経由が済んだあとに同じ階へまた止まると間違い', r.wrong && r.wrongKind === 'wrong');
    r = resolveStop(S, o, fl(8));
    check(kind + '：経由のあと最終階で +100（先に間違えたのでボーナスなし）', r.off === 0 && r.done && sum(r) === 100 && S.served === 1);
    const S2 = newScore(1), o2 = mk(kind, [{ f: 8 }], { seq: [fl(4)] });
    resolveStop(S2, o2, fl(4)); const r2 = resolveStop(S2, o2, fl(8));
    check(kind + '：経由→最終をノーミスで +100 とボーナス', sum(r2) === 100 + G2.bonus[kind] && S2.served === 1);
  });
  check('pass：移動中の入力を受け付ける（通過するときに止めるため）', moveInputAllowed(mk('pass', [{ f: 8 }], { seq: [fl(4)] })));
  check('via / viaOpen / forbid / simple / change / multi：移動中の入力は受け付けない', ['via', 'viaOpen', 'forbid', 'simple', 'change', 'multi'].every(k => !moveInputAllowed(mk(k, [{ f: 3 }]))));
  check('経由の途中で「待たせた」が再び有効になる（進展があった）', (() => { const S = newScore(1), o = mk('via', [{ f: 8 }], { seq: [fl(4)] }); scoreWait(S); resolveStop(S, o, fl(4)); return scoreWait(S) === -10; })());
  check('経由：最終階の前に別の階で止まるだけは間違い（-50 は 1 回）', (() => { const S = newScore(1), o = mk('via', [{ f: 8 }], { seq: [fl(4)] }); return sum(resolveStop(S, o, fl(6))) === -50 && sum(resolveStop(S, o, fl(7))) === 0; })());
})();
(function () {   // forbid
  const S = newScore(2), o = mk('forbid', [{ f: 8 }], { forbid: fl(5) });
  let r = resolveStop(S, o, fl(5));
  check('forbid：禁止階に止まると -50（forbid）・降りない・違反として記録', r.wrong && r.wrongKind === 'forbid' && sum(r) === -50 && o.violated && r.off < 0);
  r = resolveStop(S, o, fl(8));
  check('forbid：違反後に目的階で +100（ボーナスなし）', r.off === 0 && r.done && sum(r) === 100);
  const S2 = newScore(1), o2 = mk('forbid', [{ f: 8 }], { forbid: fl(5) });
  const r2 = resolveStop(S2, o2, fl(8));
  check('forbid：禁止階を通過するだけ（止まらない）なら +100 とボーナス', sum(r2) === 100 + G2.bonus.forbid && !o2.violated);
  const S3 = newScore(1), o3 = mk('forbid', [{ f: 8 }], { forbid: fl(5) });
  resolveStop(S3, o3, fl(4)); const r3 = resolveStop(S3, o3, fl(8));
  check('forbid：禁止階以外の間違いのあともノーミスでないのでボーナスなし', sum(r3) === 100 && S3.score === 50);
})();

// 台詞
(function () {
  const L = k => orderLines(k).map(l => l.text);
  check('台詞 simple：「3階お願いします」', eq(L(mk('simple', [{ f: 3 }])), ['3階お願いします']));
  check('台詞 change：初めは「3階お願いします」・変更は「……あ、やっぱり5階です」', (() => { const o = mk('change', [{ f: 3 }], { changeTo: fl(5) }); return eq(L(o), ['3階お願いします']) && changeLine(o) === '……あ、やっぱり5階です'; })());
  check('台詞 multi：A/B/C が順に各自の階を言う', eq(orderLines(mk('multi', [{ name: 'A', f: 3 }, { name: 'B', f: 5 }, { name: 'C', f: 2 }])), [{ who: 'A', text: '3階お願いします' }, { who: 'B', text: '5階お願いします' }, { who: 'C', text: '2階お願いします' }]));
  check('台詞 via：「4階で一回止まって、そのあと8階」', eq(L(mk('via', [{ f: 8 }], { seq: [fl(4)] })), ['4階で一回止まって、そのあと8階']));
  check('台詞 pass：「2階を通過するときに止めて」を含む', L(mk('pass', [{ f: 8 }], { seq: [fl(2)] }))[0].indexOf('2階を通過するときに止めて') >= 0);
  check('台詞 forbid：「5階には行かないで」を含む', L(mk('forbid', [{ f: 8 }], { forbid: fl(5) }))[0].indexOf('5階には行かないで') >= 0);
  check('台詞 viaOpen：「10階、でも9階で一度ドアを開けて」', eq(L(mk('viaOpen', [{ f: 10 }], { seq: [fl(9)] })), ['10階、でも9階で一度ドアを開けて']));
  check('間違い時の注文の言い直し：単独は「6階です」／経由前は「先に4階で…」', orderReminder(mk('simple', [{ f: 6 }])) === '6階です' && orderReminder(mk('via', [{ f: 8 }], { seq: [fl(4)] })).indexOf('先に4階') === 0);
})();

// 完走シミュレーション：進行表どおりに最適に止まれば満点 = planMax（ランク S）
(function () {
  function ideal(o) {                                             // 最適な止まり順（階インデックス）
    switch (o.kind) {
      case 'change': return [o.riders[0].dest, o.changeTo];
      case 'mid': midShout(o); return [o.riders[0].dest];
      case 'multi': return o.riders.map(r => r.dest);
      case 'via': case 'viaOpen': case 'pass': return [o.seq[0], o.riders[0].dest];
      default: return [o.riders[0].dest];
    }
  }
  let all = true, bad = '';
  for (let rep = 0; rep < 20; rep++) {
    const plan = buildPlan(() => (rep * 0.137) % 0.9999), S = newScore(plan.length); let cur = fl(1);
    plan.forEach(e => {
      const o = genOrder(e, cur, () => (rep * 0.211 + e.lv * 0.17) % 0.9999, floorsForLv(e.lv));
      ideal(o).forEach(i => { resolveStop(S, o, i); cur = i; });
    });
    if (S.score !== planMax(plan) || !isFinished(S) || rankFor(S.score, planMax(plan)).rank !== 'S') { all = false; bad = 'rep ' + rep + ': ' + S.score + '/' + planMax(plan) + ' served ' + S.served; break; }
  }
  check('完走シミュレーション ×20：最適に止まれば全組終了・満点（planMax）・ランク S', all, bad);
  check('完走シミュレーション：全組で 1 回ずつ間違えるだけなら C ★1', (() => { const S = newScore(NG); for (let k = 0; k < NG; k++) { scoreWrong(S); scoreGroupDone(S); } return rankFor(S.score, planMax(buildPlan(() => 0.5))).stars === 1; })());
})();

// ランク（満点 = planMax を基準にする）
const MAXP = planMax(buildPlan(() => 0.5));
check('ランク：満点は S ★5「完璧なエレベーター係」', (() => { const r = rankFor(MAXP, MAXP); return r.rank === 'S' && r.stars === 5 && r.title === '完璧なエレベーター係'; })());
check('ランク：満点は新スコア体系（ボーナス込み）で 100×乗客数 を超える', MAXP > planMax(buildPlan(() => 0.5).map(e => ({ kind: 'simple', n: e.n }))));
check('ランク：境界（max=1000）950=S / 949=A', rankFor(950, 1000).rank === 'S' && rankFor(949, 1000).rank === 'A');
check('ランク：境界（max=1000）800=A / 799=B', rankFor(800, 1000).rank === 'A' && rankFor(799, 1000).rank === 'B');
check('ランク：境界（max=1000）600=B / 599=C★2', rankFor(600, 1000).rank === 'B' && rankFor(599, 1000).rank === 'C' && rankFor(599, 1000).stars === 2);
check('ランク：境界（max=1000）400=C★2 / 399=C★1「エレベーター向いてない」', rankFor(400, 1000).stars === 2 && rankFor(399, 1000).stars === 1 && rankFor(399, 1000).title === 'エレベーター向いてない');
check('ランク：境界（max=1000）150=向いてない / 149=「なぜこの仕事を選んだ」', rankFor(150, 1000).title === 'エレベーター向いてない' && rankFor(149, 1000).title === 'なぜこの仕事を選んだ');
check('ランク：スコア 0 とマイナスは C ★1「なぜこの仕事を選んだ」', rankFor(0, MAXP).stars === 1 && rankFor(-300, MAXP).title === 'なぜこの仕事を選んだ');
check('ランク：満点超えでも S（上限クランプ）、max=0 でも落ちない', rankFor(99999, MAXP).rank === 'S' && rankFor(10, 0).rank === 'S');
check('ランク：★は 1〜5、ランクは S/A/B/C のみ', G2.ranks.every(r => r.stars >= 1 && r.stars <= 5 && 'SABC'.includes(r.rank)));
check('ランク表：min が降順で最後は 0（どんな点でも当たる）', G2.ranks.every((r, k) => k === 0 || r.min < G2.ranks[k - 1].min) && G2.ranks[G2.ranks.length - 1].min === 0);
check('ランク：スコアが高いほど★は下がらない', (() => { let prev = 0; for (let s = -100; s <= MAXP; s += 10) { const st = rankFor(s, MAXP).stars; if (st < prev) return false; prev = st; } return true; })());
document.getElementById('sum').textContent = nNg === 0 ? `ALL PASS (${nOk})` : `FAIL ${nNg} / PASS ${nOk}`;
document.getElementById('sum').style.color = nNg === 0 ? '#6bd07a' : '#ff6b6b';
