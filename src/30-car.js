// ===== エレベーター内部（3D）。すべてプリミティブ =====
const CAR = { doorL: null, doorR: null, hall: null, hallMat: null, dispTex: null, dispCtx: null, dispCanvas: null, lamp: null };

function boxMesh(w, h, d, color, x, y, z, opt) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7, metalness: 0.1 }, opt || {})));
  m.position.set(x, y, z); return m;
}

function buildCar(scene) {
  const C = CFG.car, hw = C.w / 2, depth = C.zFront - C.zBack, zc = (C.zFront + C.zBack) / 2;
  scene.background = new THREE.Color(0x07080b);

  // 床・天井・左右の壁
  scene.add(boxMesh(C.w, 0.1, depth, 0x3b3f48, 0, -0.05, zc, { roughness: 0.4, metalness: 0.3 }));
  scene.add(boxMesh(C.w, 0.1, depth, 0xd8d4c8, 0, C.h + 0.05, zc));
  scene.add(boxMesh(0.1, C.h, depth, 0xb9a47e, -hw - 0.05, C.h / 2, zc, { roughness: 0.5, metalness: 0.3 }));
  scene.add(boxMesh(0.1, C.h, depth, 0xb9a47e, hw + 0.05, C.h / 2, zc, { roughness: 0.5, metalness: 0.3 }));
  // 手すり（左右）
  scene.add(boxMesh(0.05, 0.06, depth - 0.3, 0xc9ced6, -hw + 0.07, 0.95, zc, { metalness: 0.8, roughness: 0.3 }));
  scene.add(boxMesh(0.05, 0.06, depth - 0.3, 0xc9ced6, hw - 0.07, 0.95, zc, { metalness: 0.8, roughness: 0.3 }));
  // 床の縁取り
  scene.add(boxMesh(C.w, 0.02, 0.5, 0x2a2d34, 0, 0.011, C.zBack + 0.25));

  // 奥の壁：扉の開口部のまわり（左・右・上）
  const dw = C.doorW, wallZ = C.zBack - 0.05, sideW = (C.w - dw) / 2;
  scene.add(boxMesh(sideW, C.h, 0.1, 0xb9a47e, -(dw / 2 + sideW / 2), C.h / 2, wallZ, { roughness: 0.5, metalness: 0.3 }));
  scene.add(boxMesh(sideW, C.h, 0.1, 0xb9a47e, (dw / 2 + sideW / 2), C.h / 2, wallZ, { roughness: 0.5, metalness: 0.3 }));
  scene.add(boxMesh(dw, C.h - C.doorH, 0.1, 0xb9a47e, 0, C.doorH + (C.h - C.doorH) / 2, wallZ, { roughness: 0.5, metalness: 0.3 }));
  // 扉の枠
  scene.add(boxMesh(0.06, C.doorH, 0.04, 0x8a8f99, -dw / 2 - 0.03, C.doorH / 2, C.zBack + 0.01, { metalness: 0.8, roughness: 0.3 }));
  scene.add(boxMesh(0.06, C.doorH, 0.04, 0x8a8f99, dw / 2 + 0.03, C.doorH / 2, C.zBack + 0.01, { metalness: 0.8, roughness: 0.3 }));
  scene.add(boxMesh(dw + 0.12, 0.06, 0.04, 0x8a8f99, 0, C.doorH + 0.03, C.zBack + 0.01, { metalness: 0.8, roughness: 0.3 }));

  // 扉の向こう（廊下）：色は階ごとに変える
  CAR.hallMat = new THREE.MeshBasicMaterial({ color: 0xd9c9a0 });
  CAR.hall = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.6), CAR.hallMat);
  CAR.hall.position.set(0, 1.5, C.zBack - 1.2); scene.add(CAR.hall);
  scene.add(boxMesh(dw, 0.05, 1.2, 0x555a63, 0, 0, C.zBack - 0.6));   // 敷居〜廊下の床

  // 扉（左右 2 枚。壁の裏へ滑り込む）
  const dwh = dw / 2;
  CAR.doorL = boxMesh(dwh, C.doorH, 0.06, 0xaeb4bd, 0, C.doorH / 2, C.zBack - 0.06, { metalness: 0.85, roughness: 0.3 });
  CAR.doorR = boxMesh(dwh, C.doorH, 0.06, 0xaeb4bd, 0, C.doorH / 2, C.zBack - 0.06, { metalness: 0.85, roughness: 0.3 });
  scene.add(CAR.doorL); scene.add(CAR.doorR);
  carSetDoor(0);

  // 扉上の階数表示（CanvasTexture）
  CAR.dispCanvas = document.createElement('canvas'); CAR.dispCanvas.width = 256; CAR.dispCanvas.height = 128;
  CAR.dispCtx = CAR.dispCanvas.getContext('2d');
  CAR.dispTex = new THREE.CanvasTexture(CAR.dispCanvas);
  const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), new THREE.MeshBasicMaterial({ map: CAR.dispTex }));
  disp.position.set(0, C.doorH + 0.37, C.zBack + 0.012); scene.add(disp);
  scene.add(boxMesh(0.9, 0.5, 0.03, 0x15171c, 0, C.doorH + 0.37, C.zBack + 0.0));
  carSetDisplay('1F', 0);

  // 右の壁のボタンパネル（飾り）
  const px = hw - 0.02, pz = -0.2;
  const panel = boxMesh(0.04, 1.05, 0.34, 0x20242b, px, 1.35, pz, { metalness: 0.6, roughness: 0.4 });
  scene.add(panel);
  const bm = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, emissive: 0x332a10, roughness: 0.4, metalness: 0.5 });
  for (let r = 0; r < 6; r++) for (let c = 0; c < 2; c++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 16), bm);
    b.rotation.z = Math.PI / 2; b.position.set(px - 0.03, 1.72 - r * 0.15, pz - 0.07 + c * 0.14); scene.add(b);
  }

  // 照明
  scene.add(new THREE.AmbientLight(0xfff2da, 0.55));
  const lampPanel = boxMesh(1.4, 0.04, 1.4, 0xfffbe8, 0, C.h - 0.01, 0.4, { emissive: 0xfff0c0, emissiveIntensity: 1.0 });
  scene.add(lampPanel);
  CAR.lamp = new THREE.PointLight(0xfff0d0, 0.9, 9, 1.4); CAR.lamp.position.set(0, C.h - 0.3, 0.4); scene.add(CAR.lamp);
  const fill = new THREE.PointLight(0xffe2b0, 0.35, 8, 1.5); fill.position.set(0.4, 1.8, 2.0); scene.add(fill);
}

