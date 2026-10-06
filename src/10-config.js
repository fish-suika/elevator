// ===== 調整値（ここに集約） =====
const CFG = {
  floors: { enabledMin: 1, enabledMax: 5, startFloor: 1 },        // 使える階の範囲（階番号。B2=-2, B1=-1, 1F=1 …）。遊んでいる間は組ごとに enabledMax が game.enabledMaxByLv で広がる
  move: { stepSec: 0.85, doorSec: 1.1, startDelay: 0.3, arriveWait: 0.6, chimeFlash: 0.35 },   // 1階あたりの秒数／扉の開閉秒／閉じてから動くまで／到着してから開くまで
  shake: { amp: 0.014, freq: 41 },                                 // 移動中の画面振動
  car: { w: 2.8, h: 2.9, zBack: -1.5, zFront: 2.6, doorW: 1.4, doorH: 2.2 },
  cam: { x: 0.3, y: 1.45, z: 2.2, lookX: 0, lookY: 1.3, lookZ: -1.5, hfov: 62 },   // 固定カメラ（hfov は横方向の画角。縦横比が変わっても横幅は同じ）
  person: { x: -0.35, z: -0.1, scale: 1 },
  audio: { master: 0.22 },
  game: {
    levelPlan: [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5],                // 組ごとのレベル（長さ = 1 プレイの客の組数）。序盤は単純、徐々に混ざる
    enabledMaxByLv: { 1: 5, 2: 5, 3: 7, 4: 7, 5: 10 },              // レベルごとに使える最上階（階番号）。組が始まるたびに CFG.floors.enabledMax へ反映
    lv5Kinds: ['via', 'pass', 'forbid', 'viaOpen'],                 // Lv5 の特殊注文の種類（組ごとに順繰りで混ぜる）
    multiCounts: [2, 3],                                            // Lv3 の同時乗客数の候補
    correct: 100, wrong: -50, wait: -10,                           // 降りた（正解）／間違い停止（同じ組では 1 回だけ）／待たせた（進展のあとは 1 回だけ）
    bonus: { change: 20, mid: 30, via: 30, viaOpen: 30, pass: 40, forbid: 30, multi: 0, simple: 0 },   // 無茶な注文をノーミスで処理したときのボーナス（種類別）
    waitSec: 10,                                                   // 台詞のあと何秒操作しないと「待たせた」になるか
    boardSec: 1.1, boardStagger: 0.35, thanksSec: 0.9, exitSec: 1.2, doorZ: -2.1, doorX: 0,   // 乗る・乗客ごとの遅れ・「ありがとう」の間・降りる秒数／扉の向こう側の位置（出入りの起点）
    sayGap: 1.5,                                                   // 複数乗客が順に台詞を言う間隔（秒）
    midShoutSec: 0.2,                                              // Lv4：動き出してから「6階にしてください！」と叫ぶまでの秒
    debugGroups: 4,                                                // URL ハッシュ #lv=4 でレベルを固定したときの組数（#lv=4&n=2 で変更）
    slots: {                                                       // 乗客の立ち位置 [x, z]（人数別）
      1: [[-0.35, -0.1]],
      2: [[-0.6, -0.15], [0.15, -0.15]],
      3: [[-0.8, -0.2], [-0.15, -0.1], [0.5, -0.2]]
    },
    showMemo: true,                                                // 複数乗客の目的階メモ（A:3 B:5）を HUD に出すか。Phase 4 以降で隠す用
    resultDelay: 0.8, popSec: 1.1,                                 // 最後の客が降りてからリザルトまで／+100 などの浮き文字の秒数
    ranks: [                                                       // 満点（全員正解＋ボーナス）に対する割合 min 以上で上から判定
      { min: 0.95, rank: 'S', stars: 5, title: '完璧なエレベーター係' },
      { min: 0.80, rank: 'A', stars: 4, title: '普通のエレベーター係' },
      { min: 0.60, rank: 'B', stars: 3, title: 'ボタン押し職人' },
      { min: 0.40, rank: 'C', stars: 2, title: '客に振り回された人' },
      { min: 0.15, rank: 'C', stars: 1, title: 'エレベーター向いてない' },
      { min: 0,    rank: 'C', stars: 1, title: 'なぜこの仕事を選んだ' }
    ]
  }
};
