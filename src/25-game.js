// ===== ゲームの純粋ロジック（目的階・スコア・ランク。three.js 非依存で verify からも使う） =====
function floorSpeech(i) { const n = FLOOR_NUMS[i]; return n < 0 ? '地下' + (-n) + '階' : n + '階'; }   // 台詞用（「3階」「地下1階」）

// 現在階以外の使用可能階からランダムに 1 つ選ぶ（選べる階が無ければ -1）
function pickDest(cur, rng, f) {
  rng = rng || Math.random;
  const r = enabledRange(f), c = [];
  for (let i = r[0]; i <= r[1]; i++) if (i !== cur) c.push(i);
  if (!c.length) return -1;
  return c[Math.min(c.length - 1, Math.floor(rng() * c.length))];
}

// スコア状態。missed / waited は「今の乗客に対してもう減点したか」（同じ客では 1 回だけ）
function newScore(total) { return { score: 0, total: total, served: 0, missed: false, waited: false }; }
function scoreCorrect(S, g) { g = g || CFG.game; S.score += g.correct; S.served++; S.missed = false; S.waited = false; return g.correct; }
function scoreWrong(S, g) { g = g || CFG.game; if (S.missed) return 0; S.missed = true; S.score += g.wrong; return g.wrong; }
function scoreWait(S, g) { g = g || CFG.game; if (S.waited) return 0; S.waited = true; S.score += g.wait; return g.wait; }
function remaining(S) { return S.total - S.served; }
function isFinished(S) { return S.served >= S.total; }

// ランク。満点（全員正解）に対する割合で ranks の上から最初に当てはまるもの
function rankFor(score, total, g) {
  g = g || CFG.game;
  const ratio = Math.max(0, Math.min(1, score / (total * g.correct)));
  for (let k = 0; k < g.ranks.length; k++) if (ratio >= g.ranks[k].min) return g.ranks[k];
  return g.ranks[g.ranks.length - 1];
}