// 扉の開き具合 d：0=閉、1=全開
function carSetDoor(d) {
  const C = CFG.car, q = C.doorW / 4, slide = (C.doorW / 2) * d;   // 閉じたとき ±q。開くと壁の裏（|x| が doorW/2 より外）へ
  if (CAR.doorL) { CAR.doorL.position.x = -q - slide; CAR.doorR.position.x = q + slide; }
}

// 階数表示。dir: 1=上, -1=下, 0=なし
function carSetDisplay(label, dir) {
  const g = CAR.dispCtx; if (!g) return;
  g.fillStyle = '#0a0a0c'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#ff9a2a'; g.shadowColor = '#ff7a00'; g.shadowBlur = 14;
  g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, dir ? 150 : 128, 70);
  if (dir) {
    g.beginPath();
    if (dir > 0) { g.moveTo(40, 40); g.lineTo(64, 90); g.lineTo(16, 90); } else { g.moveTo(16, 40); g.lineTo(64, 40); g.lineTo(40, 90); }
    g.closePath(); g.fill();
  }
  g.shadowBlur = 0;
  CAR.dispTex.needsUpdate = true;
}

// 扉の向こうの廊下の色（階ごとに少し変える）
function carSetHall(idx) {
  const hue = (idx * 0.083 + 0.08) % 1;
  CAR.hallMat.color.setHSL(hue, 0.35, 0.72);
}
