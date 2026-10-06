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


// ---- Phase 2：目的階・スコア・ランク ----
const G2 = CFG.game, RN = G2.passengers * G2.correct;
check('目的階：現在階と必ず異なる（全現在階 × 乱数 0〜0.9999 を総当たり）', (() => { for (let c = 0; c < 12; c++) for (let k = 0; k < 100; k++) { const d = pickDest(c, () => k / 100); if (d === c) return false; } return true; })());
check('目的階：使用可能階（1F〜5F）の中だけ', (() => { for (let c = 2; c <= 6; c++) for (let k = 0; k < 100; k++) { const d = pickDest(c, () => k / 100); if (!isEnabled(d)) return false; } return true; })());
check('目的階：乱数 0 と 0.9999 で境界を超えない', (() => { const a = pickDest(floorIndexOf(1), () => 0), b = pickDest(floorIndexOf(1), () => 0.9999999); return a === floorIndexOf(2) && b === floorIndexOf(5); })());
check('目的階：現在階が範囲外（B1）でも 1F〜5F から選ぶ', isEnabled(pickDest(floorIndexOf(-1), () => 0.5)));
check('目的階：Math.random で 500 回、現在階 3F に当たらない', (() => { for (let k = 0; k < 500; k++) if (pickDest(floorIndexOf(3)) === floorIndexOf(3)) return false; return true; })());
check('目的階：全階が出る（現在 1F から 2F〜5F をすべて引ける）', (() => { const s = new Set(); for (let k = 0; k < 100; k++) s.add(pickDest(floorIndexOf(1), () => k / 100)); return s.size === 4; })());
check('目的階：選べる階が無ければ -1', pickDest(floorIndexOf(3), null, { enabledMin: 3, enabledMax: 3 }) === -1);
check('台詞用の階名：3階 / 地下1階', floorSpeech(floorIndexOf(3)) === '3階' && floorSpeech(floorIndexOf(-1)) === '地下1階');
check('調整値：序盤 8 人・正解 +100・間違い -50・待たせる -10', G2.passengers === 8 && G2.correct === 100 && G2.wrong === -50 && G2.wait === -10);

(function () {
  const S = newScore(8);
  check('スコア：初期 0、残り 8 人', S.score === 0 && remaining(S) === 8 && !isFinished(S));
  check('スコア：正解 +100、残り 7 人', scoreCorrect(S) === 100 && S.score === 100 && remaining(S) === 7);
  check('スコア：間違い -50（1 回目）', scoreWrong(S) === -50 && S.score === 50);
  check('スコア：同じ客の 2 回目の間違いは減点なし', scoreWrong(S) === 0 && S.score === 50);
  check('スコア：待たせる -10（1 回目）', scoreWait(S) === -10 && S.score === 40);
  check('スコア：同じ客の 2 回目の待たせるは減点なし', scoreWait(S) === 0 && S.score === 40);
  check('スコア：間違えた客もそのまま正解で +100（継続できる）', scoreCorrect(S) === 100 && S.score === 140 && remaining(S) === 6);
  check('スコア：次の客では間違い・待たせるがまた減点される', scoreWrong(S) === -50 && scoreWait(S) === -10 && S.score === 80);
  const T = newScore(8); for (let k = 0; k < 8; k++) scoreCorrect(T);
  check('スコア：8 人全員正解で 800・終了判定', T.score === RN && isFinished(T) && remaining(T) === 0);
})();

check('ランク：満点は S ★5「完璧なエレベーター係」', (() => { const r = rankFor(RN, 8); return r.rank === 'S' && r.stars === 5 && r.title === '完璧なエレベーター係'; })());
check('ランク：1 回間違い（750）は A ★4', (() => { const r = rankFor(750, 8); return r.rank === 'A' && r.stars === 4; })());
check('ランク：境界 760(0.95)=S / 759=A', rankFor(760, 8).rank === 'S' && rankFor(759, 8).rank === 'A');
check('ランク：境界 640(0.8)=A / 639=B', rankFor(640, 8).rank === 'A' && rankFor(639, 8).rank === 'B');
check('ランク：境界 480(0.6)=B / 479=C★2', rankFor(480, 8).rank === 'B' && rankFor(479, 8).rank === 'C' && rankFor(479, 8).stars === 2);
check('ランク：スコア 0 とマイナスは C ★1「なぜこの仕事を選んだ」', rankFor(0, 8).stars === 1 && rankFor(-300, 8).title === 'なぜこの仕事を選んだ');
check('ランク：満点超えでも S（上限クランプ）', rankFor(99999, 8).rank === 'S');
check('ランク：★は 1〜5、ランクは S/A/B/C のみ', G2.ranks.every(r => r.stars >= 1 && r.stars <= 5 && 'SABC'.includes(r.rank)));
check('ランク表：min が降順で最後は 0（どんな点でも当たる）', G2.ranks.every((r, k) => k === 0 || r.min < G2.ranks[k - 1].min) && G2.ranks[G2.ranks.length - 1].min === 0);
check('ランク：スコアが高いほど★は下がらない', (() => { let prev = 0; for (let s = -100; s <= RN; s += 10) { const st = rankFor(s, 8).stars; if (st < prev) return false; prev = st; } return true; })());
document.getElementById('sum').textContent = nNg === 0 ? `ALL PASS (${nOk})` : `FAIL ${nNg} / PASS ${nOk}`;
document.getElementById('sum').style.color = nNg === 0 ? '#6bd07a' : '#ff6b6b';
