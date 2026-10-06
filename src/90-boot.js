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
  let person = null;                                         // 今の乗客（乗る前・降りたあとは null）

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
  // mode に Phase 2 で boarding（乗る）/ exiting（ありがとう→降りる）/ finishing（最後の客のあと）/ result を追加。idle 以外は操作を受け付けない
  const G = { idx: floorIndexOf(CFG.floors.startFloor), door: 1, doorTarget: 1, mode: 'idle', dest: -1, path: [], step: 0, t: 0, dir: 0, flash: 0, time: 0, style: 0,
              S: newScore(CFG.game.passengers), want: -1, pt: 0, waitT: 0, styleBase: 0 };   // want = 乗客の目的階、pt = 乗り降りの経過秒、waitT = 台詞後の無操作秒
  window.GAME = G;                                           // 確認用
  const busy = () => G.mode !== 'idle';

  function setDoorTarget(v) { if (G.doorTarget !== v) sndDoor(); G.doorTarget = v; }

  // ---- 乗客 ----
  function spawnPassenger() {                                // 扉の向こうから現れて歩いて入る
    if (person) scene.remove(person);
    person = makePerson(G.styleBase + G.S.served);           // 見た目は順繰り
    person.position.set(CFG.person.x, 0, CFG.game.doorZ); person.scale.setScalar(CFG.person.scale);
    scene.add(person);
    G.want = pickDest(G.idx);
    hudSpeech(null); G.mode = 'boarding'; G.pt = 0; setDoorTarget(1);
  }
  function startGame() {
    G.S = newScore(CFG.game.passengers); G.styleBase = Math.floor(Math.random() * PERSON_STYLES.length);
    G.idx = floorIndexOf(CFG.floors.startFloor); G.dest = -1; hudArrow(0); showFloor(); hudScore(G.S); hudResult(null);
    spawnPassenger();
  }
  function popScore(d) { if (d) { hudPop(d); hudScore(G.S); } }
  function judgeArrival() {                                  // 扉が開ききったところで目的階と照らし合わせる
    if (G.idx === G.want) {
      popScore(scoreCorrect(G.S)); sndCorrect(); hudSpeech('ありがとうございます');
      G.mode = 'exiting'; G.pt = 0;
    } else {
      const d = scoreWrong(G.S); popScore(d); sndMiss();
      hudSpeech((d ? 'えっ、ここ？ ' : 'そこじゃないです… ') + floorSpeech(G.want) + 'です');
      G.mode = 'idle'; G.waitT = 0;
    }
  }
  function touch() { G.waitT = 0; }                          // 操作したら「待たせた」タイマーをやり直す

  function pressFloor(i) {
    inputFirstGesture(); sndResume(); touch();
    if (!isEnabled(i)) { return; }
    if (busy()) { sndBad(); return; }                        // 移動中は受け付けない
    sndClick();
    if (i === G.idx) { setDoorTarget(1); hudMsg(floorLabel(i) + 'です'); return; }   // 同じ階：扉を開くだけ
    G.dest = i; G.dir = moveDir(G.idx, i); G.path = pathBetween(G.idx, i); G.step = 0;
    hudLit(i, true);
    setDoorTarget(0); G.mode = 'closing'; G.t = 0;
  }
  INPUT.onFloor = pressFloor;
  INPUT.onOpen = () => { inputFirstGesture(); sndResume(); touch(); if (busy()) { sndBad(); return; } sndClick(); setDoorTarget(1); };
  INPUT.onClose = () => { inputFirstGesture(); sndResume(); touch(); if (busy()) { sndBad(); return; } sndClick(); setDoorTarget(0); };
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
      if (G.door >= 1) { G.dest = -1; judgeArrival(); }
    } else if (G.mode === 'boarding') {                      // 扉が開いてから、奥から歩いて入ってくる
      if (G.door >= 1) {
        G.pt += dt; const k = Math.min(1, G.pt / CFG.game.boardSec);
        person.position.z = CFG.game.doorZ + (CFG.person.z - CFG.game.doorZ) * k; walkPerson(person, G.time);
        if (k >= 1) { G.mode = 'idle'; G.waitT = 0; hudSpeech(floorSpeech(G.want) + 'お願いします'); }
      }
    } else if (G.mode === 'exiting') {                       // 「ありがとうございます」→ 振り向いて扉から出ていく
      G.pt += dt;
      if (G.pt >= CFG.game.thanksSec) {
        const k = Math.min(1, (G.pt - CFG.game.thanksSec) / CFG.game.exitSec);
        person.rotation.y += (Math.PI - person.rotation.y) * Math.min(1, dt * 12);
        person.position.z = CFG.person.z + (CFG.game.doorZ - CFG.person.z) * k; walkPerson(person, G.time);
        if (k >= 1) {
          scene.remove(person); person = null; hudSpeech(null);
          if (isFinished(G.S)) { G.mode = 'finishing'; G.pt = 0; } else spawnPassenger();
        }
      }
    } else if (G.mode === 'finishing') {
      G.pt += dt;
      if (G.pt >= CFG.game.resultDelay) {
        G.mode = 'result'; const r = rankFor(G.S.score, G.S.total);
        hudResult({ score: G.S.score, rank: r.rank, stars: r.stars, title: r.title }); sndFanfare();
      }
    } else if (G.mode === 'idle' && person) {                // 台詞のあと一定秒数、何も操作しないと 1 回だけ「待たせた」
      G.waitT += dt;
      if (G.waitT >= CFG.game.waitSec && !G.S.waited) popScore(scoreWait(G.S));
    }

    if (G.flash > 0) { G.flash = Math.max(0, G.flash - dt / CFG.move.chimeFlash); hudFlash((G.flash * 0.35).toFixed(3)); }

    // 固定カメラ（移動中だけ軽く振動）
    const C = CFG.cam, sh = G.mode === 'moving' ? CFG.shake.amp : 0, k = G.time * CFG.shake.freq;
    camera.position.set(C.x + Math.sin(k * 1.3) * sh, C.y + Math.sin(k) * sh, C.z);
    camera.lookAt(C.lookX, C.lookY, C.lookZ);
    if (person && G.mode !== 'boarding' && G.mode !== 'exiting') updatePerson(person, G.time);
    else if (person && G.mode === 'exiting' && G.pt < CFG.game.thanksSec) updatePerson(person, G.time);   // ありがとうの間はその場で立つ
  }

  hudBuild(); bindInput(); fit();
  $('retry').addEventListener('pointerdown', e => { e.preventDefault(); inputFirstGesture(); sndResume(); sndClick(); startGame(); });
  startGame();
  let last = performance.now();
  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })(last);
})();
