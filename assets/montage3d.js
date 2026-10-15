/* natan.saarland — scroll-gesteuerte Küchenmontage in WebGL
   Eine Küche baut sich beim Scrollen selbst auf: Aufmaß per Laser, Korpusse,
   Fronten, Arbeitsplatten, Ausschnitt mit Funkenflug, Griffe, Licht, Übergabe. */
import * as THREE from 'three';
import { RoomEnvironment } from './../js/addons/RoomEnvironment.js';

const hero = document.getElementById('montage');
const canvas = document.getElementById('kc');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const QA = /[?&]qa\b/.test(location.search);

function fail() { document.documentElement.classList.add('no-gl'); hero && hero.classList.add('no-gl'); }

if (hero && canvas) {
  try { init(); } catch (e) { fail(); if (window.console) console.warn('3D deaktiviert:', e && e.message); }
}

function init() {
  const test = document.createElement('canvas');
  if (!(test.getContext('webgl2') || test.getContext('webgl'))) { fail(); return; }

  const mobile = matchMedia('(max-width: 760px)').matches || matchMedia('(pointer:coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.6 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const BG = new THREE.Color('#0c0d0f');
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 9, 20);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 60);

  /* ---------------- Materialien ---------------- */
  const woodTex = makeWood();
  const M = {
    carc: new THREE.MeshStandardMaterial({ color: '#d9d5cd', roughness: .72, envMapIntensity: .55 }),
    front: new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: .5, envMapIntensity: .6 }),
    stone: new THREE.MeshStandardMaterial({ color: '#1a1b1d', roughness: .28, metalness: .05, envMapIntensity: .8 }),
    oak: new THREE.MeshStandardMaterial({ color: '#ffffff', map: woodTex, roughness: .58, envMapIntensity: .55 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c39a5c', roughness: .28, metalness: 1, envMapIntensity: 1.1 }),
    glass: new THREE.MeshStandardMaterial({ color: '#060607', roughness: .06, metalness: .3, envMapIntensity: 1.2 }),
    steel: new THREE.MeshStandardMaterial({ color: '#a9aeb3', roughness: .3, metalness: .95, envMapIntensity: 1 }),
    black: new THREE.MeshStandardMaterial({ color: '#0f1011', roughness: .6 }),
    floor: new THREE.MeshStandardMaterial({ color: '#16171a', roughness: .92, envMapIntensity: .3 }),
    wall: new THREE.MeshStandardMaterial({ color: '#1c1d21', roughness: .95, envMapIntensity: .3 }),
    led: new THREE.MeshBasicMaterial({ color: '#ffcf96' }),
    laser: new THREE.MeshBasicMaterial({ color: '#ff2b1c', transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    fan: new THREE.MeshBasicMaterial({ color: '#ff2b1c', transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    ghost: new THREE.LineBasicMaterial({ color: '#ff4a3a', transparent: true, opacity: 0, depthWrite: false, fog: false }),
    kerf: new THREE.MeshBasicMaterial({ color: '#050505' }),
    saw: new THREE.MeshStandardMaterial({ color: '#2d3136', roughness: .45, metalness: .2 }),
    sawRed: new THREE.MeshStandardMaterial({ color: '#e0261b', roughness: .4 }),
    blade: new THREE.MeshStandardMaterial({ color: '#c9ced3', roughness: .2, metalness: 1 })
  };

  /* ---------------- Raum ---------------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), M.floor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const grid = new THREE.GridHelper(40, 40, '#2a2c31', '#202226');
  grid.position.y = .001; grid.material.transparent = true; grid.material.opacity = .55; scene.add(grid);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 8), M.wall);
  wall.position.set(0, 4, 0); wall.receiveShadow = true; scene.add(wall);

  /* ---------------- Licht ---------------- */
  const hemi = new THREE.HemisphereLight('#aab4c2', '#1b1611', .55); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3e2', 2.4);
  sun.position.set(3.5, 6.5, 6); sun.target.position.set(0, .6, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -2, near: 1, far: 18 });
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .02;
  scene.add(sun, sun.target);
  const rim = new THREE.DirectionalLight('#9fb4ff', .35); rim.position.set(-5, 3, 2); scene.add(rim);
  const ledLights = [-0.6, 0.6, 1.8].map(x => { const l = new THREE.PointLight('#ffb978', 0, 2.6, 2); l.position.set(x, 1.36, .38); scene.add(l); return l; });
  const sawLight = new THREE.PointLight('#ff8a3a', 0, 1.6, 2); scene.add(sawLight);

  /* ---------------- Helfer ---------------- */
  const all = [];
  function box(w, h, d, mat, x, y, z, parent, opts = {}) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (opts.worldUV) worldUV(g, x + (opts.ox || 0), y + (opts.oy || 0), z + (opts.oz || 0));
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z);
    m.castShadow = opts.cast !== false; m.receiveShadow = true;
    (parent || scene).add(m);
    return m;
  }
  function worldUV(g, ox, oy, oz) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv, s = .9;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + ox, y = p.getY(i) + oy, z = p.getZ(i) + oz;
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i));
      if (ay > .5) uv.setXY(i, x / s, z / s * .35 + .3);
      else if (ax > .5) uv.setXY(i, z / s, y / s * .35);
      else uv.setXY(i, x / s, y / s * .35 + .6);
    }
    uv.needsUpdate = true;
  }
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const eOut = t => 1 - Math.pow(1 - t, 3);
  const eInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const eBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  /* ---------------- Korpus (offene Kiste aus 19-mm-Platten) ---------------- */
  const T = .019;
  function carcass(w, h, d, x, y0, z, legs = true) {
    const g = new THREE.Group();
    g.position.set(x, y0 + h / 2, z);
    box(T, h, d, M.carc, -w / 2 + T / 2, 0, 0, g);
    box(T, h, d, M.carc, w / 2 - T / 2, 0, 0, g);
    box(w - 2 * T, T, d, M.carc, 0, -h / 2 + T / 2, 0, g);
    box(w - 2 * T, T, .1, M.carc, 0, h / 2 - T / 2, d / 2 - .05, g);
    box(w - 2 * T, T, .1, M.carc, 0, h / 2 - T / 2, -d / 2 + .05, g);
    box(w - 2 * T, h - 2 * T, .006, M.carc, 0, 0, -d / 2 + .003, g, { cast: false });
    if (h > .5) box(w - 2 * T - .004, T, d - .04, M.carc, 0, h > 1.2 ? .15 : .02, .01, g, { cast: false });
    if (legs) {
      const lg = new THREE.CylinderGeometry(.016, .02, y0, 10);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const l = new THREE.Mesh(lg, M.black);
        l.position.set(sx * (w / 2 - .05), -h / 2 - y0 / 2, sz * (d / 2 - .06));
        g.add(l);
      }
    }
    g.userData.home = g.position.clone();
    scene.add(g);
    return g;
  }

  /* ---------------- Maße der Küche (Meter) ---------------- */
  const PL = .10, HC = .72, TOP = PL + HC; // Oberkante Korpus 0,82
  const ZB = .30, D = .56;               // Rückzeile
  const ZI = 1.83;                       // Insel
  const baseX = [-0.9, -0.3, 0.3, 0.9, 1.5, 2.1];
  const islX = [-0.6, 0, 0.6, 1.2];
  const tallX = [-2.1, -1.5];

  const carcs = [];
  tallX.forEach(x => carcs.push(carcass(.6, 2.12, D, x, PL, ZB)));
  baseX.forEach(x => carcs.push(carcass(.6, HC, D, x, PL, ZB)));
  islX.forEach(x => carcs.push(carcass(.6, HC, D, x, PL, ZI)));
  const walls = baseX.map(x => carcass(.6, .74, .34, x, 1.48, .19, false));

  /* Blaupause: Geisterlinien, wo alles hinkommt */
  const ghost = new THREE.Group(); scene.add(ghost);
  function ghostBox(w, h, d, x, y, z) {
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)), M.ghost);
    e.position.set(x, y, z); ghost.add(e);
  }
  tallX.forEach(x => ghostBox(.6, 2.12, D, x, PL + 1.06, ZB));
  baseX.forEach(x => ghostBox(.6, HC, D, x, PL + HC / 2, ZB));
  islX.forEach(x => ghostBox(.6, HC, D, x, PL + HC / 2, ZI));
  baseX.forEach(x => ghostBox(.6, .74, .34, x, 1.85, .19));
  ghostBox(3.6, .04, .62, .6, TOP + .02, .31);
  ghostBox(2.5, .06, .96, .3, TOP + .03, 1.68);

  /* ---------------- Fronten, Sockel, Griffe ---------------- */
  const fronts = [], handles = [];
  const FZ = ZB + D / 2 + T / 2 + .001, FZI = ZI + D / 2 + T / 2 + .001;
  function front(w, h, x, y, z, mat = M.front) {
    const m = box(w - .004, h - .004, T, mat, x, y, z);
    m.userData.home = m.position.clone(); fronts.push(m); return m;
  }
  function handle(x, y, z, vertical = false, len = .3) {
    const m = box(vertical ? .012 : len, vertical ? len : .012, .022, M.brass, x, y, z + .02, null, { cast: false });
    m.userData.home = m.position.clone(); handles.push(m); return m;
  }
  // Hochschränke
  front(.6, 1.05, -2.1, PL + .525, FZ); handle(-1.83, PL + .9, FZ, true, .36);
  front(.6, 1.07, -2.1, PL + 1.05 + .535, FZ); handle(-1.83, PL + 1.3, FZ, true, .36);
  front(.6, .74, -1.5, PL + .37, FZ); handle(-1.23, PL + .5, FZ, true, .3);
  const oven = front(.6, .6, -1.5, PL + .74 + .3, FZ, M.glass); handle(-1.5, PL + 1.29, FZ, false, .44);
  front(.6, .78, -1.5, PL + 1.34 + .39, FZ); handle(-1.23, PL + 1.5, FZ, true, .3);
  // Unterschränke Rückzeile + Insel: je zwei Auszüge
  baseX.forEach(x => {
    front(.6, .46, x, PL + .23, FZ); handle(x, PL + .42, FZ);
    front(.6, .26, x, PL + .46 + .13, FZ); handle(x, PL + .68, FZ);
  });
  islX.forEach(x => {
    front(.6, .46, x, PL + .23, FZI); handle(x, PL + .42, FZI);
    front(.6, .26, x, PL + .46 + .13, FZI); handle(x, PL + .68, FZI);
  });
  // Hängeschränke: grifflos
  baseX.forEach(x => front(.6, .74, x, 1.85, .19 + .17 + T / 2 + .001));
  // Insel-Rückwand und Sockel
  const islBack = box(2.4, HC, T, M.front, .3, PL + HC / 2, ZI - D / 2 - T / 2 - .001); islBack.userData.home = islBack.position.clone(); fronts.push(islBack);
  // Wangen (Seitenblenden) in Frontfarbe
  [[T, TOP, D + 2 * T + .004, -0.9 - T / 2 - .002, TOP / 2, ZI], [T, TOP, D + 2 * T + .004, 1.5 + T / 2 + .002, TOP / 2, ZI],
   [T, TOP, D + T + .02, 2.4 + T / 2 + .002, TOP / 2, ZB + .01], [T, .74, .36 + T, 2.4 + T / 2 + .002, 1.85, .19 + .01],
   [T, 2.22, D + T + .02, -2.4 - T / 2 - .002, 1.11, ZB + .01], [T, 2.22 - TOP - .04, D + T + .02, -1.2 + T / 2 + .002, (2.22 + TOP + .04) / 2, ZB + .01]].forEach(([w, h, d, x, y, z]) => {
    const m = box(w, h, d, M.front, x, y, z); m.userData.home = m.position.clone(); fronts.push(m);
  });
  const plinths = [box(4.8, PL - .01, T, M.black, 0, PL / 2, ZB + D / 2 - .05, null, { cast: false }), box(2.4, PL - .01, T, M.black, .3, PL / 2, ZI + D / 2 - .05, null, { cast: false })];
  plinths.forEach(p => p.userData.home = p.position.clone());

  /* ---------------- Arbeitsplatten mit echten Ausschnitten ---------------- */
  function slab(x0, x1, z0, z1, y, t, mat, parent, holes) {
    // baut eine Platte aus Rahmenstücken um einen Ausschnitt herum
    const [hx0, hx1, hz0, hz1] = holes;
    const parts = [];
    const add = (a0, a1, b0, b1) => {
      if (a1 - a0 < .001 || b1 - b0 < .001) return;
      const cx = (a0 + a1) / 2, cz = (b0 + b1) / 2;
      parts.push(box(a1 - a0, t, b1 - b0, mat, cx, 0, cz, parent, { worldUV: mat === M.oak, oy: y }));
    };
    add(x0, hx0, z0, z1); add(hx1, x1, z0, z1); add(hx0, hx1, z0, hz0); add(hx0, hx1, hz1, z1);
    const piece = box(hx1 - hx0, t, hz1 - hz0, mat, (hx0 + hx1) / 2, 0, (hz0 + hz1) / 2, parent, { worldUV: mat === M.oak, oy: y });
    return { parts, piece };
  }
  const wtBack = new THREE.Group(); wtBack.position.y = TOP + .02; scene.add(wtBack);
  const SINK = [1.25, 1.75, .1, .5];
  const backSlab = slab(-1.2, 2.4, 0, .62, TOP + .02, .04, M.stone, wtBack, SINK);
  const wtIsl = new THREE.Group(); wtIsl.position.y = TOP + .03; scene.add(wtIsl);
  const HOLE = [-.1, .7, 1.55, 2.05];
  const islSlab = slab(-.95, 1.55, 1.2, 2.16, TOP + .03, .06, M.oak, wtIsl, HOLE);
  wtBack.userData.home = wtBack.position.clone(); wtIsl.userData.home = wtIsl.position.clone();
  // Nischenrückwand Eiche + LED-Leiste
  const niche = box(3.6, 1.48 - TOP - .04, .016, M.oak, .6, TOP + .04 + (1.48 - TOP - .04) / 2, .008, null, { worldUV: true, cast: false });
  niche.userData.home = niche.position.clone();
  const led = box(3.56, .008, .02, M.led, .6, 1.475, .33, null, { cast: false });

  // Kochfeld (flächenbündig, mit Muldenlüfter) + Spüle
  const hob = new THREE.Group(); scene.add(hob);
  box(.8, .006, .5, M.glass, 0, 0, 0, hob, { cast: false });
  box(.74, .07, .44, M.black, 0, -.04, 0, hob, { cast: false });
  const vent = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .002, 40), new THREE.MeshStandardMaterial({ color: '#202225', roughness: .5, metalness: .6 }));
  vent.position.set(0, .004, 0); hob.add(vent);
  const ringMat = new THREE.MeshBasicMaterial({ color: '#3a3d42' });
  for (const [x, z] of [[-.25, -.1], [-.25, .12], [.25, -.1], [.25, .12]]) {
    const r = new THREE.Mesh(new THREE.RingGeometry(.06, .064, 40), ringMat); r.rotation.x = -Math.PI / 2; r.position.set(x, .0035, z); hob.add(r);
  }
  const hobHome = new THREE.Vector3((HOLE[0] + HOLE[1]) / 2, TOP + .06 + .003, (HOLE[2] + HOLE[3]) / 2);
  hob.position.copy(hobHome);
  const sink = new THREE.Group(); scene.add(sink);
  box(.48, .18, .38, M.steel, 0, -.09, 0, sink, { cast: false });
  box(.44, .004, .34, M.black, 0, -.178, 0, sink, { cast: false });
  const tap = new THREE.Group(); sink.add(tap); tap.position.set(0, 0, -.25);
  const tapM = M.black;
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(.018, .022, .32, 16), tapM); t1.position.y = .16; tap.add(t1);
  const t2 = new THREE.Mesh(new THREE.TorusGeometry(.12, .014, 10, 24, Math.PI), tapM); t2.position.set(0, .32, .12); t2.rotation.y = Math.PI / 2; tap.add(t2);
  const t3 = new THREE.Mesh(new THREE.CylinderGeometry(.016, .016, .08, 12), tapM); t3.position.set(0, .28, .24); tap.add(t3);
  tap.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const sinkHome = new THREE.Vector3((SINK[0] + SINK[1]) / 2, TOP + .04, (SINK[2] + SINK[3]) / 2);
  sink.position.copy(sinkHome);

  /* ---------------- Laser: Kreuzlinienlaser auf Stativ ---------------- */
  const LZ = 3.1, LX = .3, LY = TOP + .04;
  const laserDev = new THREE.Group(); scene.add(laserDev);
  laserDev.position.set(LX, 0, LZ);
  box(.1, .1, .1, new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: .4 }), 0, LY, 0, laserDev);
  box(.09, .03, .02, M.sawRed, 0, LY + .02, -.051, laserDev, { cast: false });
  const lens = new THREE.Mesh(new THREE.SphereGeometry(.014, 12, 12), new THREE.MeshBasicMaterial({ color: '#ff3b2a', fog: false })); lens.position.set(0, LY, -.055); laserDev.add(lens);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, LY + .05, 6), M.black);
    leg.position.set(Math.cos(a) * .12, LY / 2 - .03, Math.sin(a) * .12);
    leg.rotation.z = Math.cos(a) * .25; leg.rotation.x = -Math.sin(a) * .25; laserDev.add(leg);
  }
  const lineH = box(1, .005, .004, M.laser, LX, LY, .004, null, { cast: false });
  const lineV = box(.005, 1, .004, M.laser, LX, 1.3, .004, null, { cast: false });
  const lineF = box(.005, .002, 1, M.laser, LX, .002, LZ / 2, null, { cast: false });
  const fanGeo = (n) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 9), 3)); return g; };
  const fanH = new THREE.Mesh(fanGeo(1), M.fan), fanV = new THREE.Mesh(fanGeo(1), M.fan);
  scene.add(fanH, fanV);
  function setTri(mesh, a, b, c) {
    const p = mesh.geometry.attributes.position; p.setXYZ(0, ...a); p.setXYZ(1, ...b); p.setXYZ(2, ...c); p.needsUpdate = true; mesh.geometry.computeBoundingSphere();
  }

  /* Maßketten (rote Linien) + HTML-Beschriftungen */
  const dimsEl = hero.querySelector('.dims');
  const dims = [];
  function dim(a, b, label, fn) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const len = A.distanceTo(B), mid = A.clone().add(B).multiplyScalar(.5);
    const g = new THREE.Group(); scene.add(g);
    const dir = B.clone().sub(A).normalize();
    const bar = new THREE.Mesh(new THREE.BoxGeometry(.004, .004, 1), M.laser);
    bar.position.copy(mid); bar.lookAt(B); g.add(bar);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(.004, .004, .08), M.laser), t2 = t1.clone();
    const up = Math.abs(dir.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    [t1, t2].forEach((t, i) => { t.position.copy(i ? B : A); t.lookAt(t.position.clone().add(up)); g.add(t); });
    const el = document.createElement('div'); el.className = 'dim'; el.innerHTML = '<b></b><i>' + label + '</i>';
    dimsEl.appendChild(el);
    const d = { g, bar, t1, t2, A, B, mid, len, el, val: el.querySelector('b'), fn, shown: -1 };
    dims.push(d); return d;
  }
  const fmt = v => Math.round(v).toLocaleString('de-DE');
  const dW = dim([-2.4, .006, .82], [2.4, .006, .82], 'Wandlänge', p => [seg(p, .07, .15), seg(p, .44, .5)]);
  const dH = dim([2.55, 0, .03], [2.55, LY, .03], 'Arbeitshöhe', p => [seg(p, .09, .15), seg(p, .44, .5)]);
  const dC = dim([HOLE[0], TOP + .075, HOLE[3] + .16], [HOLE[1], TOP + .075, HOLE[3] + .16], 'Ausschnitt', p => [seg(p, .6, .64), seg(p, .73, .76)]);

  /* ---------------- Säge + Funken ---------------- */
  const saw = new THREE.Group(); scene.add(saw);
  const sawBody = box(.24, .1, .13, M.saw, 0, .09, -.03, saw);
  box(.24, .02, .131, M.sawRed, 0, .13, -.03, saw, { cast: false });
  box(.06, .05, .03, M.saw, -.04, .16, -.03, saw);
  box(.3, .006, .18, M.steel, 0, .036, -.03, saw, { cast: false });
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(.075, .075, .003, 32), M.blade);
  blade.rotation.x = Math.PI / 2; blade.position.set(0, .03, 0); saw.add(blade);
  saw.visible = false;
  const kerfs = [];
  const path = [[HOLE[0], HOLE[2]], [HOLE[1], HOLE[2]], [HOLE[1], HOLE[3]], [HOLE[0], HOLE[3]], [HOLE[0], HOLE[2]]];
  const segLen = [], kTotal = (() => { let s = 0; for (let i = 0; i < 4; i++) { const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); segLen.push(l); s += l; } return s; })();
  for (let i = 0; i < 4; i++) { const k = box(1, .002, .004, M.kerf, 0, TOP + .0611, 0, null, { cast: false }); k.visible = false; kerfs.push(k); }

  const NS = mobile ? 260 : 520;
  const sp = { p: new Float32Array(NS * 3), v: new Float32Array(NS * 3), life: new Float32Array(NS), max: new Float32Array(NS), i: 0 };
  const sGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(NS * 6), sCol = new Float32Array(NS * 6);
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
  const sparks = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  sparks.frustumCulled = false; scene.add(sparks);
  function emit(x, y, z, dx, dz, n) {
    for (let k = 0; k < n; k++) {
      const i = sp.i = (sp.i + 1) % NS, j = i * 3;
      sp.p[j] = x; sp.p[j + 1] = y; sp.p[j + 2] = z;
      const s = 1.2 + Math.random() * 2.6;
      sp.v[j] = -dx * s + (Math.random() - .5) * 1.6;
      sp.v[j + 1] = .6 + Math.random() * 2.2;
      sp.v[j + 2] = -dz * s + (Math.random() - .5) * 1.6;
      sp.max[i] = sp.life[i] = .25 + Math.random() * .55;
    }
  }
  function stepSparks(dt) {
    let alive = 0;
    for (let i = 0; i < NS; i++) {
      const j = i * 3, o = i * 6;
      if (sp.life[i] <= 0) { sCol[o] = sCol[o + 1] = sCol[o + 2] = sCol[o + 3] = sCol[o + 4] = sCol[o + 5] = 0; continue; }
      alive++;
      sp.life[i] -= dt;
      sp.v[j + 1] -= 9.81 * dt;
      sp.p[j] += sp.v[j] * dt; sp.p[j + 1] += sp.v[j + 1] * dt; sp.p[j + 2] += sp.v[j + 2] * dt;
      if (sp.p[j + 1] < TOP + .062 && sp.v[j + 1] < 0 && sp.p[j + 1] > TOP) { sp.v[j + 1] *= -.35; sp.v[j] *= .6; sp.v[j + 2] *= .6; sp.p[j + 1] = TOP + .062; }
      const f = Math.max(0, sp.life[i] / sp.max[i]);
      sPos[o] = sp.p[j]; sPos[o + 1] = sp.p[j + 1]; sPos[o + 2] = sp.p[j + 2];
      sPos[o + 3] = sp.p[j] - sp.v[j] * .022; sPos[o + 4] = sp.p[j + 1] - sp.v[j + 1] * .022; sPos[o + 5] = sp.p[j + 2] - sp.v[j + 2] * .022;
      sCol[o] = 1.6 * f; sCol[o + 1] = (.75 + .4 * f) * f; sCol[o + 2] = .35 * f * f;
      sCol[o + 3] = .9 * f; sCol[o + 4] = .18 * f; sCol[o + 5] = .02 * f;
    }
    sGeo.attributes.position.needsUpdate = true; sGeo.attributes.color.needsUpdate = true;
    return alive;
  }

  /* ---------------- Kamerafahrt ---------------- */
  const KP = [0, .12, .26, .42, .56, .68, .8, .92, 1];
  const POS = [[1.2, 1.7, 7.4], [-.3, 1.45, 5.6], [-3.4, 2.3, 5.3], [2.9, 1.75, 5.1], [1.9, 3.3, 4.5], [1.05, 1.95, 3.3], [-1.9, 1.45, 4.2], [3.9, 2.3, 6.8], [4.6, 2.6, 7.6]];
  const TGT = [[-.2, 1.05, .6], [.25, 1.0, .2], [.1, .95, .9], [.1, 1.0, .8], [.3, .8, 1.2], [.3, .88, 1.8], [.5, 1.0, .9], [.2, 1.0, .9], [.25, 1.0, .9]];
  const cPos = new THREE.CatmullRomCurve3(POS.map(a => new THREE.Vector3(...a)), false, 'centripetal');
  const cTgt = new THREE.CatmullRomCurve3(TGT.map(a => new THREE.Vector3(...a)), false, 'centripetal');
  const camP = new THREE.Vector3(), camT = new THREE.Vector3();
  function camAt(p) {
    let i = 0; while (i < KP.length - 2 && p > KP[i + 1]) i++;
    const lt = eInOut(seg(p, KP[i], KP[i + 1]));
    const u = (i + lt) / (KP.length - 1);
    cPos.getPoint(u, camP); cTgt.getPoint(u, camT);
  }

  /* ---------------- HUD ---------------- */
  const steps = [...hero.querySelectorAll('[data-step]')];
  const RANGES = [[0, .15], [.15, .37], [.37, .5], [.5, .61], [.61, .76], [.76, .87], [.87, 1.01]];
  const capEl = hero.querySelector('.cap');
  const mmEl = hero.querySelector('[data-mm]');
  const tapeEl = hero.querySelector('.tape i');
  let lastStep = -1;

  /* ---------------- Zustand pro Fortschritt ---------------- */
  const tmp = new THREE.Vector3();
  const ranks = carcs.map((c, i) => i);
  function apply(p, dt) {
    // Laser
    const lOn = seg(p, .03, .06) * (1 - seg(p, .5, .56));
    laserDev.visible = p < .56;
    laserDev.scale.setScalar(Math.max(.001, 1 - seg(p, .5, .56)));
    lens.scale.setScalar(1 + .6 * Math.abs(Math.sin(perfNow * 3)) * (1 - seg(p, .03, .06)));
    const grow = eOut(seg(p, .05, .11));
    const hx0 = LX - (LX + 2.4) * grow, hx1 = LX + (2.4 - LX) * grow;
    lineH.scale.x = Math.max(.001, hx1 - hx0); lineH.position.x = (hx0 + hx1) / 2;
    lineV.scale.y = Math.max(.001, 2.6 * grow); lineV.position.y = LY + (1.3 - LY) * grow;
    lineF.scale.z = Math.max(.001, LZ * grow); lineF.position.z = LZ - LZ * grow / 2;
    M.laser.opacity = lOn * (.85 + .15 * Math.sin(perfNow * 40));
    [lineH, lineV, lineF, fanH, fanV].forEach(o => o.visible = lOn > .01);
    M.fan.opacity = .075 * lOn;
    const dev = [LX, LY, LZ - .06];
    setTri(fanH, dev, [hx0, LY, .004], [hx1, LY, .004]);
    setTri(fanV, dev, [LX, LY - LY * grow, .004], [LX, LY + (2.6 - LY) * grow, .004]);

    // Blaupause
    M.ghost.opacity = (.2 + .35 * seg(p, .08, .14)) * (1 - seg(p, .45, .55));
    ghost.visible = M.ghost.opacity > .005;

    // Korpusse fliegen ein
    carcs.forEach((c, i) => {
      const a = .15 + i * .016, t = seg(p, a, a + .05);
      const e = eOut(t);
      c.visible = t > 0;
      const h = c.userData.home;
      const side = i % 2 ? 1 : -1;
      c.position.set(h.x + side * (1 - e) * .8, h.y + (1 - eBack(t)) * 2.4, h.z + (1 - e) * 1.2);
      c.rotation.set((1 - e) * .5 * side, (1 - e) * .9 * side, (1 - e) * .3);
    });
    walls.forEach((c, i) => {
      const a = .37 + i * .008, t = seg(p, a, a + .04), e = eOut(t);
      c.visible = t > 0;
      const h = c.userData.home;
      c.position.set(h.x, h.y + (1 - eBack(t)) * 1.6, h.z + (1 - e) * .8);
      c.rotation.set(0, 0, (1 - e) * .4);
    });
    // Fronten schnappen ein
    const nF = fronts.length;
    fronts.forEach((f, i) => {
      const a = .4 + (i / nF) * .085, t = seg(p, a, a + .02);
      f.visible = t > 0;
      const h = f.userData.home, b = eBack(t);
      f.position.set(h.x, h.y, h.z + (1 - b) * .45);
      f.scale.setScalar(.85 + .15 * Math.min(1, b));
    });
    plinths.forEach((pl, i) => { const t = seg(p, .47 + i * .01, .49 + i * .01); pl.visible = t > 0; pl.position.z = pl.userData.home.z + (1 - eOut(t)) * .3; });

    // Arbeitsplatten
    const tb = seg(p, .5, .56), ti = seg(p, .55, .61);
    wtBack.visible = tb > 0; wtIsl.visible = ti > 0;
    wtBack.position.y = wtBack.userData.home.y + (1 - eOut(tb)) * 1.4;
    wtIsl.position.y = wtIsl.userData.home.y + (1 - eOut(ti)) * 1.4;
    wtIsl.rotation.y = (1 - eOut(ti)) * .25;
    const tn = seg(p, .53, .58); niche.visible = tn > 0; niche.position.z = niche.userData.home.z + (1 - eOut(tn)) * .5;

    // Ausschnitt sägen
    const ts = seg(p, .615, .71);
    const sawing = ts > 0 && ts < 1;
    saw.visible = sawing;
    let dist = ts * kTotal, sx = path[0][0], sz = path[0][1], dx = 1, dz = 0;
    for (let k = 0; k < 4; k++) {
      const a = path[k], b = path[k + 1], L = segLen[k];
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      const d = clamp(dist, 0, L);
      const kf = kerfs[k];
      kf.visible = d > .002 && ts < 1.01 && p < .735;
      if (kf.visible) {
        kf.scale.x = d; kf.position.x = a[0] + ux * d / 2; kf.position.z = a[1] + uz * d / 2;
        kf.rotation.y = -Math.atan2(uz, ux);
      }
      if (dist >= 0 && dist <= L) { sx = a[0] + ux * d; sz = a[1] + uz * d; dx = ux; dz = uz; }
      dist -= L;
    }
    if (sawing) {
      saw.position.set(sx, TOP + .06, sz);
      saw.rotation.y = -Math.atan2(dz, dx);
      blade.rotation.y += dt * 60;
      sawLight.position.set(sx, TOP + .12, sz);
      sawLight.intensity = 1.6 + Math.random() * 1.6;
      if (!reduce) emit(sx, TOP + .065, sz, dx, dz, Math.ceil(dt * (mobile ? 280 : 520)));
    } else sawLight.intensity = 0;

    // Stück fällt raus, Kochfeld senkt sich
    const td = seg(p, .71, .735);
    const piece = islSlab.piece;
    piece.visible = td < 1 && p > .0;
    piece.position.y = -eInOut(td) * .9; piece.rotation.z = td * .3;
    const th = seg(p, .735, .765);
    hob.visible = th > 0;
    hob.position.set(hobHome.x, hobHome.y + (1 - eOut(th)) * .9, hobHome.z);
    // Spüle
    const tp = seg(p, .7, .725);
    backSlab.piece.visible = tp < 1;
    backSlab.piece.position.y = eInOut(tp) * .7; backSlab.piece.position.z = (SINK[2] + SINK[3]) / 2 + eInOut(tp) * .6;
    const tk = seg(p, .73, .76);
    sink.visible = tk > 0;
    sink.position.set(sinkHome.x, sinkHome.y + (1 - eOut(tk)) * .9, sinkHome.z);

    // Griffe klicken ein
    handles.forEach((h, i) => {
      const a = .765 + i * (.06 / handles.length), t = seg(p, a, a + .012);
      h.visible = t > 0; const b = eBack(t);
      h.scale.setScalar(Math.max(.001, b));
      h.position.z = h.userData.home.z + (1 - Math.min(1, b)) * .08;
    });

    // Licht an
    const tl = eInOut(seg(p, .83, .88));
    led.visible = tl > 0.01;
    M.led.color.setRGB(1 * tl + .05, .81 * tl + .04, .59 * tl + .03);
    ledLights.forEach(l => l.intensity = 2.6 * tl);
    sun.intensity = 2.4 - .7 * tl;
    hemi.intensity = .55 - .2 * tl;
    renderer.toneMappingExposure = 1.05 + .1 * tl;

    // Kamera
    camAt(p);
    const edge = Math.max(1 - seg(p, 0, .07), seg(p, .88, .97));
    if (camera.aspect >= 1) camT.x -= 1.35 * edge * Math.min(1, (camera.aspect - .9) * 1.5);
    else camT.y -= .55 * edge;
    camera.position.copy(camP);
    const dir = tmp.copy(camP).sub(camT);
    dir.multiplyScalar(fitK);
    camera.position.copy(camT).add(dir);
    camera.position.x += par.x * .25; camera.position.y += par.y * .15;
    camera.lookAt(camT);

    // Maßketten
    for (const d of dims) {
      const [inn, out] = d.fn(p);
      const vis = inn > 0 && out < 1;
      d.g.visible = vis;
      d.el.style.opacity = vis ? (Math.min(1, inn * 3) * (1 - out)).toFixed(3) : 0;
      if (!vis) continue;
      const e = eOut(inn);
      const P = d.A.clone().lerp(d.B, e);
      d.bar.position.copy(d.A.clone().add(P).multiplyScalar(.5));
      d.bar.scale.z = Math.max(.001, d.len * e);
      d.t2.position.copy(P);
      const mm = d.len * 1000 * e;
      const v = d === dC ? fmt(Math.round(800 * e)) + ' × ' + fmt(Math.round(500 * e)) : fmt(mm);
      if (v !== d.shown) { d.val.textContent = v + ' mm'; d.shown = v; }
      P.copy(d.A).lerp(d.B, Math.min(.5, e / 2 + .0)).project(camera);
      const x = (P.x * .5 + .5) * W, y = (-P.y * .5 + .5) * H;
      d.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    }

    // HUD
    let si = RANGES.findIndex(r => p >= r[0] && p < r[1]); if (si < 0) si = 6;
    if (si !== lastStep) {
      steps.forEach((s, i) => { s.classList.toggle('on', i === si); s.classList.toggle('done', i < si); });
      const s = steps[si];
      if (capEl && s) { capEl.innerHTML = `<span>${s.dataset.n} / 07</span><strong>${s.dataset.t}</strong><em>${s.dataset.d}</em>`; capEl.classList.remove('in'); void capEl.offsetWidth; capEl.classList.add('in'); }
      lastStep = si;
    }
    if (mmEl) mmEl.textContent = fmt(p * 4800);
    if (tapeEl) tapeEl.style.transform = `scaleX(${p.toFixed(4)})`;
    hero.style.setProperty('--p', p.toFixed(4));
    hero.classList.toggle('is-done', p > .9);
    hero.classList.toggle('is-start', p < .035);
  }

  /* ---------------- Größe, Scroll, Loop ---------------- */
  let W = 1, H = 1, fitK = 1;
  const par = { x: 0, y: 0, tx: 0, ty: 0 };
  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = camera.aspect < .8 ? 52 : camera.aspect < 1.2 ? 46 : 38;
    fitK = camera.aspect < .6 ? 1.35 : camera.aspect < .8 ? 1.2 : camera.aspect < 1.2 ? 1.08 : 1;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', () => { resize(); warm = 0; }, { passive: true });
  resize();
  if (matchMedia('(pointer:fine)').matches && !reduce) addEventListener('pointermove', e => { par.tx = (e.clientX / innerWidth - .5); par.ty = -(e.clientY / innerHeight - .5); }, { passive: true });

  function target() {
    if (reduce) return 1;
    const r = hero.getBoundingClientRect();
    const range = r.height - innerHeight;
    return range > 0 ? clamp(-r.top / range) : 1;
  }
  let prog = target(), perfNow = 0, last = performance.now(), visible = true, raf = 0;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }, { rootMargin: '100px' });
  io.observe(hero);
  let warm = 0;
  function loop(now) {
    raf = 0;
    const dt = Math.min(.05, Math.max(.001, (now - last) / 1000)); last = now; perfNow = now / 1000;
    const tgt = target();
    prog += (tgt - prog) * (reduce || QA ? 1 : Math.min(1, dt * 7));
    if (Math.abs(tgt - prog) < .0002) prog = tgt;
    par.x += (par.tx - par.x) * Math.min(1, dt * 3); par.y += (par.ty - par.y) * Math.min(1, dt * 3);
    apply(prog, dt);
    const alive = stepSparks(dt);
    renderer.render(scene, camera);
    const busy = warm++ < 3 || prog !== tgt || alive > 0 || (((prog > .615 && prog < .71) || prog < .03) && !QA) || Math.abs(par.tx - par.x) > .001 || Math.abs(par.ty - par.y) > .001;
    if (visible && busy) raf = requestAnimationFrame(loop);
  }
  function wake() { if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', wake, { passive: true });
  addEventListener('pointermove', wake, { passive: true });
  apply(prog, 0.016); renderer.render(scene, camera);
  hero.classList.add('gl-ready');
  window.__montage = { set: v => { prog = v; } };
  raf = requestAnimationFrame(loop);
}

