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
              sayQ: [], sayT: 0, memoShown: [], pt: 0, waitT: 0, styleBase: 0,
              regulars: [], endingOn: true, ep: '', et: 0, ek: 0, ec: 0, labels: [], dimV: 0, dimTarget: 0, shakeMul: 1, bump: 0 };   // regulars = 直近に降りた客の見た目と階（usual 用）、swapT = swap の交換までの経過秒、ep = エンディングの段階   // pt = 乗り降りの経過秒、waitT = 台詞後の無操作秒、mt = 動き出してからの秒、reroute = 移動中に押された新しい目的階
  window.GAME = G;                                           // 確認用
  const busy = () => G.mode !== 'idle';

  function setDoorTarget(v) { if (G.doorTarget !== v) sndDoor(); G.doorTarget = v; }

  // ---- 台詞（キューで順に出す。大事な出来事は sayNow で割り込む） ----
  function flushSay() { while (G.sayQ.length) { const it = G.sayQ.shift(); if (it.reveal) it.reveal(); } }
  function sayNow(text) { flushSay(); hudSpeech(text); }
  function doRotate() {                                      // swap：1 人降りて 2 人残ったところで、残りの 2 人が行き先を変える（台詞で明示。メモは自動では直さない）
    const lines = rotateRiders(G.order, G.idx, Math.random, floorsForLv(G.order.lv)); if (!lines) return;
    if (CFG.game.swapMemoAuto) G.order.riders.forEach(r => { r.shown = null; });
    refreshMemo(); sndNote(); flushSay();
    hudSpeech(lines[0].who + '：' + lines[0].text); G.sayQ = [{ text: lines[1].who + '：' + lines[1].text }]; G.sayT = CFG.game.sayGap; G.waitT = -CFG.game.sayGap;
  }
  function refreshRegMemo() {                                // usual 用：見た目（シャツの色）ごとに最後に降りた階。Lv6 の間だけ出す
    const on = CFG.game.showRegularMemo && G.order && G.order.lv >= 6 && G.regulars.length;
    hudRegMemo(on ? G.regulars.slice().sort((a, b) => a.style - b.style).map(r => ({ color: '#' + PERSON_STYLES[r.style].shirt.toString(16).padStart(6, '0'), name: STYLE_NAMES[r.style], text: floorLabel(r.floor) })) : null);
  }
  function refreshMemo() {                                   // 複数乗客のメモ（言った人から順に目的階が出る）
    const o = G.order;
    if (!isMulti(o)) { hudMemo(null); return; }
    hudMemo(o.riders.map((r, k) => ({ name: r.name, text: G.memoShown[k] ? floorLabel(r.shown != null && !CFG.game.swapMemoAuto ? r.shown : r.dest).replace('F', '') : '?', color: G.people[k] ? G.people[k].userData.color : '#888', done: r.off })));
  }

  // ---- 乗客 ----
  function clearPeople() { G.people.forEach(p => p && scene.remove(p)); G.people = []; }
  function setLvFloors(lv) { const f = floorsForLv(lv); CFG.floors.enabledMin = f.enabledMin; CFG.floors.enabledMax = f.enabledMax; hudEnabled(); }
  function spawnGroup() {                                    // 扉の向こうから現れて歩いて入る
    clearPeople();
    const entry = G.plan[G.S.served];
    setLvFloors(entry.lv);                                   // 組のレベルに応じて使える階が広がる（Lv6 は地下も）
    const o = G.order = genOrder(entry, G.idx, Math.random, floorsForLv(entry.lv), G.regulars);
    const slots = CFG.game.slots[o.riders.length] || CFG.game.slots[1];
    G.people = o.riders.map((r, k) => {
      const si = r.style != null ? r.style : (G.styleBase + G.S.served * 3 + k) % PERSON_STYLES.length;   // usual は前に降りた客と同じ見た目
      const p = makePerson(si); p.userData.slot = slots[k] || slots[0]; p.userData.style = si;
      p.userData.color = '#' + PERSON_STYLES[si].shirt.toString(16).padStart(6, '0');
      p.position.set(CFG.game.doorX, 0, CFG.game.doorZ); p.scale.setScalar(CFG.person.scale);
      scene.add(p); return p;
    });
    G.memoShown = o.riders.map(() => false); refreshMemo(); refreshRegMemo();
    G.sayQ = []; hudSpeech(null); G.reroute = -1; G.mode = 'boarding'; G.pt = 0; setDoorTarget(1);
  }
  function startIntro() {                                    // 乗り終わったら台詞。複数乗客は 1 人ずつ順に
    const lines = orderLines(G.order);
    G.sayQ = lines.map((ln, k) => ({ text: (ln.who ? ln.who + '：' : '') + ln.text, reveal: () => { G.memoShown[k] = true; refreshMemo(); } }));
    G.sayT = 0; G.mode = 'idle'; G.waitT = -(lines.length - 1) * CFG.game.sayGap;
  }
  function startGame() {
    const dbg = parseDebug(G.debugHash != null ? G.debugHash : location.hash);
    G.plan = buildPlan(Math.random, CFG.game, dbg); G.max = planMax(G.plan);
    G.S = newScore(G.plan.length); G.styleBase = Math.floor(Math.random() * PERSON_STYLES.length);
    G.regulars = []; hudRegMemo(null); G.endingOn = !dbg || !!dbg.end; G.ep = ''; G.et = 0; G.shakeMul = 1; G.dimV = G.dimTarget = 0; hudDim(0); hudBanner(null); sndRumbleStop();
    if (dbg && dbg.ending) { G.max = planMax(buildPlan(Math.random, CFG.game, null)); G.S.score = Math.round(G.max * 0.9); }   // #ending：通常の満点の 9 割を取った状態でエンディングだけ見る
    clearPeople(); hudSpeech(null); hudMemo(null); setDoorTarget(1);
    G.sayQ = []; G.leaving = -1; G.res = null; G.order = null; G.c = 0; G.bump = 0; G.waitT = 0; G.pt = 0; G.mt = 0; G.flash = 0; hudFlash(0); hudBanner(null);
    HUD.btns.forEach((b, k) => hudLit(k, false)); $('pops').innerHTML = ''; $('msg').classList.remove('on'); hudRegMemo(null);
    G.idx = floorIndexOf(CFG.floors.startFloor); G.dest = -1; G.reroute = -1; hudArrow(0); showFloor(); hudScore(G.S); hudResult(null);
    if (G.plan.length) spawnGroup(); else startEnding();
  }
  function startFinish() { if (G.endingOn) startEnding(); else { G.mode = 'finishing'; G.pt = 0; } }   // 全組が終わったら、エンディング（デバッグ進行ではリザルト直行）

  // ---- エンディング：最後の客が乗る → 何かボタンを押す → 暗くなりながら存在しない階へ上昇 → 謎の階 → 何もない → 勤務終了 → リザルト ----
  function startEnding() {
    const E = CFG.ending;
    hudRegMemo(null); setLvFloors(6); G.mode = 'ending'; G.ep = 'board'; G.pt = 0; G.et = 0; G.order = null; hudMemo(null); hudSpeech(null); G.sayQ = []; setDoorTarget(1);
    const p = makePerson(E.style); p.userData.slot = CFG.game.slots[1][0]; p.userData.color = '#' + E.style.shirt.toString(16).padStart(6, '0');
    p.position.set(CFG.game.doorX, 0, CFG.game.doorZ); p.scale.setScalar(CFG.person.scale); scene.add(p); G.people = [p];
  }
  function endingPress() {                                   // どのボタン（階・開く・閉じる）でも上昇が始まる
    if (G.ep !== 'wait') { sndBad(); return; }
    sndClick(); G.ep = 'close'; G.ec = 0; G.sayQ = []; sayNow(CFG.ending.pressLine); setDoorTarget(0);
  }
  function updateEnding(dt, walking) {
    const E = CFG.ending, gm = CFG.game, p = G.people[0]; G.et += dt;
    switch (G.ep) {
      case 'board':                                          // 扉が開いてから歩いて入る
        if (G.door >= 1) {
          G.pt += dt;
          const e = Math.min(1, G.pt / gm.boardSec), s = p.userData.slot;
          p.position.x = gm.doorX + (s[0] - gm.doorX) * e; p.position.z = gm.doorZ + (s[1] - gm.doorZ) * e;
          if (e < 1) { walkPerson(p, G.time); walking.add(p); }
          else { G.sayQ = E.askLines.map(t => ({ text: t })); G.sayT = 0; G.ep = 'wait'; }
        }
        break;
      case 'close':                                          // 扉が閉まったら上昇開始
        if (G.door <= 0) G.ec += dt; else G.ec = 0;
        if (G.door <= 0 && G.ec >= CFG.move.startDelay) {
          G.ep = 'rise'; G.ek = 0; G.et = 0; G.labels = endingLabels(G.idx, E.maxNum);
          hudArrow(1); sndRumbleStart(1); carSetDisplay(G.labels[0], 1);
        }
        break;
      case 'rise': {                                         // 11F, 12F, 13F… とだんだん速く。暗く・揺れて・音が上がる
        const last = G.labels.length - 1;
        if (G.et >= endingStepSec(G.ek, E)) {
          G.et -= endingStepSec(G.ek, E); G.ek++;
          if (G.ek > last) {                                 // 謎の階に到着
            G.ep = 'arrived'; G.et = 0; hudArrow(0); sndRumbleStop(); sndEndChime(); G.flash = 1; G.dimTarget = 0; G.shakeMul = 1;
            carSetDisplay(E.arriveLabel, 0); hudLabel(E.arriveLabel); carSetVoid(); break;
          }
          const lb = G.labels[G.ek], pr = G.ek / last; carSetDisplay(lb, 1); hudLabel(lb); sndTickRise(pr);
          E.says.forEach(s => { if (s.k === G.ek) sayNow(s.text); });
        }
        const pr = Math.min(1, G.ek / last);
        G.dimTarget = E.dimTo * pr; G.shakeMul = 1 + (E.shakeMul - 1) * pr; sndRumbleRise(pr);
        break;
      }
      case 'arrived': if (G.et >= CFG.move.arriveWait) { G.ep = 'open'; G.et = 0; setDoorTarget(1); } break;
      case 'open': if (G.door >= 1) { sayNow(E.arriveLine); G.ep = 'stand'; G.et = 0; } break;
      case 'stand': if (G.et >= E.standSec) { G.ep = 'exit'; G.et = 0; p.userData.from = [p.position.x, p.position.z]; sayNow(E.exitLine); } break;
      case 'exit': {                                         // 振り向いて、何もない扉の向こうへ歩いていく
        const k = Math.min(1, G.et / gm.exitSec), f = p.userData.from;
        p.rotation.y += (Math.PI - p.rotation.y) * Math.min(1, dt * 12);
        p.position.x = f[0] + (gm.doorX - f[0]) * k; p.position.z = f[1] + (gm.doorZ - f[1]) * k; walkPerson(p, G.time); walking.add(p);
        if (k >= 1) { scene.remove(p); G.people = []; hudSpeech(null); G.ep = 'void'; G.et = 0; }
        break;
      }
      case 'void': if (G.et >= E.voidSec) { G.ep = 'banner'; G.et = 0; hudBanner(E.banner); } break;
      case 'banner':
        if (G.et >= E.bannerSec) {
          G.ep = 'done'; G.mode = 'result'; hudBanner(null); const r = rankFor(G.S.score, G.max);
          hudResult({ score: G.S.score, rank: r.rank, stars: r.stars, title: r.title, heading: E.resultHead }); sndFanfare();
        }
        break;
    }
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
      sndCorrect(); sayNow(offLine(o, r)); refreshMemo();
      const si = G.people[res.off].userData.style; if (si != null) { noteRegular(G.regulars, si, G.idx); refreshRegMemo(); }   // この見た目の客が降りた階を覚える（usual 用）
      G.leaving = res.off; G.mode = 'exiting'; G.pt = 0;
      G.people[res.off].userData.from = [G.people[res.off].position.x, G.people[res.off].position.z];
    } else if (res.changed) {
      sndBad(); sayNow(changeLine(o)); G.mode = 'idle'; G.waitT = 0;
    } else if (res.via) {
      sndNote(); sayNow(viaDoneLine(o)); G.mode = 'idle'; G.waitT = 0;
    } else {                                                 // 間違い（降りない階・禁止階・経由前）
      const first = res.deltas.length > 0; sndMiss(); G.bump = CFG.game.bump.wrong;
      if (res.wrongKind === 'forbid') sayNow('えっ！' + floorSpeech(o.forbid) + 'には行かないでって言ったのに');
      else if (isMulti(o)) sayNow(first ? 'えっ、ここじゃないですよ' : 'そこじゃないです…');
      else sayNow((first ? 'えっ、ここ？ ' : 'そこじゃないです… ') + orderReminder(o));
      G.mode = 'idle'; G.waitT = 0;
    }
  }
  function touchReset()  /* 操作したら「待たせた」タイマーをやり直す（台詞中は負の値から） */ { G.waitT = G.sayQ.length ? -(G.sayQ.length) * CFG.game.sayGap : 0; }

  function stopHere() { if (!sameStopJudges(G.order, G.idx)) return false; G.mode = 'opening'; G.t = 0; return true; }   // 今いる階を「止まった階」として判定させる（扉が開いたら judgeStop）
  function pressFloor(i) {
    inputFirstGesture(); sndResume(); touchReset();
    if (G.mode === 'ending') { endingPress(); return; }
    if (!isEnabled(i)) { return; }
    if ((G.mode === 'moving' || G.mode === 'closing') && moveInputAllowed(G.order)) {  // Lv4 の変更後・Lv5 の通過停止だけ、扉が閉まる間・移動中でも受け付ける（次の階に着いたところで向きを変える）
      if (i === G.dest && G.reroute < 0) return;
      sndClick(); G.reroute = i; hudLit(i, true); return;
    }
    if (busy()) { sndBad(); return; }                        // 移動中は受け付けない
    sndClick();
    if (i === G.idx) { setDoorTarget(1); if (!stopHere()) hudMsg(floorLabel(i) + 'です'); return; }   // 同じ階：扉を開くだけ（存在しない階の客が最上階にいるときは、そこで判定）
    G.dest = i; G.dir = moveDir(G.idx, i); G.path = pathBetween(G.idx, i); G.step = 0;
    hudLit(i, true);
    setDoorTarget(0); G.mode = 'closing'; G.t = 0;
  }
  INPUT.onFloor = pressFloor;
  INPUT.onOpen = () => { inputFirstGesture(); sndResume(); touchReset(); if (G.mode === 'ending') { endingPress(); return; } if (busy()) { sndBad(); return; } sndClick(); setDoorTarget(1); stopHere(); };
  INPUT.onClose = () => { inputFirstGesture(); sndResume(); touchReset(); if (G.mode === 'ending') { endingPress(); return; } if (busy()) { sndBad(); return; } sndClick(); setDoorTarget(0); };
  INPUT.onFirst = () => { sndInit(); sndResume(); };
  INPUT.onRetry = () => { if (G.mode !== 'result') return false; inputFirstGesture(); sndResume(); sndClick(); startGame(); return true; };

  function showFloor() { hudSetFloor(G.idx); carSetDisplay(floorLabel(G.idx), G.mode === 'moving' ? G.dir : 0); carSetHall(G.idx); }
  function arrive() {
    G.mode = 'arrived'; G.t = 0; hudArrow(0); sndRumbleStop(); sndChime(); G.flash = 1; G.bump = CFG.game.bump.arrive; showFloor();
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
          if (G.res.done) { if (isFinished(G.S)) startFinish(); else spawnGroup(); }
          else { G.mode = 'idle'; G.waitT = 0; doRotate(); }
        }
      }
    } else if (G.mode === 'ending') {
      updateEnding(dt, walking);
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

    if (G.dimV !== G.dimTarget) { G.dimV += (G.dimTarget - G.dimV) * Math.min(1, dt * 3); if (Math.abs(G.dimV - G.dimTarget) < 0.002) G.dimV = G.dimTarget; hudDim(G.dimV.toFixed(3)); }
    if (G.flash > 0) { G.flash = Math.max(0, G.flash - dt / CFG.move.chimeFlash); hudFlash((G.flash * 0.35).toFixed(3)); }

    // 固定カメラ（移動中だけ軽く振動）
    const C = CFG.cam, sh = G.mode === 'moving' ? CFG.shake.amp : G.mode === 'ending' && G.ep === 'rise' ? CFG.shake.amp * G.shakeMul : 0, k = G.time * CFG.shake.freq;
    G.bump = G.bump < 0.0004 ? 0 : G.bump * Math.exp(-dt / (CFG.game.bump.sec / 4));
    const bp = G.bump * Math.sin(G.time * 55);
    camera.position.set(C.x + Math.sin(k * 1.3) * sh + bp * 0.5, C.y + Math.sin(k) * sh + bp, C.z);
    camera.lookAt(C.lookX, C.lookY, C.lookZ);
    G.people.forEach(p => { if (p && !walking.has(p)) updatePerson(p, G.time); });
  }

  document.addEventListener('visibilitychange', () => { if (!SND.ctx) return; if (document.hidden) SND.ctx.suspend(); else SND.ctx.resume(); });   // タブを離れたら音を止める（戻ったとき dt は 0.05 秒で頭打ちなので状態は飛ばない）
  hudBuild(); bindInput(); fit();
  $('retry').addEventListener('pointerdown', e => { e.preventDefault(); inputFirstGesture(); sndResume(); sndClick(); startGame(); });
  addEventListener('hashchange', () => { G.debugHash = null; startGame(); });   // #lv=4 などの切り替えを即反映（デバッグ用）
  G.start = h => { G.debugHash = h; startGame(); };           // 確認用：GAME.start('#lv=4&n=2') でも同じ指定ができる（URL ハッシュが使えない環境向け）
  startGame();
  let last = performance.now();
  (function loop(now) {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;   // 時計が戻っても（dt が負でも）状態を壊さない
    update(dt); renderer.render(scene, camera);
    requestAnimationFrame(loop);
  })(last);
})();
