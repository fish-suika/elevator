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

document.getElementById('sum').textContent = nNg === 0 ? `ALL PASS (${nOk})` : `FAIL ${nNg} / PASS ${nOk}`;
document.getElementById('sum').style.color = nNg === 0 ? '#6bd07a' : '#ff6b6b';
