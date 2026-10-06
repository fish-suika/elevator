// ===== 乗客（簡易 3D キャラ）。見た目の違いは PERSON_STYLES から選ぶ =====
const PERSON_STYLES = [
  { skin: 0xf2c9a0, hair: 0x2b2118, shirt: 0x3a6ea5, pants: 0x2b2f3a },   // 会社員
  { skin: 0xe9b88e, hair: 0xb8892e, shirt: 0xc4453b, pants: 0x3a3f4a },   // 赤シャツ
  { skin: 0xc68e62, hair: 0x111111, shirt: 0x4e9a5b, pants: 0x594a38 },   // 緑
  { skin: 0xf6d6b8, hair: 0x8d8d92, shirt: 0x8a5aa6, pants: 0x2b2f3a },   // 紫・白髪
  { skin: 0x8d5a3c, hair: 0x1b1410, shirt: 0xe0a32e, pants: 0x30343f }    // 黄
];

function makePerson(style) {
  const s = typeof style === 'number' ? PERSON_STYLES[style % PERSON_STYLES.length] : (style || PERSON_STYLES[0]);
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, metalness: 0 });
  const g = new THREE.Group();
  const legH = 0.75, bodyH = 0.68, bodyY = legH + bodyH / 2;
  // 脚（付け根を軸に揺らせるよう Group にする）
  const legs = [-1, 1].map(sx => {
    const p = new THREE.Group(); p.position.set(sx * 0.11, legH, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.14, legH, 0.16), mat(s.pants)); m.position.y = -legH / 2; p.add(m);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.24), mat(0x1a1a1a)); shoe.position.set(0, -legH + 0.03, 0.03); p.add(shoe);
    g.add(p); return p;
  });
  // 体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, bodyH, 0.26), mat(s.shirt)); body.position.y = bodyY; g.add(body);
  // 腕（肩を軸に）
  const armH = 0.62;
  const arms = [-1, 1].map(sx => {
    const p = new THREE.Group(); p.position.set(sx * 0.3, legH + bodyH - 0.06, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.11, armH, 0.12), mat(s.shirt)); m.position.y = -armH / 2; p.add(m);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(s.skin)); hand.position.y = -armH - 0.02; p.add(hand);
    g.add(p); return p;
  });
  // 頭・髪・目
  const head = new THREE.Group(); head.position.y = legH + bodyH + 0.2;
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), mat(s.skin)));
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(s.hair)); hair.position.set(0, 0.025, -0.015); head.add(hair);
  [-1, 1].forEach(sx => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), mat(0x111111)); e.position.set(sx * 0.07, 0.02, 0.17); head.add(e); });
  g.add(head);
  g.userData = { head, arms, legs, body, phase: Math.random() * 6.28 };
  return g;
}

// 軽いアイドル揺れ
function updatePerson(p, t) {
  const u = p.userData, k = t * 1.6 + u.phase;
  u.body.scale.y = 1 + Math.sin(k) * 0.012;
  u.head.position.y = u.body.position.y + 0.54 + Math.sin(k) * 0.006;
  u.head.rotation.y = Math.sin(t * 0.5 + u.phase) * 0.25;
  u.head.rotation.z = Math.sin(t * 0.9 + u.phase) * 0.03;
  u.arms[0].rotation.x = Math.sin(k * 0.8) * 0.05; u.arms[1].rotation.x = -Math.sin(k * 0.8) * 0.05;
  u.arms[0].rotation.z = 0.04; u.arms[1].rotation.z = -0.04;
  p.rotation.z = Math.sin(t * 0.7 + u.phase) * 0.012;
}
