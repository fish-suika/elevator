// ===== 階リストと移動の純粋ロジック（three.js 非依存） =====
const FLOOR_NUMS = [-2, -1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];       // インデックス 0..11 = B2 B1 1F … 10F（0階は無い）
function floorLabel(i) { const n = FLOOR_NUMS[i]; return n < 0 ? 'B' + (-n) : n + 'F'; }
function floorIndexOf(n) { return FLOOR_NUMS.indexOf(n); }          // 階番号 → インデックス（無ければ -1）
function floorIndexFromLabel(s) {                                   // "3F" / "B1" → インデックス
  const m = /^(B)?(\d+)F?$/i.exec(String(s).trim());
  if (!m) return -1;
  return floorIndexOf(m[1] ? -Number(m[2]) : Number(m[2]));
}
function enabledRange(f) { f = f || CFG.floors; return [floorIndexOf(f.enabledMin), floorIndexOf(f.enabledMax)]; }
function isEnabled(i, f) { const r = enabledRange(f); return Number.isInteger(i) && i >= 0 && i < FLOOR_NUMS.length && i >= r[0] && i <= r[1]; }
function moveDir(from, to) { return to > from ? 1 : to < from ? -1 : 0; }
function pathBetween(from, to) {                                    // from の次の階から to までの階インデックス列（同じ階なら空）
  const d = moveDir(from, to), out = [];
  if (d === 0) return out;
  for (let i = from + d; d > 0 ? i <= to : i >= to; i += d) out.push(i);
  return out;
}
function keyToIndex(k) {                                            // 数字キー 1..9 = 1F..9F、0 = 10F
  if (!/^[0-9]$/.test(k)) return -1;
  return floorIndexOf(k === '0' ? 10 : Number(k));
}
function gridIndices() { return FLOOR_NUMS.map((_, i) => FLOOR_NUMS.length - 1 - i); }   // ボタン表示順（3列×4段、上が高い階）