function makeWood() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#9c6537'); grad.addColorStop(.5, '#ab7444'); grad.addColorStop(1, '#935e33');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 340; i++) {
    const y = rnd() * S, dark = rnd() < .62;
    g.strokeStyle = dark ? `rgba(84,46,18,${.04 + rnd() * .13})` : `rgba(236,196,150,${.03 + rnd() * .08})`;
    g.lineWidth = .5 + rnd() * 2.6;
    const k1 = 1 + Math.floor(rnd() * 3), k2 = 2 + Math.floor(rnd() * 5), a1 = 2 + rnd() * 9, a2 = rnd() * 3, ph = rnd() * 6.28;
    g.beginPath();
    for (let x = 0; x <= S; x += 8) {
      const yy = y + Math.sin(x / S * 6.2832 * k1 + ph) * a1 + Math.sin(x / S * 6.2832 * k2 + ph * 2) * a2;
      x ? g.lineTo(x, yy) : g.moveTo(x, yy);
    }
    g.stroke();
  }
  for (let k = 0; k < 5; k++) {
    const x = rnd() * S, y = rnd() * S, r = 6 + rnd() * 10;
    const rg = g.createRadialGradient(x, y, 0, x, y, r * 2.4);
    rg.addColorStop(0, 'rgba(60,30,10,.75)'); rg.addColorStop(.4, 'rgba(90,50,20,.35)'); rg.addColorStop(1, 'rgba(90,50,20,0)');
    g.fillStyle = rg; g.beginPath(); g.ellipse(x, y, r * 3, r * 1.2, 0, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
