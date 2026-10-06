// ===== 起動とメインループ・エレベーターの動き =====
// mode: idle（扉は開閉どちらでも・操作可）→ closing（扉を閉じる）→ moving（1階ずつ）→ arrived（チャイム）→ opening → idle
(function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const view = $('view'), stage = $('stage');
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  buildCar(scene);
  const camera = new THREE.PerspectiveCamera(60, 9 / 16, 0.1, 40);
  const person = makePerson(0);
  person.position.set(CFG.person.x, 0, CFG.person.z); person.scale.setScalar(CFG.person.scale);
  scene.add(person);

  function fit() {                                           // 枠の大きさに合わせる。文字の基準 --u は枠の幅の 1/100
    const w = view.clientWidth, h = view.clientHeight;
    renderer.setSize(w, h);
    document.documentElement.style.setProperty('--u', stage.clientWidth / 100 + 'px');
    camera.aspect = w / h;
    const hf = CFG.cam.hfov * Math.PI / 180;                 // 横の画角を一定にして、縦の画角を決める
    camera.fov = 2 * Math.atan(Math.tan(hf / 2) / camera.aspect) * 180 / Math.PI;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', fit); addEventListener('orientationchange', fit);

  // ---- 状態 ----
  const G = { idx: floorIndexOf(CFG.floors.startFloor), door: 1, doorTarget: 1, mode: 'idle', dest: -1, path: [], step: 0, t: 0, dir: 0, flash: 0, time: 0, style: 0 };
  window.GAME = G;                                           // 確認用
  const busy = () => G.mode !== 'idle';

  function setDoorTarget(v) { if (G.doorTarget !== v) sndDoor(); G.doorTarget = v; }

  function pressFloor(i) {
    inputFirstGesture(); sndResume();
    if (!isEnabled(i)) { return; }
    if (busy()) { sndBad(); return; }                        // 移動中は受け付けない
    sndClick();
    if (i === G.idx) { setDoorTarget(1); hudMsg(floorLabel(i) + 'です'); return; }   // 同じ階：扉を開くだけ
    G.dest = i; G.dir = moveDir(G.idx, i); G.path = pathBetween(G.idx, i); G.step = 0;
    hudLit(i, true);
    setDoorTarget(0); G.mode = 'closing'; G.t = 0;
  }
  INPUT.onFloor = pressFloor;
  INPUT.onOpen = () => { inputFirstGesture(); sndResume(); if (busy()) { sndBad(); return; } sndClick(); setDoorTarget(1); };
  INPUT.onClose = () => { inputFirstGesture(); sndResume(); if (busy()) { sndBad(); return; } sndClick(); setDoorTarget(0); };
  INPUT.onFirst = () => { sndInit(); sndResume(); };

  function showFloor() { hudSetFloor(G.idx); carSetDisplay(floorLabel(G.idx), G.mode === 'moving' ? G.dir : 0); carSetHall(G.idx); }

  // ---- 1 フレーム分の進行 ----
  function update(dt) {
    G.time += dt;
    const ds = dt / CFG.move.doorSec;                        // 扉
    if (G.door < G.doorTarget) G.door = Math.min(G.doorTarget, G.door + ds);
    else if (G.door > G.doorTarget) G.door = Math.max(G.doorTarget, G.door - ds);
    carSetDoor(G.door);

    G.t += dt;
    if (G.mode === 'closing') {
      if (G.door <= 0) G.c = (G.c || 0) + dt; else G.c = 0;
      if (G.door <= 0 && G.c >= CFG.move.startDelay) {
        G.c = 0;
        G.mode = 'moving'; G.t = 0; G.step = 0; hudArrow(G.dir); sndRumbleStart(G.dir); showFloor();
      }
    } else if (G.mode === 'moving') {
      if (G.t >= CFG.move.stepSec) {                         // 1 階進む
        G.t -= CFG.move.stepSec; G.idx = G.path[G.step++]; sndTick(); showFloor();
        if (G.step >= G.path.length) {
          G.mode = 'arrived'; G.t = 0; hudArrow(0); sndRumbleStop(); sndChime(); G.flash = 1; showFloor(); hudLit(G.dest, false);
        }
      }
    } else if (G.mode === 'arrived') {
      if (G.t >= CFG.move.arriveWait) { G.mode = 'opening'; G.t = 0; setDoorTarget(1); }
    } else if (G.mode === 'opening') {
      if (G.door >= 1) { G.mode = 'idle'; G.dest = -1; }
    }

    if (G.flash > 0) { G.flash = Math.max(0, G.flash - dt / CFG.move.chimeFlash); hudFlash((G.flash * 0.35).toFixed(3)); }

    // 固定カメラ（移動中だけ軽く振動）
    const C = CFG.cam, sh = G.mode === 'moving' ? CFG.shake.amp : 0, k = G.time * CFG.shake.freq;
    camera.position.set(C.x + Math.sin(k * 1.3) * sh, C.y + Math.sin(k) * sh, C.z);
    camera.lookAt(C.lookX, C.lookY, C.lookZ);
    updatePerson(person, G.time);
  }

  hudBuild(); bindInput(); fit();
  showFloor();
  let last = performance.now();
  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })(last);
})();
