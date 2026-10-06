// ===== 調整値（ここに集約） =====
const CFG = {
  floors: { enabledMin: 1, enabledMax: 5, startFloor: 1 },        // 使える階の範囲（階番号。B2=-2, B1=-1, 1F=1 …）。Phase 3 以降で広げる
  move: { stepSec: 0.85, doorSec: 1.1, startDelay: 0.3, arriveWait: 0.6, chimeFlash: 0.35 },   // 1階あたりの秒数／扉の開閉秒／閉じてから動くまで／到着してから開くまで
  shake: { amp: 0.014, freq: 41 },                                 // 移動中の画面振動
  car: { w: 2.8, h: 2.9, zBack: -1.5, zFront: 2.6, doorW: 1.4, doorH: 2.2 },
  cam: { x: 0.3, y: 1.45, z: 2.2, lookX: 0, lookY: 1.3, lookZ: -1.5, hfov: 62 },   // 固定カメラ（hfov は横方向の画角。縦横比が変わっても横幅は同じ）
  person: { x: -0.35, z: -0.1, scale: 1 },
  audio: { master: 0.22 }
};
