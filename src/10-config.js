// ===== 調整値（ここに集約） =====
const CFG = {
  floors: { enabledMin: 1, enabledMax: 5, startFloor: 1 },        // 使える階の範囲（階番号。B2=-2, B1=-1, 1F=1 …）。Phase 3 以降で広げる
  move: { stepSec: 0.85, doorSec: 1.1, startDelay: 0.3, arriveWait: 0.6, chimeFlash: 0.35 },   // 1階あたりの秒数／扉の開閉秒／閉じてから動くまで／到着してから開くまで
  shake: { amp: 0.014, freq: 41 },                                 // 移動中の画面振動
  car: { w: 2.8, h: 2.9, zBack: -1.5, zFront: 2.6, doorW: 1.4, doorH: 2.2 },
  cam: { x: 0.3, y: 1.45, z: 2.2, lookX: 0, lookY: 1.3, lookZ: -1.5, hfov: 62 },   // 固定カメラ（hfov は横方向の画角。縦横比が変わっても横幅は同じ）
  person: { x: -0.35, z: -0.1, scale: 1 },
  audio: { master: 0.22 },
  game: {
    passengers: 8,                                                 // 1 プレイの乗客数
    correct: 100, wrong: -50, wait: -10,                           // 正解／間違い到着（同じ客では 1 回だけ）／待たせた（同じ客では 1 回だけ）
    waitSec: 10,                                                   // 台詞のあと何秒操作しないと「待たせた」になるか
    boardSec: 1.1, thanksSec: 0.9, exitSec: 1.2, doorZ: -2.1,      // 乗る・「ありがとう」の間・降りる秒数／扉の向こう側の z（出入りの起点）
    resultDelay: 0.8, popSec: 1.1,                                 // 最後の客が降りてからリザルトまで／+100 などの浮き文字の秒数
    ranks: [                                                       // 満点に対する割合 min 以上で上から判定
      { min: 0.95, rank: 'S', stars: 5, title: '完璧なエレベーター係' },
      { min: 0.80, rank: 'A', stars: 4, title: '普通のエレベーター係' },
      { min: 0.60, rank: 'B', stars: 3, title: 'ボタン押し職人' },
      { min: 0.40, rank: 'C', stars: 2, title: '客に振り回された人' },
      { min: 0.15, rank: 'C', stars: 1, title: 'エレベーター向いてない' },
      { min: 0,    rank: 'C', stars: 1, title: 'なぜこの仕事を選んだ' }
    ]
  }
};
