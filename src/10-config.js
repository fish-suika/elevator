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
    levelPlan: [1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 6, 6],   // 組ごとのレベル（長さ = 1 プレイの客の組数）。序盤は単純、徐々に混ざる。Lv6 = バカゲー注文（終わったらエンディング）
    enabledMaxByLv: { 1: 5, 2: 5, 3: 7, 4: 7, 5: 10, 6: 10 },        // レベルごとに使える最上階（階番号）。組が始まるたびに CFG.floors.enabledMax へ反映
    enabledMinByLv: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: -2 },        // レベルごとに使える最下階（Lv6 で地下 B2 まで解放）
    lv5Kinds: ['via', 'pass', 'forbid', 'viaOpen'],                 // Lv5 の特殊注文の種類（組ごとに順繰りで混ぜる）
    lv6Kinds: ['basement', 'up', 'usual', 'swap', 'ghost'],         // Lv6 のバカゲー注文（この順に 1 組ずつ。#lv=6&kind=ghost で固定）
    ghostFloors: [13, 44, 99, 20],                                  // 「存在しない階」の候補（100 階はエンディング専用）
    swapMemoAuto: false,                                            // swap：行き先が変わったとき、HUD のメモも自動で直すか（false = 台詞を聞いて自分で直す）
    showRegularMemo: true,                                         // usual：降りた客の「見た目→最後に降りた階」を HUD に残すか（Lv6 の間だけ表示）
    regularPool: 5,                                                 // usual：直近に降りた客のうち何人までを「常連」の候補にするか（見た目 5 種ぶん＝全員）
    multiCounts: [2, 3],                                            // Lv3 の同時乗客数の候補
    correct: 100, wrong: -50, wait: -10,                           // 降りた（正解）／間違い停止（同じ組では 1 回だけ）／待たせた（進展のあとは 1 回だけ）
    bonus: { change: 20, mid: 30, via: 30, viaOpen: 30, pass: 40, forbid: 30, multi: 0, simple: 0,
              basement: 20, up: 20, usual: 40, swap: 30, ghost: 50 },   // 無茶な注文をノーミスで処理したときのボーナス（種類別）
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
    ranks: [                                                      // 満点（全員正解＋ボーナス）に対する割合 min 以上で上から判定
      { min: 0.95, rank: 'S', stars: 5, title: '完璧なエレベーター係' },
      { min: 0.80, rank: 'A', stars: 4, title: '普通のエレベーター係' },
      { min: 0.60, rank: 'B', stars: 3, title: 'ボタン押し職人' },
      { min: 0.40, rank: 'C', stars: 2, title: '客に振り回された人' },
      { min: 0.15, rank: 'C', stars: 1, title: 'エレベーター向いてない' },
      { min: 0,    rank: 'C', stars: 1, title: 'なぜこの仕事を選んだ' }
    ]
  }
};

// ===== エンディング（最後の客「100階お願いします」→ 存在しない階へ上がり続ける → 謎の階） =====
CFG.ending = {
  style: { skin: 0xeadcc8, hair: 0xd8d8dc, shirt: 0x23253a, pants: 0x14151f },   // 最後の客の見た目（暗いスーツ・白髪）
  askLines: ['100階お願いします', '……あれ、100階のボタン、無いですね', 'どれか押してもらえれば、たぶん着きます'],   // 乗ってからの台詞（順に）
  pressLine: 'お願いします',
  maxNum: 60,                          // 表示が 11F, 12F, … と上がる最大の階数（その次が謎の階）
  mul: 0.84, minSec: 0.06,             // 1 階ごとの間隔 = move.stepSec × mul^k（minSec まで縮む＝加速）
  dimTo: 0.6,                          // 画面の暗さ（黒の不透明度の最大。上昇の終わりごろ）
  shakeMul: 4,                         // 振動の最大倍率（move 中の shake.amp に対して）
  rumbleHz: 150,                       // 上昇音の最終の高さ
  says: [{ k: 4, text: '……あれ、まだ着かないんですか？' }, { k: 18, text: 'なんだか、速くないですか…？' }],   // 上昇中に出す台詞（k = 何階分上がったか）
  arriveLabel: '？F',                  // 謎の階の表示
  arriveLine: '……ここ、どこですか？',
  exitLine: 'ありがとうございました……？',
  standSec: 1.6, voidSec: 1.4, bannerSec: 2.6,   // 扉が開いてから降りるまで／降りたあと何もない間／「本日の勤務終了」を出している秒
  banner: '本日の勤務終了', resultHead: '本日の評価'
};
