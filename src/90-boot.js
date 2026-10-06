// ===== 起動とメインループ・エレベーターの動き =====
// mode: idle（扉は開閉どちらでも・操作可）→ closing（扉を閉じる）→ moving（1階ずつ）→ arrived（チャイム）→ opening → 判定 → idle / exiting（降りる）
// 「止まった階（扉を開けた階）」ごとに resolveStop（25-game.js）が降りる／変更／経由／減点／ボーナスを決める
(function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const view = $('view'), stage = $('stage');
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  buildCar(scene);
  const camera = new THREE.PerspectiveCamera(60, 9 / 16, 0.1, 40);

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
  // order = 今の組のオーダー、people = その乗客の 3D（降りたら null）、S.served = 終わった組数
  const G = { idx: floorIndexOf(CFG.floors.startFloor), door: 1, doorTarget: 1, mode: 'idle', dest: -1, path: [], step: 0, t: 0, dir: 0, flash: 0, time: 0,
              S: newScore(CFG.game.levelPlan.length), plan: [], max: 1, order: null, people: [], leaving: -1, res: null, reroute: -1, mt: 0,
              sayQ: [], sayT: 0, memoShown: [], pt: 0, waitT: 0, styleBase: 0 };   // pt = 乗り降りの経過秒、waitT = 台詞後の無操作秒、mt = 動き出してからの秒、reroute = 移動中に押された新しい目的階
  window.GAME = G;                                           // 確認用
  const busy = () => G.mode !== 'idle';

  function setDoorTarget(v) { if (G.doorTarget !== v) sndDoor(); G.doorTarget = v; }

  // ---- 台詞（キューで順に出す。大事な出来事は sayNow で割り込む） ----
  function flushSay() { while (G.sayQ.length) { const it = G.sayQ.shift(); if (it.reveal) it.reveal(); } }
  function sayNow(text) { flushSay(); hudSpeech(text); }
  function refreshMemo() {                                   // 複数乗客のメモ（言った人から順に目的階が出る）
    const o = G.order;
    if (!o || o.kind !== 'multi') { hudMemo(null); return; }
    hudMemo(o.riders.map((r, k) => ({ name: r.name, text: G.memoShown[k] ? floorLabel(r.dest).replace('F', '') : '?', color: G.people[k] ? G.people[k].userData.color : '#888', done: r.off })));
  }

  // ---- 乗客 ----
  function clearPeople() { G.people.forEach(p => p && scene.remove(p)); G.people = []; }
  function spawnGroup() {                                    // 扉の向こうから現れて歩いて入る
    clearPeople();
    const entry = G.plan[G.S.served];
    CFG.floors.enabledMax = floorsForLv(entry.lv).enabledMax; hudEnabled();   // 組のレベルに応じて使える階が広がる
    const o = G.order = genOrder(entry, G.idx, Math.random, floorsForLv(entry.lv));
    const slots = CFG.game.slots[o.riders.length] || CFG.game.slots[1];
    G.people = o.riders.map((r, k) => {
      const si = (G.styleBase + G.S.served * 3 + k) % PERSON_STYLES.length;
      const p = makePerson(si); p.userData.slot = slots[k] || slots[0];
      p.userData.color = '#' + PERSON_STYLES[si].shirt.toString(16).padStart(6, '0');
      p.position.set(CFG.game.doorX, 0, CFG.game.doorZ); p.scale.setScalar(CFG.person.scale);
      scene.add(p); return p;
    });
    G.memoShown = o.riders.map(() => false); refreshMemo();
    G.sayQ = []; hudSpeech(null); G.reroute = -1; G.mode = 'boarding'; G.pt = 0; setDoorTarget(1);
  }
  function startIntro() {                                    // 乗り終わったら台詞。複数乗客は 1 人ずつ順に
    const lines = orderLines(G.order);
    G.sayQ = lines.map((ln, k) => ({ text: (ln.who ? ln.who + '：' : '') + ln.text, reveal: () => { G.memoShown[k] = true; refreshMemo(); } }));
    G.sayT = 0; G.mode = 'idle'; G.waitT = -(lines.length - 1) * CFG.game.sayGap;
  }
  function startGame() {
    G.plan = buildPlan(Math.random, CFG.game, parseDebug(G.debugHash != null ? G.debugHash : location.hash)); G.max = planMax(G.plan);
    G.S = newScore(G.plan.length); G.styleBase = Math.floor(Math.random() * PERSON_STYLES.length);
    G.idx = floorIndexOf(CFG.floors.startFloor); G.dest = -1; G.reroute = -1; hudArrow(0); showFloor(); hudScore(G.S); hudResult(null);
    spawnGroup();
  }
  function popScore(deltas) {                                // 浮き文字。2 つ目以降（ボーナス）は少し遅らせる
    deltas.forEach((d, k) => setTimeout(() => hudPop(d.v, d.label), k * 350));
    if (deltas.length) hudScore(G.S);
  }
  function judgeStop() {                                     // 扉が開ききったところで、止まった階をオーダーに照らす
    const o = G.order, res = G.res = resolveStop(G.S, o, G.idx);
    popScore(res.deltas);
    if (res.off >= 0) {
      const r = o.riders[res.off];
      sndCorrect(); sayNow((r.name ? r.name + '：' : '') + 'ありがとうございます'); refreshMemo();
      G.leaving = res.off; G.mode = 'exiting'; G.pt = 0;
      G.people[res.off].userData.from = [G.people[res.off].position.x, G.people[res.off].position.z];
    } else if (res.changed) {
      sndBad(); sayNow(changeLine(o)); G.mode = 'idle'; G.waitT = 0;
    } else if (res.via) {
      sndNote(); sayNow(viaDoneLine(o)); G.mode = 'idle'; G.waitT = 0;
    } else {                                                 // 間違い（降りない階・禁止階・経由前）
      const first = res.deltas.length > 0; sndMiss();
      if (res.wrongKind === 'forbid') sayNow('えっ！' + floorSpeech(o.forbid) + 'には行かないでって言ったのに');
      else if (o.kind === 'multi') sayNow(first ? 'えっ、ここじゃないですよ' : 'そこじゃないです…');
      else sayNow((first ? 'えっ、ここ？ ' : 'そこじゃないです… ') + orderReminder(o));
      G.mode = 'idle'; G.waitT = 0;
    }
  }
  function touchReset()  /* 操作したら「待たせた」タイマーをやり直す（台詞中は負の値から） */ { G.waitT = G.sayQ.length ? -(G.sayQ.length) * CFG.game.sayGap : 0; }

  function pressFloor(i) {
    inputFirstGesture(); sndResume(); touchReset();
    if (!isEnabled(i)) { return; }
    if ((G.mode === 'moving' || G.mode === 'closing') && moveInputAllowed(G.order)) {  // Lv4 の変更後・Lv5 の通過停止だけ、扉が閉まる間・移動中でも受け付ける（次の階に着いたところで向きを変える）
      if (i === G.dest && G.reroute < 0) return;
      sndClick(); G.reroute = i; hudLit(i, true); return;
    }
    if (busy()) { sndBad(); return; }                        // 移動中は受け付けない
    sndClick();
    if (i === G.idx) { setDoorTarget(1); hudMsg(floorLabel(i) + 'です'); return; }   // 同じ階：扉を開くだけ
    G.dest = i; G.dir = moveDir(G.idx, i); G.path = pathBetween(G.idx, i); G.step = 0;
    hudLit(i, true);
    setDoorTarget(0); G.mode = 'closing'; G.t = 0;
  }
  INPUT.onFloor = pressFloor;
  INPUT.onOpen = () => { inputFirstGesture(); sndResume(); touchReset(); if (busy()) { sndBad(); return; } sndClick(); setDoorTarget(1); };
  INPUT.onClose = () => { inputFirstGesture(); sndResume(); touchReset(); if (busy()) { sndBad(); return; } sndClick(); setDoorTarget(0); };
  INPUT.onFirst = () => { sndInit(); sndResume(); };

  function showFloor() { hudSetFloor(G.idx); carSetDisplay(floorLabel(G.idx), G.mode === 'moving' ? G.dir : 0); carSetHall(G.idx); }
  function arrive() {
    G.mode = 'arrived'; G.t = 0; hudArrow(0); sndRumbleStop(); sndChime(); G.flash = 1; showFloor();
    HUD.btns.forEach((b, k) => hudLit(k, false));
  }
  function applyReroute() {                                  // 移動中に押された階へ、いま着いた階から行き先を差し替える
    const r = G.reroute; G.reroute = -1;
    const oldDir = G.dir;
    G.dest = r; G.path = pathBetween(G.idx, r); G.step = 0;
    if (!G.path.length) { arrive(); return; }
    G.dir = moveDir(G.idx, r); hudArrow(G.dir); showFloor();
    if (G.dir !== oldDir) { sndRumbleStop(); sndRumbleStart(G.dir); }
  }

  // ---- 1 フレーム分の進行 ----
  function update(dt) {
    G.time += dt;
    const ds = dt / CFG.move.doorSec;                        // 扉
    if (G.door < G.doorTarget) G.door = Math.min(G.doorTarget, G.door + ds);
    else if (G.door > G.doorTarget) G.door = Math.max(G.doorTarget, G.door - ds);
    carSetDoor(G.door);

    // 台詞キュー
    if (G.sayQ.length) {
      G.sayT -= dt;
      if (G.sayT <= 0) { const it = G.sayQ.shift(); hudSpeech(it.text); if (it.reveal) it.reveal(); G.sayT = CFG.game.sayGap; }
    }

    const walking = new Set(), n = G.people.length;
    G.t += dt;
    if (G.mode === 'closing') {
      if (G.door <= 0) G.c = (G.c || 0) + dt; else G.c = 0;
      if (G.door <= 0 && G.c >= CFG.move.startDelay) {
        G.c = 0;
        G.mode = 'moving'; G.t = 0; G.mt = 0; G.step = 0; hudArrow(G.dir); sndRumbleStart(G.dir); showFloor();
      }
    } else if (G.mode === 'moving') {
      G.mt += dt;
      if (G.order && G.order.kind === 'mid' && G.order.midState === 'pending' && G.mt >= CFG.game.midShoutSec) {   // Lv4：動いている最中に目的階が変わる
        const line = midShout(G.order); sndBad(); sayNow(line);
      }
      if (G.t >= CFG.move.stepSec) {                         // 1 階進む
        G.t -= CFG.move.stepSec; G.idx = G.path[G.step++]; sndTick(); showFloor();
        if (G.reroute >= 0) applyReroute();
        else if (G.step >= G.path.length) arrive();
      }
    } else if (G.mode === 'arrived') {
      if (G.t >= CFG.move.arriveWait) { G.mode = 'opening'; G.t = 0; setDoorTarget(1); }
    } else if (G.mode === 'opening') {
      if (G.door >= 1) { G.dest = -1; judgeStop(); }
    } else if (G.mode === 'boarding') {                      // 扉が開いてから、奥から歩いて入ってくる（複数乗客は少しずつ遅れて）
      if (G.door >= 1) {
        G.pt += dt;
        G.people.forEach((p, k) => {
          const e = Math.max(0, Math.min(1, (G.pt - k * CFG.game.boardStagger) / CFG.game.boardSec)), s = p.userData.slot, gm = CFG.game;
          p.position.x = gm.doorX + (s[0] - gm.doorX) * e; p.position.z = gm.doorZ + (s[1] - gm.doorZ) * e;
          if (e < 1) { walkPerson(p, G.time); walking.add(p); }
        });
        if (G.pt >= CFG.game.boardSec + (n - 1) * CFG.game.boardStagger) startIntro();
      }
    } else if (G.mode === 'exiting') {                       // 「ありがとうございます」→ 振り向いて扉から出ていく（残りの乗客はそのまま）
      G.pt += dt;
      const p = G.people[G.leaving], gm = CFG.game;
      if (G.pt >= gm.thanksSec) {
        const k = Math.min(1, (G.pt - gm.thanksSec) / gm.exitSec), f = p.userData.from;
        p.rotation.y += (Math.PI - p.rotation.y) * Math.min(1, dt * 12);
        p.position.x = f[0] + (gm.doorX - f[0]) * k; p.position.z = f[1] + (gm.doorZ - f[1]) * k; walkPerson(p, G.time); walking.add(p);
        if (k >= 1) {
          scene.remove(p); G.people[G.leaving] = null; G.leaving = -1; hudSpeech(null);
          if (G.res.done) { if (isFinished(G.S)) { G.mode = 'finishing'; G.pt = 0; } else spawnGroup(); }
          else { G.mode = 'idle'; G.waitT = 0; }
        }
      }
    } else if (G.mode === 'finishing') {
      G.pt += dt;
      if (G.pt >= CFG.game.resultDelay) {
        G.mode = 'result'; const r = rankFor(G.S.score, G.max);
        hudResult({ score: G.S.score, rank: r.rank, stars: r.stars, title: r.title }); sndFanfare();
      }
    } else if (G.mode === 'idle' && G.people.some(Boolean)) {   // 台詞のあと一定秒数、何も操作しないと「待たせた」（進展があるまで 1 回だけ）
      G.waitT += dt;
      if (G.waitT >= CFG.game.waitSec && !G.S.waited) popScore([{ v: scoreWait(G.S), label: '' }]);
    }

    if (G.flash > 0) { G.flash = Math.max(0, G.flash - dt / CFG.move.chimeFlash); hudFlash((G.flash * 0.35).toFixed(3)); }

    // 固定カメラ（移動中だけ軽く振動）
    const C = CFG.cam, sh = G.mode === 'moving' ? CFG.shake.amp : 0, k = G.time * CFG.shake.freq;
    camera.position.set(C.x + Math.sin(k * 1.3) * sh, C.y + Math.sin(k) * sh, C.z);
    camera.lookAt(C.lookX, C.lookY, C.lookZ);
    G.people.forEach(p => { if (p && !walking.has(p)) updatePerson(p, G.time); });
  }

  hudBuild(); bindInput(); fit();
  $('retry').addEventListener('pointerdown', e => { e.preventDefault(); inputFirstGesture(); sndResume(); sndClick(); startGame(); });
  addEventListener('hashchange', () => { G.debugHash = null; startGame(); });   // #lv=4 などの切り替えを即反映（デバッグ用）
  G.start = h => { G.debugHash = h; startGame(); };           // 確認用：GAME.start('#lv=4&n=2') でも同じ指定ができる（URL ハッシュが使えない環境向け）
  startGame();
  let last = performance.now();
  (function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    update(dt); renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })(last);
})();
