/* ============================================================
   TREINADO PRA MATAR — núcleo compartilhado (cliente + servidor)
   Armas, mapa, física, simulação autoritativa, bots, XP/níveis.
   ============================================================ */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.SHARED = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- constantes
  const C = {
    GRAV: 22, JUMP: 7.2, WALK: 5.0, SPRINT: 7.4, CROUCH: 2.4,
    R: 0.38, H: 1.8, HC: 1.2, EYE: 1.62, EYEC: 1.05, STEP: 0.55,
    DMG_BODY: 10, DMG_HEAD: 20, // dano por tiro acertado: peito/corpo 10, cabeça 20
    TICK: 1 / 30, MAXHP: 100, MEDHEAL: 50, MEDTIME: 1.6, RESPAWN: 3.5,
    MEDKITS_START: 2, MEDKITS_MAX: 3, SWITCH: 0.45, INTERP: 0.1,
    SPAWN_PROT: 1.5, MEDKIT_RESPAWN: 20,
  };
  const BTN = { JUMP: 1, CROUCH: 2, SPRINT: 4, ADS: 8 };

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);

  // ---------------------------------------------------------------- armas
  const WEAPONS = {
    pistol: { id: 'pistol', name: 'Pistola G17', slot: 1, dmg: 24, pellets: 1, rpm: 420, mag: 15, reserve: 75, reload: 1.4, spread: 0.014, adsSpread: 0.005, moveMul: 1.6, bloom: 0.006, bloomMax: 0.03, recoil: 0.018, recoilYaw: 0.006, range: 30, auto: false, head: 2.0, price: 0, level: 1, zoom: 1.15, speed: 1.0, snd: { f: 1500, d: 0.12, v: 0.7, b: 95 }, sightY: 0.075 },
    deagle: { id: 'deagle', name: 'Desert Eagle', slot: 1, dmg: 56, pellets: 1, rpm: 200, mag: 7, reserve: 35, reload: 1.9, spread: 0.022, adsSpread: 0.006, moveMul: 1.8, bloom: 0.02, bloomMax: 0.06, recoil: 0.06, recoilYaw: 0.015, range: 45, auto: false, head: 2.1, price: 1200, level: 2, zoom: 1.2, speed: 0.97, snd: { f: 700, d: 0.3, v: 1.0, b: 60 }, sightY: 0.085 },
    ak47: { id: 'ak47', name: 'AK-47', slot: 0, dmg: 31, pellets: 1, rpm: 600, mag: 30, reserve: 120, reload: 2.5, spread: 0.024, adsSpread: 0.007, moveMul: 1.8, bloom: 0.006, bloomMax: 0.05, recoil: 0.021, recoilYaw: 0.009, range: 55, auto: true, head: 2.0, price: 2700, level: 2, zoom: 1.3, speed: 0.9, snd: { f: 900, d: 0.22, v: 1.0, b: 70 }, sightY: 0.075 },
    m4a1: { id: 'm4a1', name: 'M4A1', slot: 0, dmg: 27, pellets: 1, rpm: 760, mag: 30, reserve: 120, reload: 2.2, spread: 0.018, adsSpread: 0.005, moveMul: 1.7, bloom: 0.005, bloomMax: 0.04, recoil: 0.015, recoilYaw: 0.006, range: 60, auto: true, head: 2.0, price: 3100, level: 4, zoom: 1.35, speed: 0.92, snd: { f: 1150, d: 0.18, v: 0.9, b: 80 }, sightY: 0.095 },
    doze: { id: 'doze', name: 'Doze Nova (cal. 12)', slot: 0, dmg: 15, pellets: 8, rpm: 68, mag: 8, reserve: 32, reload: 3.0, spread: 0.075, adsSpread: 0.06, moveMul: 1.2, bloom: 0, bloomMax: 0, recoil: 0.07, recoilYaw: 0.02, range: 12, auto: false, head: 1.5, price: 2000, level: 3, zoom: 1.1, speed: 0.9, snd: { f: 480, d: 0.38, v: 1.1, b: 50 }, sightY: 0.07 },
    smg: { id: 'smg', name: 'Submetralhadora MP5', slot: 0, dmg: 21, pellets: 1, rpm: 850, mag: 30, reserve: 150, reload: 2.0, spread: 0.022, adsSpread: 0.011, moveMul: 1.3, bloom: 0.004, bloomMax: 0.035, recoil: 0.011, recoilYaw: 0.006, range: 25, auto: true, head: 1.8, price: 0, level: 1, zoom: 1.2, speed: 1.0, snd: { f: 1700, d: 0.12, v: 0.7, b: 100 }, sightY: 0.08 },
    sniper: { id: 'sniper', name: 'Sniper AWM .338', slot: 0, dmg: 115, pellets: 1, rpm: 42, mag: 5, reserve: 25, reload: 3.4, spread: 0.09, adsSpread: 0.0008, moveMul: 2.0, bloom: 0, bloomMax: 0, recoil: 0.1, recoilYaw: 0.01, range: 200, auto: false, head: 2.5, price: 4500, level: 5, zoom: 4.5, scope: true, speed: 0.82, snd: { f: 380, d: 0.6, v: 1.25, b: 45 }, sightY: 0.1 },
  };
  const WEAPON_LIST = ['ak47', 'm4a1', 'doze', 'smg', 'sniper', 'pistol', 'deagle'];

  const UNIFORMS = {
    woodland: { id: 'woodland', name: 'Floresta', price: 0, level: 1, c: ['#4b5a32', '#2f3a22', '#6b6a45', '#1f221a'] },
    desert: { id: 'desert', name: 'Deserto', price: 0, level: 1, c: ['#b59b6a', '#8d7550', '#d2bd8e', '#6e5a3c'] },
    urban: { id: 'urban', name: 'Urbano', price: 800, level: 3, c: ['#6d7075', '#45484d', '#9a9da2', '#2b2d30'] },
    blackops: { id: 'blackops', name: 'Black Ops', price: 1500, level: 5, c: ['#25272a', '#151617', '#34373b', '#0c0c0d'] },
    arctic: { id: 'arctic', name: 'Ártico', price: 1500, level: 6, c: ['#d9dde0', '#a9b0b6', '#f2f4f5', '#7d868d'] },
    navy: { id: 'navy', name: 'Marinha', price: 2000, level: 8, c: ['#2b3b57', '#1b2740', '#41567a', '#121a2b'] },
  };
  const UPGRADES = {
    medbag: { id: 'medbag', name: 'Mochila Médica (+1 kit por vida)', price: 2000, level: 3 },
  };
  // ---------------------------------------------------------------- lojinha: skins masculinas, blusas, calças e skins de armas
  // (só aparência — não mudam dano, vida nem velocidade)
  const COSMETICS = {
    ch_soldado: { type: 'char', name: 'Soldado', price: 0, level: 1, gear: 'helmet', beard: 'stubble' },
    ch_veterano: { type: 'char', name: 'Veterano', price: 900, level: 1, tone: 2, gear: 'cap', beard: 'full', hair: [0.5, 0.5, 0.5] },
    ch_comandante: { type: 'char', name: 'Comandante', price: 1400, level: 1, tone: 0, gear: 'beret', beard: 'mustache', hair: [0.1, 0.08, 0.06] },
    ch_rebelde: { type: 'char', name: 'Rebelde', price: 1400, level: 1, tone: 3, gear: 'bandana', beard: 'stubble', glasses: 1, hair: [0.05, 0.05, 0.05] },
    ch_noturno: { type: 'char', name: 'Operador Noturno', price: 2200, level: 1, tone: 1, gear: 'balaclava' },
    ch3_cyber: { type: 'char', name: 'Cyberpunk', price: 2500, level: 1, tone: 0, gear: 'balaclava', model: 'char_cyber' }, // personagem 3D
    ch3_carter: { type: 'char', name: 'Carter', price: 2000, level: 1, tone: 0, gear: 'cap', model: 'char_carter' }, // personagem 3D
    ch_cowboy: { type: 'char', name: 'Cowboy', price: 1600, level: 1, tone: 0, gear: 'cowboy', outfit: 'cowboy', hair: [0.1, 0.08, 0.11] }, // visual completo: chapéu, lenço, jaqueta, jeans e botas
    sh_ang_azul: { type: 'shirt', name: 'Blusa Angelical Azul', price: 1300, level: 1, col: [40, 115, 240] },
    sh_ang_vermelha: { type: 'shirt', name: 'Blusa Angelical Vermelha', price: 1300, level: 1, col: [225, 40, 48] },
    sh_ang_amarela: { type: 'shirt', name: 'Blusa Angelical Amarela', price: 1300, level: 1, col: [245, 200, 35] },
    pa_ang_azul: { type: 'pants', name: 'Calça Angelical Azul', price: 1300, level: 1, col: [40, 115, 240] },
    pa_ang_vermelha: { type: 'pants', name: 'Calça Angelical Vermelha', price: 1300, level: 1, col: [225, 40, 48] },
    pa_ang_amarela: { type: 'pants', name: 'Calça Angelical Amarela', price: 1300, level: 1, col: [245, 200, 35] },
    // calças 3D (vestem o soldado realista)
    pa3_camo: { type: 'pants', name: 'Calça Camuflada F2505', price: 1500, level: 1, col: [128, 130, 84], model: 'pants_camo' },
    pa3_cargo: { type: 'pants', name: 'Calça Cargo com Botas', price: 1800, level: 1, col: [44, 44, 48], model: 'pants_cargo', boots: 1 },
    ws_ak47_ouro: { type: 'wskin', weapon: 'ak47', pat: 'ouro', name: 'AK-47 Dourada', price: 2500, level: 1 },
    ws_ak47_magma: { type: 'wskin', weapon: 'ak47', pat: 'magma', name: 'AK-47 Magma', price: 1800, level: 1 },
    ws_m4a1_gelo: { type: 'wskin', weapon: 'm4a1', pat: 'gelo', name: 'M4A1 Glacial', price: 1800, level: 1 },
    ws_m4a1_neon: { type: 'wskin', weapon: 'm4a1', pat: 'neon', name: 'M4A1 Neon', price: 1500, level: 1 },
    ws_smg_neon: { type: 'wskin', weapon: 'smg', pat: 'neon', name: 'MP5 Neon', price: 1200, level: 1 },
    ws_deagle_ouro: { type: 'wskin', weapon: 'deagle', pat: 'ouro', name: 'Desert Eagle Dourada', price: 1500, level: 1 },
    ws_doze_magma: { type: 'wskin', weapon: 'doze', pat: 'magma', name: 'Doze Nova Magma', price: 1500, level: 1 },
    ws_sniper_selva: { type: 'wskin', weapon: 'sniper', pat: 'selva', name: 'Sniper AWM Selva', price: 1500, level: 1 },
    ws_pistol_gelo: { type: 'wskin', weapon: 'pistol', pat: 'gelo', name: 'Pistola G17 Glacial', price: 900, level: 1 },
  };
  for (const k in COSMETICS) COSMETICS[k].id = k;
  const isCos = (id, t) => typeof id === 'string' && !!COSMETICS[id] && COSMETICS[id].type === t;
  // aparência enviada para os outros jogadores: {c: personagem, s: blusa, p: calça, w: {arma: skin}}
  function sanitizeLook(l) {
    const o = { c: 'ch_soldado', s: '', p: '', w: {} };
    if (!l || typeof l !== 'object') return o;
    if (isCos(l.c, 'char')) o.c = l.c;
    if (isCos(l.s, 'shirt')) o.s = l.s;
    if (isCos(l.p, 'pants')) o.p = l.p;
    if (l.w && typeof l.w === 'object') for (const k in l.w) if (WEAPONS[k] && isCos(l.w[k], 'wskin') && COSMETICS[l.w[k]].weapon === k) o.w[k] = l.w[k];
    return o;
  }
  function lookOf(prof) { const c = prof.cos || {}; return sanitizeLook({ c: c.char, s: c.shirt, p: c.pants, w: c.wskins }); }

  // ---------------------------------------------------------------- mapa
  // Caixa: [x0,y0,z0,x1,y1,z1,tipo,cor]
  function builder() {
    const solids = [], deco = [];
    function add(x0, y0, z0, x1, y1, z1, t, solid = true, col = null) {
      const b = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), t, col];
      (solid ? solids : deco).push(b);
      return b;
    }
    const bx = (cx, cz, w, d, h, t, y0 = 0, col = null) => add(cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, t, true, col);
    function wall(along, c, a0, a1, th, h, t, openings = [], y0 = 0) {
      openings = openings.slice().sort((p, q) => p.a - q.a);
      let cur = a0;
      const seg = (s0, s1, yA, yB) => {
        if (s1 - s0 < 0.01 || yB - yA < 0.01) return;
        if (along === 'x') add(s0, y0 + yA, c - th / 2, s1, y0 + yB, c + th / 2, t);
        else add(c - th / 2, y0 + yA, s0, c + th / 2, y0 + yB, s1, t);
      };
      for (const o of openings) {
        const o0 = o.a - o.w / 2, o1 = o.a + o.w / 2;
        seg(cur, o0, 0, h); seg(o0, o1, 0, o.y0); seg(o0, o1, o.y1, h); cur = o1;
      }
      seg(cur, a1, 0, h);
    }
    const door = (a, w = 1.6, y1 = 2.3) => ({ a, w, y0: 0, y1 });
    const win = (a, w = 1.4) => ({ a, w, y0: 1.0, y1: 2.0 });
    function house(cx, cz, w, d, h, doorSide, t) {
      const th = 0.25, x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
      wall('x', z0 + th / 2, x0, x1, th, h, t, doorSide < 0 ? [door(cx - 1.5), win(cx + 2.5)] : [win(cx - 2.5), win(cx + 2.5)]);
      wall('x', z1 - th / 2, x0, x1, th, h, t, doorSide > 0 ? [door(cx - 1.5), win(cx + 2.5)] : [win(cx - 2.5), win(cx + 2.5)]);
      wall('z', x0 + th / 2, z0 + th, z1 - th, th, h, t, [win(cz)]);
      wall('z', x1 - th / 2, z0 + th, z1 - th, th, h, t, [door(cz)]);
      add(x0 - 0.2, h, z0 - 0.2, x1 + 0.2, h + 0.25, z1 + 0.2, 'roof');
    }
    return { solids, deco, add, bx, wall, door, win, house };
  }
  const MAP_BASE = (function () {
    const { solids, deco, add, bx, wall, door, win, house } = builder();
    const S = 45; // meia largura
    // perímetro
    bx(0, -S, 2 * S + 2, 1, 5, 'concrete'); bx(0, S, 2 * S + 2, 1, 5, 'concrete');
    bx(-S, 0, 1, 2 * S, 5, 'concrete'); bx(S, 0, 1, 2 * S, 5, 'concrete');
    // ruas (decoração)
    add(-S, 0, -4, S, 0.02, 4, 'road', false);
    add(-3, 0, -S, 3, 0.021, S, 'road', false);
    // casas
    house(-20, -14, 10, 8, 3.4, 1, 'brick');
    house(-20, 14, 10, 8, 3.4, -1, 'brick');
    house(20, -14, 10, 8, 3.4, 1, 'brick');
    house(20, 14, 10, 8, 3.4, -1, 'brick');
    bx(-21, -15.5, 1.2, 1.2, 0.8, 'crate'); bx(19, 15.5, 1.2, 1.2, 0.8, 'crate');
    bx(-18, 15.5, 2, 1, 0.9, 'wood'); bx(22, -15.5, 2, 1, 0.9, 'wood');
    // galpão central (norte) com escada para o telhado
    {
      const th = 0.3, x0 = -8, x1 = 8, z0 = 19, z1 = 29, h = 4.5;
      wall('x', z0 + th / 2, x0, x1, th, h, 'concrete', [door(-4, 3, 3.2), win(4, 2)]);
      wall('x', z1 - th / 2, x0, x1, th, h, 'concrete', [door(3, 3, 3.2)]);
      wall('z', x0 + th / 2, z0 + th, z1 - th, th, h, 'concrete', [door(24, 3, 3.2)]);
      wall('z', x1 - th / 2, z0 + th, z1 - th, th, h, 'concrete', [win(26, 2)]);
      add(x0, h, z0, x1, 4.7, z1, 'roof');
      // parapeito
      add(x0, 4.7, z0, x1, 5.6, z0 + 0.2, 'concrete');
      add(x0, 4.7, z1 - 0.2, x1, 5.6, z1, 'concrete');
      add(x0, 4.7, z0 + 0.2, x0 + 0.2, 5.6, z1 - 0.2, 'concrete');
      add(x1 - 0.2, 4.7, z0 + 0.2, x1, 5.6, 24, 'concrete');
      add(x1 - 0.2, 4.7, 25.6, x1, 5.6, z1 - 0.2, 'concrete');
      for (let i = 0; i < 9; i++) { const z = 24 - 0.6 * (9 - i); add(8, 0, z, 9.6, 0.47 * (i + 1), z + 0.6, 'concrete'); }
      add(8, 0, 24, 9.6, 4.7, 25.6, 'concrete');
      bx(-5, 26, 1.2, 1.2, 1.2, 'crate'); bx(-5, 26, 1.2, 1.2, 1.2, 'crate', 1.2); bx(-3.6, 26.2, 1.2, 1.2, 1.2, 'crate');
      bx(4, 22, 3, 1.2, 1.0, 'metal', 0, [0.35, 0.37, 0.4]);
      bx(0.5, 27, 1.2, 1.2, 1.2, 'crate');
    }
    // base militar (sul): torre de vigia + bunkers
    {
      add(-2, 4.0, -32, 2, 4.25, -28, 'metal', true, [0.4, 0.42, 0.38]);
      for (const [x, z] of [[-1.85, -31.85], [1.85, -31.85], [-1.85, -28.15], [1.85, -28.15]]) add(x - 0.15, 0, z - 0.15, x + 0.15, 4.0, z + 0.15, 'metal', true, [0.3, 0.3, 0.28]);
      add(-2, 4.25, -32, 2, 5.25, -31.9, 'metal', true, [0.4, 0.42, 0.38]);
      add(-2, 4.25, -28.1, 2, 5.25, -28, 'metal', true, [0.4, 0.42, 0.38]);
      add(1.9, 4.25, -31.9, 2, 5.25, -28.1, 'metal', true, [0.4, 0.42, 0.38]);
      add(-2, 4.25, -31.9, -1.9, 5.25, -30.8, 'metal', true, [0.4, 0.42, 0.38]);
      add(-2, 4.25, -29.2, -1.9, 5.25, -28.1, 'metal', true, [0.4, 0.42, 0.38]);
      add(-2, 6.6, -32.2, 2, 6.8, -27.8, 'roof');
      for (const [x, z] of [[-1.95, -31.95], [1.95, -31.95], [-1.95, -28.05], [1.95, -28.05]]) add(x - 0.05, 5.25, z - 0.05, x + 0.05, 6.6, z + 0.05, 'metal', true, [0.3, 0.3, 0.28]);
      for (let i = 0; i < 9; i++) { const x = -2 - 0.6 * (9 - i); add(x, 0, -30.8, x + 0.6, 0.425 * (i + 1), -29.2, 'wood'); }
      // bunkers de sacos de areia
      for (const s of [-1, 1]) {
        bx(10 * s, -24, 5, 0.8, 1.1, 'sandbag');
        bx(10 * s - 2.1, -22.4, 0.8, 2.4, 1.1, 'sandbag');
        bx(10 * s + 2.1, -22.4, 0.8, 2.4, 1.1, 'sandbag');
      }
      bx(0, -20, 4, 0.8, 1.1, 'sandbag');
      bx(-8, -37, 6, 4, 3.2, 'concrete'); // depósito
      bx(8, -38, 3, 3, 1.5, 'metal', 0, [0.33, 0.36, 0.25]);
    }
    // contêineres
    bx(-26, -32, 6, 2.5, 2.6, 'metal', 0, [0.25, 0.4, 0.3]);
    bx(26, 32, 6, 2.5, 2.6, 'metal', 0, [0.55, 0.22, 0.16]);
    bx(-30, 30, 2.5, 6, 2.6, 'metal', 0, [0.22, 0.32, 0.5]);
    bx(26, -34, 6, 2.5, 2.6, 'metal', 0, [0.7, 0.42, 0.14]);
    bx(26, -34, 6, 2.5, 2.6, 'metal', 2.6, [0.22, 0.32, 0.5]);
    bx(-34, -36, 2.5, 6, 2.6, 'metal', 0, [0.55, 0.22, 0.16]);
    // becos (muros)
    for (const sz of [-1, 1]) {
      bx(-28, 17 * sz, 0.4, 14, 3, 'brick');
      bx(28, 17 * sz, 0.4, 14, 3, 'brick');
      bx(-12, 14.5 * sz, 0.4, 9, 3, 'brick');
      bx(12, 14.5 * sz, 0.4, 9, 3, 'brick');
    }
    // caixas e barreiras
    const crates = [[-4.5, 5.5], [5, -5.5], [-12, 2.6], [12, -2.6], [-28, -6], [-28, 6], [28, -6], [28, 6], [-36, -12], [36, 12], [-6, -12], [6, 12], [-20, -4.8], [20, 4.8], [-38, 25], [38, -25], [15, 30], [-15, -30], [-15, 36], [15, -36]];
    for (const [x, z] of crates) bx(x, z, 1.2, 1.2, 1.2, 'crate');
    bx(5, -5.5, 1.2, 1.2, 1.2, 'crate', 1.2);
    bx(-28, -6, 1.2, 1.2, 1.2, 'crate', 1.2);
    bx(28, 6, 1.2, 1.2, 1.2, 'crate', 1.2);
    for (const [x, z] of [[-12, -6], [12, 6], [-33, 0], [33, 0]]) bx(x, z, 0.9, 0.9, 0.9, 'crate');
    bx(-8, 0, 0.6, 3, 1.0, 'barrier'); bx(8, 0, 0.6, 3, 1.0, 'barrier');
    bx(0, 9, 3, 0.6, 1.0, 'barrier'); bx(0, -9, 3, 0.6, 1.0, 'barrier');
    bx(-38, -4, 0.6, 3, 1.0, 'barrier'); bx(38, 4, 0.6, 3, 1.0, 'barrier');
    for (const [x, z] of [[-15, -5], [15, 5], [-15, 5], [15, -5], [-35, -15], [35, 15]]) bx(x, z, 0.18, 0.18, 6, 'pole', 0, [0.25, 0.25, 0.27]);

    const spawns = {
      0: [[-38, -8], [-38, 0], [-38, 8], [-35, -4], [-35, 4], [-41, -20], [-41, 20], [-35, -28], [-36, 32]].map(([x, z]) => [x, 0, z, -Math.PI / 2]),
      1: [[38, -8], [38, 0], [38, 8], [35, -4], [35, 4], [41, -20], [41, 20], [35, 28], [36, -28]].map(([x, z]) => [x, 0, z, Math.PI / 2]),
    };
    spawns.x1 = {
      0: [[-24, -2], [-24, 2], [-26, 0], [-22, 0]].map(([x, z]) => [x, 0, z, -Math.PI / 2]),
      1: [[24, -2], [24, 2], [26, 0], [22, 0]].map(([x, z]) => [x, 0, z, Math.PI / 2]),
    };
    spawns.ffa = spawns[0].concat(spawns[1], [[0, 0, -14, 0], [0, 0, 36, Math.PI], [-20, 0, 0, -Math.PI / 2], [20, 0, 0, Math.PI / 2], [-20, 0, -40, 0], [20, 0, 40, Math.PI], [0, 0, -42, 0], [-40, 0, 40, -2.4]]);
    const medkits = [[-20, 0, -14], [20, 0, 14], [-3, 0, 24], [0, 4.25, -30], [0, 0, 0], [-20, 0, 14], [20, 0, -14]];
    return { id: 'base', solids, deco, spawns, medkits, sx: S, sz: S };
  })();
  // ---------------------------------------------------------------- mapa aberto (até 30 jogadores) com ferrovia
  // trem sai do depósito (oeste) quando a partida começa, atravessa o mapa e para na estação (leste)
  const MAP_OPEN = (function () {
    const { solids, deco, add, bx, wall, door, win, house } = builder();
    let seed = 20261115;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const rr = (a, b) => a + rnd() * (b - a);
    const SX = 160, SZ = 110;
    const GREY = [0.36, 0.37, 0.4];
    // livre para colocar algo (sem caixa sólida perto, fora da linha e das ruas principais)
    const blocked = [];
    const keepOut = (x0, z0, x1, z1) => blocked.push([x0, z0, x1, z1]);
    function freeAt(x, z, r) {
      if (Math.abs(x) > SX - 3 || Math.abs(z) > SZ - 3) return false;
      for (const b of blocked) if (x + r > b[0] && x - r < b[2] && z + r > b[1] && z - r < b[3]) return false;
      for (const b of solids) if (b[1] < 2 && x + r > b[0] && x - r < b[3] && z + r > b[2] && z - r < b[5]) return false;
      return true;
    }

    // perímetro
    bx(0, -SZ, 2 * SX + 2, 1, 4, 'concrete'); bx(0, SZ, 2 * SX + 2, 1, 4, 'concrete');
    bx(-SX, 0, 1, 2 * SZ, 4, 'concrete'); bx(SX, 0, 1, 2 * SZ, 4, 'concrete');

    // ferrovia: lastro + trilhos (decoração) de ponta a ponta
    add(-SX + 0.5, 0, -2.6, SX - 0.5, 0.04, 2.6, 'gravel', false);
    add(-SX + 0.5, 0.04, -1.5, SX - 0.5, 0.06, 1.5, 'rail', false);
    keepOut(-SX, -5, SX, 5);
    // postes da rede aérea ao longo da linha
    for (let x = -150; x <= 150; x += 25) for (const s of [-1, 1]) {
      if (x > 88 && x < 152) continue; // estação tem cobertura
      add(x - 0.12, 0, s * 3.4 - 0.12, x + 0.12, 6.2, s * 3.4 + 0.12, 'pole', true, [0.3, 0.3, 0.32]);
      add(x - 0.06, 5.9, s > 0 ? 1.2 : -3.4, x + 0.06, 6.0, s > 0 ? 3.4 : -1.2, 'pole', false, [0.3, 0.3, 0.32]);
    }

    // ruas (decoração): duas transversais que cruzam a linha (passagens de nível) e duas paralelas
    add(-49, 0, -SZ + 0.5, -41, 0.02, SZ - 0.5, 'road', false); keepOut(-50, -SZ, -40, SZ);
    add(41, 0, -SZ + 0.5, 49, 0.02, SZ - 0.5, 'road', false); keepOut(40, -SZ, 50, SZ);
    add(-SX + 0.5, 0, 36, SX - 0.5, 0.021, 44, 'road', false); keepOut(-SX, 35, SX, 45);
    add(-SX + 0.5, 0, -49, SX - 0.5, 0.021, -41, 'road', false); keepOut(-SX, -50, SX, -40);
    // cancelas das passagens de nível
    for (const cx of [-45, 45]) for (const s of [-1, 1]) {
      const gx = cx + s * 4.6;
      add(gx - 0.15, 0, s * 4.2 - 0.15, gx + 0.15, 1.2, s * 4.2 + 0.15, 'barrier');
      add(Math.min(gx, gx - s * 3.6), 1.05, s * 4.2 - 0.06, Math.max(gx, gx - s * 3.6), 1.15, s * 4.2 + 0.06, 'barrier', false);
    }

    // depósito de trens (oeste): o trem começa aqui dentro
    {
      const x0 = -155, x1 = -84, h = 7.5, th = 0.4;
      wall('x', -5.6, x0, x1, th, h, 'brick', [door(-142, 2.4, 2.6), win(-130, 2.2), win(-118, 2.2), door(-106, 2.4, 2.6), win(-94, 2.2)]);
      wall('x', 5.6, x0, x1, th, h, 'brick', [win(-142, 2.2), door(-130, 2.4, 2.6), win(-118, 2.2), win(-106, 2.2), door(-94, 2.4, 2.6)]);
      wall('z', x0, -5.4, 5.4, th, h, 'brick', [win(-3.5, 2), win(3.5, 2)]);
      add(x1 - 0.5, 5.4, -5.8, x1, h, 5.8, 'brick'); // viga da porta grande (leste fica aberto)
      add(x0 - 0.3, h, -6.2, x1 + 0.3, h + 0.35, 6.2, 'roof');
      for (const s of [-1, 1]) for (let x = -150; x < -88; x += 12) bx(x, s * 4.2, 1.2, 1.2, 1.2, 'crate');
      bx(-150, -4.2, 1.2, 1.2, 1.2, 'crate', 1.2);
      keepOut(x0 - 2, -9, x1 + 2, 9);
    }

    // estação final (leste): plataformas dos dois lados, cobertura, prédio e para-choque
    {
      const xa = 90, xb = 151;
      for (const s of [-1, 1]) {
        const za = s > 0 ? 2.35 : -7.6, zb = s > 0 ? 7.6 : -2.35;
        add(xa, 0, za, xb, 1.0, zb, 'concrete');
        add(xa - 1.0, 0, za, xa, 0.5, zb, 'concrete'); // degrau
        for (let x = xa + 5; x < xb - 1; x += 10) add(x - 0.15, 1.0, s * 6.4 - 0.15, x + 0.15, 4.8, s * 6.4 + 0.15, 'pole', true, [0.25, 0.27, 0.3]);
        add(xa + 2, 4.8, s > 0 ? 1.9 : -8.2, xb - 1, 5.05, s > 0 ? 8.2 : -1.9, 'roof');
        for (let x = xa + 9; x < xb - 4; x += 13) add(x - 1.1, 1.0, s * 5.2 - 0.3, x + 1.1, 1.45, s * 5.2 + 0.3, 'wood');
        add(xa + 30 - 0.6, 1.0, s * 4.4 - 0.6, xa + 30 + 0.6, 2.2, s * 4.4 + 0.6, 'metal', true, [0.7, 0.12, 0.12]); // bilheteria/totem
      }
      // prédio da estação (norte), com portas para a plataforma e para a rua
      {
        const x0 = 104, x1 = 132, z0 = 9.5, z1 = 21, h = 5.2, th = 0.3;
        wall('x', z0 + th / 2, x0, x1, th, h, 'brick', [door(110, 2.2, 2.6), win(118, 2.4), door(126, 2.2, 2.6)]);
        wall('x', z1 - th / 2, x0, x1, th, h, 'brick', [win(110, 2.4), door(118, 2.4, 2.6), win(126, 2.4)]);
        wall('z', x0 + th / 2, z0 + th, z1 - th, th, h, 'brick', [win(15, 2)]);
        wall('z', x1 - th / 2, z0 + th, z1 - th, th, h, 'brick', [door(15, 2.2, 2.6)]);
        add(x0 - 0.3, h, z0 - 0.3, x1 + 0.3, h + 0.3, z1 + 0.3, 'roof');
        add(x0 + 4, 0, 13.5, x0 + 8, 1.1, 14.5, 'wood'); add(x1 - 8, 0, 13.5, x1 - 4, 1.1, 14.5, 'wood');
        // ligação plataforma -> prédio
        add(108, 0, 7.6, 112, 1.0, 9.4, 'concrete'); add(124, 0, 7.6, 128, 1.0, 9.4, 'concrete');
        add(108, 0, 9.4, 112, 0.5, 10.4, 'concrete'); add(124, 0, 9.4, 128, 0.5, 10.4, 'concrete');
      }
      add(152, 0, -1.7, 154.5, 1.5, 1.7, 'metal', true, [0.75, 0.15, 0.08]); // para-choque
      keepOut(xa - 3, -10, xb + 6, 23);
    }

    // passarela sobre a linha (x = 0) com escadas dos dois lados — ponto alto para sniper
    {
      const H = 6.2, hw = 1.5, half = 8.5, n = 22, rise = H / n, run = 0.55;
      add(-hw, H - 0.35, -half, hw, H, half, 'concrete');
      add(-hw, H, -half, -hw + 0.12, H + 1.05, half, 'pole', true, [0.32, 0.34, 0.36]);
      add(hw - 0.12, H, -half, hw, H + 1.05, half, 'pole', true, [0.32, 0.34, 0.36]);
      for (const s of [-1, 1]) {
        add(-hw, 0, s * 4 - 0.35, hw, H - 0.35, s * 4 + 0.35, 'concrete'); // pilar
        for (let i = 1; i <= n; i++) {
          const za = s * (half + (n - i) * run), zb = s * (half + (n - i + 1) * run);
          add(-hw, 0, Math.min(za, zb), hw, rise * i, Math.max(za, zb), 'concrete');
        }
      }
      keepOut(-4, -half - n * run - 3, 4, half + n * run + 3);
    }

    // cidade (norte): casas dos dois lados da rua z = 40, prédios e praça
    const houseAt = (cx, cz, door, t) => { house(cx, cz, 10, 8, 3.4, door, t); keepOut(cx - 6.5, cz - 5.5, cx + 6.5, cz + 5.5); };
    for (const cx of [-140, -124, -108, -92, -76, -24, 14, 28, 62, 78, 94, 136]) houseAt(cx, 29, 1, rnd() < 0.5 ? 'brick' : 'concrete');
    for (const cx of [-140, -124, -92, -76, -24, -10, 14, 28, 62, 78, 94, 110, 126, 142]) houseAt(cx, 51, -1, rnd() < 0.6 ? 'brick' : 'concrete');
    // prédios fechados (cobertura grande)
    for (const [cx, cz, w, d, h] of [[-118, 72, 14, 10, 9], [-66, 78, 10, 14, 12], [8, 80, 16, 10, 8], [102, 76, 12, 12, 10]]) { bx(cx, cz, w, d, h, 'concrete'); add(cx - w / 2 - 0.2, h, cz - d / 2 - 0.2, cx + w / 2 + 0.2, h + 0.3, cz + d / 2 + 0.2, 'roof'); keepOut(cx - w / 2 - 2, cz - d / 2 - 2, cx + w / 2 + 2, cz + d / 2 + 2); }
    // praça com chafariz
    {
      const cx = -20, cz = 72;
      add(cx - 9, 0, cz - 9, cx + 9, 0.03, cz + 9, 'concrete', false, [0.62, 0.6, 0.56]);
      bx(cx, cz, 4, 4, 0.6, 'concrete'); bx(cx, cz, 1, 1, 2.0, 'concrete');
      for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) add(cx + x - 1, 0, cz + z - 0.3, cx + x + 1, 0.45, cz + z + 0.3, 'wood');
      keepOut(cx - 10, cz - 10, cx + 10, cz + 10);
    }
    // caixa d'água
    {
      const cx = -132, cz = 92;
      for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) add(cx + x - 0.2, 0, cz + z - 0.2, cx + x + 0.2, 10, cz + z + 0.2, 'pole', true, [0.35, 0.33, 0.3]);
      bx(cx, cz, 6, 6, 4, 'metal', 10, [0.55, 0.57, 0.6]);
      keepOut(cx - 5, cz - 5, cx + 5, cz + 5);
    }
    // posto de gasolina
    {
      const cx = 60, cz = 92;
      for (const [x, z] of [[-6, -4], [6, -4], [-6, 4], [6, 4]]) add(cx + x - 0.2, 0, cz + z - 0.2, cx + x + 0.2, 4.6, cz + z + 0.2, 'pole', true, [0.8, 0.8, 0.82]);
      add(cx - 7.5, 4.6, cz - 5.5, cx + 7.5, 5.1, cz + 5.5, 'metal', true, [0.85, 0.2, 0.15]);
      for (const x of [-3, 3]) bx(cx + x, cz, 1.0, 0.7, 1.6, 'metal', 0, [0.9, 0.9, 0.9]);
      house(cx + 18, cz + 2, 10, 8, 3.4, -1, 'concrete');
      keepOut(cx - 9, cz - 7, cx + 24, cz + 8);
    }

    // galpão industrial (sul-oeste) com portões grandes
    {
      const x0 = -128, x1 = -96, z0 = -34, z1 = -14, h = 8, th = 0.35;
      wall('x', z0 + th / 2, x0, x1, th, h, 'metal', [door(-120, 4.5, 5), door(-104, 4.5, 5)]);
      wall('x', z1 - th / 2, x0, x1, th, h, 'metal', [door(-112, 4.5, 5), win(-102, 3)]);
      wall('z', x0 + th / 2, z0 + th, z1 - th, th, h, 'metal', [door(-24, 3, 3)]);
      wall('z', x1 - th / 2, z0 + th, z1 - th, th, h, 'metal', [win(-24, 3)]);
      add(x0 - 0.3, h, z0 - 0.3, x1 + 0.3, h + 0.3, z1 + 0.3, 'roof');
      for (const [x, z, n] of [[-124, -30, 2], [-122, -18, 1], [-115, -24, 3], [-106, -30, 1], [-100, -18, 2]]) for (let k = 0; k < n; k++) bx(x, z, 1.3, 1.3, 1.3, 'crate', k * 1.3);
      keepOut(x0 - 2, z0 - 2, x1 + 2, z1 + 2);
    }
    // pátio de contêineres (sul)
    {
      const cols = [[0.25, 0.4, 0.3], [0.55, 0.22, 0.16], [0.22, 0.32, 0.5], [0.7, 0.42, 0.14], [0.45, 0.45, 0.48]];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
        if (rnd() < 0.22) continue;
        const x = -78 + c * 9, z = -66 - r * 9, n = rnd() < 0.35 ? 2 : 1;
        for (let k = 0; k < n; k++) bx(x, z, 6, 2.5, 2.6, 'metal', k * 2.6, cols[Math.floor(rnd() * cols.length)]);
      }
      keepOut(-84, -100, -26, -60);
    }
    // base militar (sul-leste): torres de vigia, barracas e sacos de areia
    {
      const tower = (cx, cz) => {
        const y = 4.2, c = [0.4, 0.42, 0.38];
        for (const [x, z] of [[-1.85, -1.85], [1.85, -1.85], [-1.85, 1.85], [1.85, 1.85]]) add(cx + x - 0.15, 0, cz + z - 0.15, cx + x + 0.15, y, cz + z + 0.15, 'metal', true, [0.3, 0.3, 0.28]);
        add(cx - 2, y, cz - 2, cx + 2, y + 0.25, cz + 2, 'metal', true, c);
        add(cx - 2, y + 0.25, cz - 2, cx + 2, y + 1.2, cz - 1.9, 'metal', true, c);
        add(cx - 2, y + 0.25, cz + 1.9, cx + 2, y + 1.2, cz + 2, 'metal', true, c);
        add(cx + 1.9, y + 0.25, cz - 1.9, cx + 2, y + 1.2, cz + 1.9, 'metal', true, c);
        add(cx - 2.2, y + 2.6, cz - 2.2, cx + 2.2, y + 2.8, cz + 2.2, 'roof');
        for (let i = 0; i < 9; i++) { const x = cx - 2 - 0.6 * (9 - i); add(x, 0, cz - 0.8, x + 0.6, (y / 9) * (i + 1), cz + 0.8, 'wood'); }
      };
      tower(22, -66); tower(70, -92);
      for (const [x, z] of [[30, -86], [40, -86], [50, -86], [58, -70]]) { bx(x, z, 5, 4, 2.4, 'tent', 0, [0.33, 0.37, 0.24]); }
      for (const [x, z, w, d] of [[34, -60, 8, 0.8], [52, -60, 8, 0.8], [26, -76, 0.8, 6], [64, -78, 0.8, 6], [44, -72, 5, 0.8]]) bx(x, z, w, d, 1.1, 'sandbag');
      bx(46, -98, 6, 4, 3.2, 'concrete');
      keepOut(10, -102, 80, -56);
    }
    // fazenda (leste-sul): celeiro, fardos de feno, cercas e plantação
    {
      house(124, -82, 16, 12, 5.5, -1, 'wood');
      for (let k = 0; k < 9; k++) { const x = 98 + (k % 3) * 3.2, z = -96 + Math.floor(k / 3) * 2.6; bx(x, z, 1.5, 1.2, 1.1, 'hay', 0, [0.85, 0.72, 0.35]); if (k % 4 === 0) bx(x, z, 1.5, 1.2, 1.1, 'hay', 1.1, [0.85, 0.72, 0.35]); }
      add(92, 0, -66, 150, 0.03, -54, 'field', false, [0.42, 0.36, 0.2]);
      for (let x = 92; x < 150; x += 4) add(x, 0, -53.2, x + 3.6, 1.0, -52.9, 'wood'); // cerca
      for (let z = -104; z < -54; z += 4) add(90.6, 0, z, 90.9, 1.0, z + 3.6, 'wood');
      keepOut(88, -106, 152, -50);
    }

    // carros parados nas ruas
    const car = (x, z, alongX, col) => {
      const L = 4.3, W = 1.85;
      if (alongX) { add(x - L / 2, 0.3, z - W / 2, x + L / 2, 1.1, z + W / 2, 'car', true, col); add(x - 1.1, 1.1, z - W / 2 + 0.1, x + 1.0, 1.65, z + W / 2 - 0.1, 'car', true, col.map((c) => c * 0.7)); }
      else { add(x - W / 2, 0.3, z - L / 2, x + W / 2, 1.1, z + L / 2, 'car', true, col); add(x - W / 2 + 0.1, 1.1, z - 1.1, x + W / 2 - 0.1, 1.65, z + 1.0, 'car', true, col.map((c) => c * 0.7)); }
    };
    const CAR = [[0.75, 0.1, 0.1], [0.12, 0.25, 0.6], [0.85, 0.85, 0.85], [0.1, 0.1, 0.12], [0.85, 0.65, 0.1], [0.2, 0.45, 0.25]];
    for (const [x, z, ax] of [[-120, 38, 1], [-60, 42, 1], [20, 38, 1], [100, 42, 1], [140, 38, 1], [-130, -43, 1], [-10, -47, 1], [80, -43, 1], [-47, 70, 0], [-43, -80, 0], [43, 24, 0], [47, -25, 0], [43, 75, 0], [-47, -20, 0]]) car(x, z, ax, CAR[Math.floor(rnd() * CAR.length)]);

    // pedras e árvores espalhadas (sem bloquear ruas/linha/construções)
    let rocks = 0, guard = 0;
    while (rocks < 34 && guard++ < 2000) {
      const x = rr(-SX + 6, SX - 6), z = rr(-SZ + 6, SZ - 6), w = rr(1.4, 3.4), d = rr(1.2, 3.0), h = rr(0.7, 1.8);
      if (!freeAt(x, z, Math.max(w, d))) continue;
      bx(x, z, w, d, h, 'rock', 0, [0.45 + rnd() * 0.1, 0.44 + rnd() * 0.08, 0.42]);
      if (rnd() < 0.4) bx(x + rr(-1, 1), z + rr(-1, 1), w * 0.6, d * 0.6, h * 0.6, 'rock', h * 0.9, [0.5, 0.49, 0.46]);
      rocks++;
    }
    let trees = 0; guard = 0;
    while (trees < 130 && guard++ < 4000) {
      const x = rr(-SX + 4, SX - 4), z = rr(-SZ + 4, SZ - 4);
      if (!freeAt(x, z, 2.2)) continue;
      const h = rr(5, 9), r = rr(1.8, 3.0);
      add(x - 0.28, 0, z - 0.28, x + 0.28, h * 0.55, z + 0.28, 'trunk');
      add(x - r, h * 0.45, z - r, x + r, h, z + r, 'tree', false, [0.18 + rnd() * 0.08, 0.32 + rnd() * 0.1, 0.14]);
      trees++;
    }

    // pontos de nascimento espalhados pelo mapa (todos contra todos)
    const ffa = [];
    for (let gz = -SZ + 12; gz <= SZ - 12; gz += 26) for (let gx = -SX + 12; gx <= SX - 12; gx += 26) {
      for (let t = 0; t < 10; t++) {
        const x = gx + rr(-8, 8), z = gz + rr(-8, 8);
        if (Math.abs(z) < 7 || !freeAt(x, z, 1.6)) continue;
        ffa.push([Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10, Math.atan2(x, z)]);
        break;
      }
    }
    const spawns = { 0: ffa, 1: ffa, x1: { 0: ffa, 1: ffa }, ffa };
    const medkits = [[-120, 0, -24], [-100, 0, -31], [-51, 0, -72], [40, 0, -80], [60, 0, -64], [110, 0, -75], [128, 0, -92], [-60, 0, 60], [-20, 0, 66], [8, 0, 66], [60, 0, 92], [96, 0, 62], [-132, 0, 80], [-104, 0, 8], [-60, 0, -8], [20, 0, 12], [70, 0, -10], [118, 1.0, 5], [118, 1.0, -5], [0, 6.2, 0], [-140, 0, -60], [140, 0, 66]];
    const train = { z: 0, x0: -86, x1: 149.5, speed: 5, delay: 12, cars: 3, len: 20.85, gap: 0.8, hw: 1.45, y0: 0.32, y1: 4.2 };
    return { id: 'aberto', solids, deco, spawns, medkits, sx: SX, sz: SZ, train };
  })();
  const MAPS = { base: MAP_BASE, aberto: MAP_OPEN };
  const mapFor = (mode) => (mode === 'aberto' ? MAP_OPEN : MAP_BASE);
  const isFFA = (mode) => mode === 'ffa' || mode === 'aberto';
  // grade espacial para colisão rápida (mapas grandes)
  function indexMap(m) {
    if (m.cells) return m;
    const G = 8, cells = new Map();
    for (const b of m.solids) {
      for (let cx = Math.floor(b[0] / G); cx <= Math.floor(b[3] / G); cx++) for (let cz = Math.floor(b[2] / G); cz <= Math.floor(b[5] / G); cz++) {
        const k = (cx + 4096) * 8192 + (cz + 4096); let a = cells.get(k); if (!a) cells.set(k, (a = [])); a.push(b);
      }
    }
    m.cells = cells; m.G = G;
    return m;
  }
  // posição da frente do trem em um tempo de partida t (pára no fim da linha)
  function trainFront(tr, t) { return t <= tr.delay ? tr.x0 : Math.min(tr.x1, tr.x0 + (t - tr.delay) * tr.speed); }
  function trainBoxes(tr, front, out, moving) {
    out.length = tr.cars;
    for (let k = 0; k < tr.cars; k++) {
      const fx = front - k * (tr.len + tr.gap), b = out[k] || (out[k] = [0, 0, 0, 0, 0, 0, 'train', null]);
      b[0] = fx - tr.len; b[1] = tr.y0; b[2] = tr.z - tr.hw; b[3] = fx; b[4] = tr.y1; b[5] = tr.z + tr.hw; b.vx = moving ? tr.speed : 0;
    }
    return out;
  }

  // ---------------------------------------------------------------- física
  // mapa em uso (o servidor roda várias salas: cada partida chama useMap antes de simular)
  let MAP = indexMap(MAP_BASE), SOL = MAP.solids, CELLS = MAP.cells, DYN = [];
  function useMap(m, dyn) {
    if (MAP !== m) { MAP = indexMap(m); SOL = m.solids; CELLS = m.cells; NAV = m.nav || null; }
    DYN = dyn || [];
  }
  function collides(x, y, z, r, h) {
    if (y < -0.001) return GROUND;
    const G = MAP.G, c0 = Math.floor((x - r) / G), c1 = Math.floor((x + r) / G), d0 = Math.floor((z - r) / G), d1 = Math.floor((z + r) / G);
    for (let cx = c0; cx <= c1; cx++) for (let cz = d0; cz <= d1; cz++) {
      const a = CELLS.get((cx + 4096) * 8192 + (cz + 4096)); if (!a) continue;
      for (let i = 0; i < a.length; i++) {
        const b = a[i];
        if (x + r > b[0] && x - r < b[3] && y + h > b[1] && y < b[4] && z + r > b[2] && z - r < b[5]) return b;
      }
    }
    for (let i = 0; i < DYN.length; i++) {
      const b = DYN[i];
      if (x + r > b[0] && x - r < b[3] && y + h > b[1] && y < b[4] && z + r > b[2] && z - r < b[5]) return b;
    }
    return null;
  }
  const GROUND = [-1e9, -1, -1e9, 1e9, 0, 1e9, 'ground'];

  function weaponOf(p) { return WEAPONS[p.weapons ? p.weapons[p.cur] : 'smg'] || WEAPONS.smg; }

  // Aplica um comando de movimento (determinístico: cliente prevê, servidor confirma)
  function applyInput(p, inp) {
    const dt = clamp(num(inp.dt, 0), 0, 0.05);
    p.yaw = num(inp.yaw, p.yaw);
    p.pitch = clamp(num(inp.pitch, p.pitch), -1.5, 1.5);
    const b = inp.b | 0;
    p.ads = !!(b & BTN.ADS);
    if (!p.alive) return;
    if (b & BTN.CROUCH) p.crouch = true;
    else if (p.crouch && !collides(p.x, p.y, p.z, C.R, C.H)) p.crouch = false;
    const h = p.crouch ? C.HC : C.H;
    let f = clamp(num(inp.f), -1, 1), s = clamp(num(inp.s), -1, 1);
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const w = weaponOf(p);
    let speed = p.crouch ? C.CROUCH : ((b & BTN.SPRINT) && f > 0.3 && !p.ads ? C.SPRINT : C.WALK);
    speed *= w.speed;
    if (p.ads) speed *= 0.65;
    if (p.medUntil) speed *= 0.6;
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    const wx = (-sy * f + cy * s) * speed, wz = (-cy * f - sy * s) * speed;
    const k = p.onGround ? Math.min(1, dt * 14) : Math.min(1, dt * 2.5);
    p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k;
    if ((b & BTN.JUMP) && p.onGround && !p.crouch) { p.vy = C.JUMP; p.onGround = false; }
    p.vy -= C.GRAV * dt;
    if (p.vy < -40) p.vy = -40;
    // eixo X
    let nx = p.x + p.vx * dt, hit = collides(nx, p.y, p.z, C.R, h);
    if (hit) {
      if (p.onGround && hit[4] - p.y <= C.STEP && !collides(nx, hit[4] + 0.001, p.z, C.R, h)) p.y = hit[4] + 0.001, p.x = nx;
      else p.vx = 0;
    } else p.x = nx;
    // eixo Z
    let nz = p.z + p.vz * dt; hit = collides(p.x, p.y, nz, C.R, h);
    if (hit) {
      if (p.onGround && hit[4] - p.y <= C.STEP && !collides(p.x, hit[4] + 0.001, nz, C.R, h)) p.y = hit[4] + 0.001, p.z = nz;
      else p.vz = 0;
    } else p.z = nz;
    // eixo Y
    const ny = p.y + p.vy * dt; hit = collides(p.x, ny, p.z, C.R, h);
    if (hit) {
      if (p.vy <= 0) { p.y = Math.max(hit[4], 0) + (hit === GROUND ? 0 : 0.001); p.onGround = true; }
      else p.y = hit[1] - h - 0.001;
      p.vy = 0;
    } else { p.y = ny; p.onGround = false; }
  }

  // ---------------------------------------------------------------- raycast
  function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
    let tmin = 0, tmax = Infinity;
    if (Math.abs(dx) < 1e-9) { if (ox < x0 || ox > x1) return Infinity; }
    else { let a = (x0 - ox) / dx, b = (x1 - ox) / dx; if (a > b) { const t = a; a = b; b = t; } tmin = Math.max(tmin, a); tmax = Math.min(tmax, b); if (tmin > tmax) return Infinity; }
    if (Math.abs(dy) < 1e-9) { if (oy < y0 || oy > y1) return Infinity; }
    else { let a = (y0 - oy) / dy, b = (y1 - oy) / dy; if (a > b) { const t = a; a = b; b = t; } tmin = Math.max(tmin, a); tmax = Math.min(tmax, b); if (tmin > tmax) return Infinity; }
    if (Math.abs(dz) < 1e-9) { if (oz < z0 || oz > z1) return Infinity; }
    else { let a = (z0 - oz) / dz, b = (z1 - oz) / dz; if (a > b) { const t = a; a = b; b = t; } tmin = Math.max(tmin, a); tmax = Math.min(tmax, b); if (tmin > tmax) return Infinity; }
    return tmin;
  }
  function raycastWorld(ox, oy, oz, dx, dy, dz, maxT = 300) {
    let best = maxT;
    if (dy < 0) { const t = -oy / dy; if (t < best) best = t; }
    for (let i = 0; i < SOL.length; i++) {
      const b = SOL[i];
      const t = rayBox(ox, oy, oz, dx, dy, dz, b[0], b[1], b[2], b[3], b[4], b[5]);
      if (t < best) best = t;
    }
    for (let i = 0; i < DYN.length; i++) {
      const b = DYN[i];
      const t = rayBox(ox, oy, oz, dx, dy, dz, b[0], b[1], b[2], b[3], b[4], b[5]);
      if (t < best) best = t;
    }
    return best;
  }
  function aimDir(yaw, pitch) {
    const cp = Math.cos(pitch);
    return [-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
  }
  // hitboxes: retorna {t, head} ou null
  function rayPlayer(ox, oy, oz, dx, dy, dz, x, y, z, crouch) {
    const h = crouch ? C.HC : C.H;
    const th = rayBox(ox, oy, oz, dx, dy, dz, x - 0.19, y + h - 0.34, z - 0.19, x + 0.19, y + h + 0.03, z + 0.19);
    const tb = rayBox(ox, oy, oz, dx, dy, dz, x - 0.33, y, z - 0.33, x + 0.33, y + h - 0.34, z + 0.33);
    if (th === Infinity && tb === Infinity) return null;
    return th <= tb ? { t: th, head: true } : { t: tb, head: false };
  }

  // ---------------------------------------------------------------- navegação dos bots (grade A*)
  let NAV = null;
  function buildNav() {
    if (MAP.nav) return (NAV = MAP.nav);
    const SXn = MAP.sx - 1.5, SZn = MAP.sz - 1.5, step = 1;
    const ni = Math.floor((2 * SXn) / step) + 1, nj = Math.floor((2 * SZn) / step) + 1, N2 = ni * nj;
    const free = new Uint8Array(N2);
    const px = (i) => -SXn + i * step, pz = (j) => -SZn + j * step;
    const saveDyn = DYN; DYN = [];
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) free[i * nj + j] = collides(px(i), 0.05, pz(j), C.R + 0.05, C.H - 0.1) ? 0 : 1;
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const edges = new Uint8Array(N2); // bitmask
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) {
      const id = i * nj + j; if (!free[id]) continue;
      let m = 0;
      for (let d = 0; d < 8; d++) {
        const a = i + DIRS[d][0], c = j + DIRS[d][1];
        if (a < 0 || c < 0 || a >= ni || c >= nj || !free[a * nj + c]) continue;
        if (d >= 4 && (!free[a * nj + j] || !free[i * nj + c])) continue;
        const mx = (px(i) + px(a)) / 2, mz = (pz(j) + pz(c)) / 2;
        if (collides(mx, 0.05, mz, C.R + 0.05, C.H - 0.1)) continue;
        m |= 1 << d;
      }
      edges[id] = m;
    }
    DYN = saveDyn;
    const freeList = [];
    for (let id = 0; id < N2; id++) if (free[id] && edges[id]) freeList.push(id);
    NAV = MAP.nav = { ni, nj, n: nj, step, free, edges, DIRS, px, pz, freeList, g: new Float32Array(N2), came: new Int32Array(N2), mark: new Uint32Array(N2), gen: 0, heap: new Int32Array(N2 + 8), hf: new Float32Array(N2 + 8), sxn: SXn, szn: SZn };
    return NAV;
  }
  function navNode(x, z) {
    const N = NAV; const i = clamp(Math.round((x + N.sxn) / N.step), 0, N.ni - 1), j = clamp(Math.round((z + N.szn) / N.step), 0, N.nj - 1);
    let id = i * N.nj + j; if (N.free[id] && N.edges[id]) return id;
    for (let r = 1; r < 4; r++) for (let a = -r; a <= r; a++) for (let c = -r; c <= r; c++) {
      const ii = i + a, jj = j + c; if (ii < 0 || jj < 0 || ii >= N.ni || jj >= N.nj) continue;
      id = ii * N.nj + jj; if (N.free[id] && N.edges[id]) return id;
    }
    return -1;
  }
  // A* com fila de prioridade (heap); funciona rápido mesmo no mapa grande
  function findPath(x0, z0, x1, z1, maxIter = 20000) {
    if (!NAV) buildNav();
    const N = NAV, s = navNode(x0, z0), goal = navNode(x1, z1);
    if (s < 0 || goal < 0) return null;
    const nj = N.nj, gi = (goal / nj) | 0, gj = goal % nj, g = N.g, came = N.came, mark = N.mark, H = N.heap, HF = N.hf;
    const gen = (N.gen = (N.gen + 2) >>> 0) || (N.gen = 2), OPEN = gen, CLOSED = gen + 1;
    const hfn = (id) => { const dx = Math.abs(((id / nj) | 0) - gi), dz = Math.abs((id % nj) - gj); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); };
    let hn = 0;
    const push = (id, f) => { let k = hn++; while (k > 0) { const pk = (k - 1) >> 1; if (HF[pk] <= f) break; H[k] = H[pk]; HF[k] = HF[pk]; k = pk; } H[k] = id; HF[k] = f; };
    const pop = () => { const top = H[0], lid = H[--hn], lf = HF[hn]; let k = 0; for (;;) { let c = 2 * k + 1; if (c >= hn) break; if (c + 1 < hn && HF[c + 1] < HF[c]) c++; if (HF[c] >= lf) break; H[k] = H[c]; HF[k] = HF[c]; k = c; } H[k] = lid; HF[k] = lf; return top; };
    g[s] = 0; came[s] = -1; mark[s] = OPEN; push(s, hfn(s));
    let it = 0;
    while (hn && it++ < maxIter) {
      const cur = pop();
      if (mark[cur] === CLOSED) continue;
      if (cur === goal) {
        const path = []; let c = cur;
        while (c >= 0) { path.push([N.px((c / nj) | 0), N.pz(c % nj)]); c = came[c]; }
        path.reverse();
        const out = [];
        for (let k = 0; k < path.length; k += 2) out.push(path[k]);
        out.push(path[path.length - 1]);
        return out;
      }
      mark[cur] = CLOSED;
      const ci = (cur / nj) | 0, cj = cur % nj, m = N.edges[cur];
      for (let d = 0; d < 8; d++) {
        if (!(m & (1 << d))) continue;
        const nb = (ci + N.DIRS[d][0]) * nj + (cj + N.DIRS[d][1]);
        if (mark[nb] === CLOSED) continue;
        const ng = g[cur] + (d >= 4 ? 1.414 : 1);
        if (mark[nb] !== OPEN || ng < g[nb]) { g[nb] = ng; came[nb] = cur; mark[nb] = OPEN; push(nb, ng + hfn(nb)); }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- XP, níveis e perfil
  const xpForLevel = (l) => 400 + l * 200;
  function levelInfo(xp) {
    let l = 1, rem = xp;
    while (rem >= xpForLevel(l) && l < 100) { rem -= xpForLevel(l); l++; }
    return { level: l, cur: rem, need: xpForLevel(l) };
  }
  const MISSIONS = [
    { id: 'k10', text: 'Elimine 10 inimigos', stat: 'kills', goal: 10, xp: 300 },
    { id: 'k25', text: 'Elimine 25 inimigos', stat: 'kills', goal: 25, xp: 700 },
    { id: 'hs5', text: 'Faça 5 headshots', stat: 'hs', goal: 5, xp: 350 },
    { id: 'win1', text: 'Vença 1 partida', stat: 'wins', goal: 1, xp: 300 },
    { id: 'win3', text: 'Vença 3 partidas', stat: 'wins', goal: 3, xp: 800 },
    { id: 'med3', text: 'Use 3 kits médicos', stat: 'medUsed', goal: 3, xp: 200 },
    { id: 'pick3', text: 'Pegue 3 kits médicos do mapa', stat: 'picks', goal: 3, xp: 200 },
    { id: 'str3', text: 'Faça uma série de 3 eliminações', stat: 'streak3', goal: 1, xp: 300 },
    { id: 'play3', text: 'Complete 3 partidas', stat: 'matches', goal: 3, xp: 300 },
  ];
  function pickMission(prof) {
    const have = new Set(prof.missions.map((m) => m.id));
    const pool = MISSIONS.filter((m) => !have.has(m.id));
    const m = pool[Math.floor(Math.random() * pool.length)] || MISSIONS[0];
    return { id: m.id, prog: 0 };
  }
  function newProfile(name) {
    const p = { v: 1, name: sanitizeName(name), xp: 0, level: 1, coins: 1500, owned: ['pistol', 'smg'], uniformsOwned: ['woodland', 'desert'], upgrades: [], loadout: { primary: 'smg', secondary: 'pistol' }, uniform: 'woodland', mmr: 1000, wins: 0, losses: 0, kills: 0, deaths: 0, hs: 0, matches: 0, missions: [], cos: { owned: ['ch_soldado'], char: 'ch_soldado', shirt: '', pants: '', wskins: {} } };
    while (p.missions.length < 3) p.missions.push(pickMission(p));
    return p;
  }
  function fixProfile(p) {
    const d = newProfile(p && p.name);
    if (!p || typeof p !== 'object') return d;
    for (const k in d) if (p[k] === undefined || typeof p[k] !== typeof d[k]) p[k] = d[k];
    p.owned = p.owned.filter((w) => WEAPONS[w]);
    if (!WEAPONS[p.loadout.primary] || !p.owned.includes(p.loadout.primary)) p.loadout.primary = 'smg';
    if (!WEAPONS[p.loadout.secondary] || !p.owned.includes(p.loadout.secondary)) p.loadout.secondary = 'pistol';
    if (!UNIFORMS[p.uniform]) p.uniform = 'woodland';
    { // itens da lojinha: só vale o que existe e foi comprado
      const c = p.cos && typeof p.cos === 'object' ? p.cos : {};
      c.owned = Array.isArray(c.owned) ? [...new Set(c.owned.filter((x) => typeof x === 'string' && COSMETICS[x]))] : [];
      if (!c.owned.includes('ch_soldado')) c.owned.unshift('ch_soldado');
      const has = (id, t) => isCos(id, t) && c.owned.includes(id);
      c.char = has(c.char, 'char') ? c.char : 'ch_soldado';
      c.shirt = has(c.shirt, 'shirt') ? c.shirt : ''; c.pants = has(c.pants, 'pants') ? c.pants : '';
      const ws = {};
      if (c.wskins && typeof c.wskins === 'object') for (const w in c.wskins) if (WEAPONS[w] && has(c.wskins[w], 'wskin') && COSMETICS[c.wskins[w]].weapon === w) ws[w] = c.wskins[w];
      c.wskins = ws; p.cos = c;
    }
    p.missions = p.missions.filter((m) => MISSIONS.some((x) => x.id === m.id));
    while (p.missions.length < 3) p.missions.push(pickMission(p));
    p.level = levelInfo(p.xp).level;
    return p;
  }
  function addXp(prof, amt) {
    const before = levelInfo(prof.xp).level;
    prof.xp += Math.max(0, Math.round(amt));
    const after = levelInfo(prof.xp).level;
    const rewards = [];
    for (let l = before + 1; l <= after; l++) {
      const coins = 400 + l * 100;
      prof.coins += coins;
      const unlocks = WEAPON_LIST.filter((w) => WEAPONS[w].level === l).map((w) => WEAPONS[w].name)
        .concat(Object.values(UNIFORMS).filter((u) => u.level === l).map((u) => 'Uniforme ' + u.name));
      rewards.push({ level: l, coins, unlocks });
    }
    prof.level = after;
    return rewards;
  }
  // r: {xp,kills,deaths,hs,won,medUsed,picks,streakMax,mmr}
  function applyMatchResult(prof, r) {
    prof.kills += r.kills | 0; prof.deaths += r.deaths | 0; prof.hs += r.hs | 0; prof.matches++;
    if (r.won) prof.wins++; else prof.losses++;
    if (r.mmr) prof.mmr = Math.max(0, prof.mmr + r.mmr);
    const stats = { kills: r.kills | 0, hs: r.hs | 0, wins: r.won ? 1 : 0, medUsed: r.medUsed | 0, picks: r.picks | 0, streak3: r.streakMax >= 3 ? 1 : 0, matches: 1 };
    let xp = r.xp | 0;
    const done = [];
    for (let i = 0; i < prof.missions.length; i++) {
      const m = prof.missions[i], def = MISSIONS.find((x) => x.id === m.id);
      if (!def) continue;
      m.prog = Math.min(def.goal, m.prog + (stats[def.stat] || 0));
      if (m.prog >= def.goal) { xp += def.xp; done.push(def); prof.missions[i] = null; }
    }
    prof.missions = prof.missions.filter(Boolean);
    while (prof.missions.length < 3) prof.missions.push(pickMission(prof));
    const rewards = addXp(prof, xp);
    return { xp, rewards, missions: done };
  }
  function buy(prof, item) {
    if (typeof item !== 'string') return 'Item inexistente';
    const has = (o) => Object.prototype.hasOwnProperty.call(o, item);
    const w = has(WEAPONS) && WEAPONS[item], u = has(UNIFORMS) && UNIFORMS[item], g = has(UPGRADES) && UPGRADES[item], cz = has(COSMETICS) && COSMETICS[item];
    const def = w || u || g || cz;
    if (!def) return 'Item inexistente';
    const owned = w ? prof.owned : u ? prof.uniformsOwned : g ? prof.upgrades : prof.cos.owned;
    if (owned.includes(item)) return 'Você já possui este item';
    if (prof.level < def.level) return 'Requer nível ' + def.level;
    if (prof.coins < def.price) return 'Moedas insuficientes';
    prof.coins -= def.price; owned.push(item);
    return null;
  }
  function equip(prof, e) {
    if (e.primary && WEAPONS[e.primary] && WEAPONS[e.primary].slot === 0 && prof.owned.includes(e.primary)) prof.loadout.primary = e.primary;
    if (e.secondary && WEAPONS[e.secondary] && WEAPONS[e.secondary].slot === 1 && prof.owned.includes(e.secondary)) prof.loadout.secondary = e.secondary;
    if (e.uniform && UNIFORMS[e.uniform] && prof.uniformsOwned.includes(e.uniform)) prof.uniform = e.uniform;
    const c = prof.cos, has = (id, t) => isCos(id, t) && c.owned.includes(id);
    if (has(e.char, 'char')) c.char = e.char;
    if (e.shirt === '') c.shirt = ''; else if (has(e.shirt, 'shirt')) c.shirt = e.shirt;   // '' = tirar (volta o uniforme)
    if (e.pants === '') c.pants = ''; else if (has(e.pants, 'pants')) c.pants = e.pants;
    const ws = e.wskin;
    if (ws && typeof ws === 'object' && typeof ws.w === 'string' && Object.prototype.hasOwnProperty.call(WEAPONS, ws.w)) {
      if (!ws.id) delete c.wskins[ws.w];
      else if (has(ws.id, 'wskin') && COSMETICS[ws.id].weapon === ws.w) c.wskins[ws.w] = ws.id;
    }
  }
  function rankName(mmr) {
    if (mmr < 1100) return 'Bronze'; if (mmr < 1250) return 'Prata'; if (mmr < 1400) return 'Ouro';
    if (mmr < 1600) return 'Platina'; if (mmr < 1800) return 'Diamante'; return 'Elite';
  }
  function sanitizeName(n) {
    n = String(n || '').replace(/[<>&"'`\\]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16);
    return n || 'Soldado' + Math.floor(Math.random() * 900 + 100);
  }
  function sanitizeChat(s) { return String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120); }

  // ---------------------------------------------------------------- simulação autoritativa
  const BOT_NAMES = ['Falcão', 'Lobo', 'Víbora', 'Trovão', 'Corvo', 'Tigre', 'Sombra', 'Raio', 'Cobra', 'Fantasma', 'Puma', 'Gavião', 'Tanque', 'Escorpião', 'Jaguar', 'Coruja'];
  const BOT_SKILL = [
    { react: 0.9, err: 0.09, turn: 2.5, burst: 0.35 },
    { react: 0.5, err: 0.045, turn: 5, burst: 0.6 },
    { react: 0.28, err: 0.022, turn: 9, burst: 0.85 },
  ];
  const MODE_NAMES = { tdm: 'Mata-mata em equipe', ffa: 'Todos contra todos', aberto: 'Mapa aberto', x1: 'X1 (1 contra 1)', x2: 'X2 (2 contra 2)', x3: 'X3 (3 contra 3)', x4: 'X4 (4 contra 4)', training: 'Treinamento' };
  const isRounds = (m) => /^x[1-4]$/.test(m);

  class GameSim {
    constructor(o = {}) {
      this.mode = isFFA(o.mode) || isRounds(o.mode) ? o.mode : 'tdm';
      this.map = indexMap(mapFor(this.mode)); this.dyn = []; this.trainX = this.map.train ? this.map.train.x0 : 0; this.trainSt = 0;
      this.rounds = isRounds(this.mode); this.teamSize = this.rounds ? +this.mode[1] : 0;
      this.training = !!o.training;
      this.ranked = !!o.ranked;
      this.scoreLimit = this.rounds ? 7 : o.scoreLimit || (this.mode === 'aberto' ? 30 : isFFA(this.mode) ? 20 : 40);
      this.timeLimit = this.rounds ? 0 : o.timeLimit || (this.mode === 'aberto' ? 600 : 300); // X1–X4: sem tempo, por rounds
      this.round = 1; this.roundEndAt = 0; this.roundWinners = [];
      this.botSkill = clamp(o.botSkill == null ? 1 : o.botSkill, 0, 2);
      this.players = new Map();
      this.nextId = 1;
      this.time = 0; this.matchTime = 0; this.state = 'playing'; this.endAt = 0;
      this.score = [0, 0];
      this.events = [];
      this.history = [];
      this.firstBlood = false;
      this.rosterDirty = true;
      this.medkits = this.map.medkits.map(([x, y, z]) => ({ x, y, z, active: true, t: 0 }));
      this.onMatchEnd = null;
    }
    teamCount(t) { let n = 0; for (const p of this.players.values()) if (p.team === t) n++; return n; }
    addPlayer(info = {}) {
      useMap(this.map, this.dyn);
      const id = this.nextId++;
      const lo = info.loadout || {};
      const team = isFFA(this.mode) ? id : (info.team === 0 || info.team === 1 ? info.team : (this.teamCount(0) <= this.teamCount(1) ? 0 : 1));
      const p = {
        id, name: sanitizeName(info.name), bot: !!info.bot, team, uniform: UNIFORMS[info.uniform] ? info.uniform : 'woodland',
        skin: info.skin != null ? info.skin : id % 4, level: info.level || 1, upgrades: info.upgrades || [], look: sanitizeLook(info.look),
        weapons: [WEAPONS[lo.primary] && WEAPONS[lo.primary].slot === 0 ? lo.primary : 'smg', WEAPONS[lo.secondary] && WEAPONS[lo.secondary].slot === 1 ? lo.secondary : 'pistol'],
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: true, crouch: false, ads: false,
        hp: 100, alive: false, respawnAt: 0, kills: 0, deaths: 0, streak: 0, xp: 0,
        stats: { hs: 0, medUsed: 0, picks: 0, streakMax: 0 },
        cur: 0, ammo: {}, lastShot: -9, bloom: 0, reloadUntil: 0, medUntil: 0, switchUntil: 0, medkits: 0, spawnProt: 0,
        ack: 0, shotAck: 0, budget: 0.2, ping: 0, lastInput: 0, ai: null,
      };
      this.players.set(id, p);
      this.spawn(p);
      this.rosterDirty = true;
      return p;
    }
    removePlayer(id) { this.players.delete(id); this.rosterDirty = true; }
    setTeam(id, team) {
      const p = this.players.get(id);
      if (!p || isFFA(this.mode) || (team !== 0 && team !== 1) || p.team === team) return;
      if (this.teamSize && this.teamCount(team) >= this.teamSize) return; // time cheio
      p.team = team; p.alive = false; p.respawnAt = this.rounds ? Infinity : this.time + 1; this.rosterDirty = true;
      if (this.rounds && !this.roundEndAt) this.checkRound(null);
    }
    roster() {
      return [...this.players.values()].map((p) => [p.id, p.name, p.team, p.bot ? 1 : 0, p.uniform, p.skin, p.level, p.look]);
    }
    spawn(p) {
      const SP = this.map.spawns, list = isFFA(this.mode) ? SP.ffa : this.rounds ? SP.x1[p.team] : SP[p.team];
      let best = list[0], bestD = -1;
      for (const s of list) {
        let md = 1e9;
        for (const o of this.players.values()) if (o !== p && o.alive && (isFFA(this.mode) || this.rounds || o.team !== p.team)) md = Math.min(md, Math.hypot(o.x - s[0], o.z - s[2]));
        md += Math.random() * 6;
        if (md > bestD) { bestD = md; best = s; }
      }
      p.x = best[0] + (Math.random() - 0.5); p.y = best[1]; p.z = best[2] + (Math.random() - 0.5); p.yaw = best[3]; p.pitch = 0;
      p.vx = p.vy = p.vz = 0; p.onGround = true; p.crouch = false;
      p.hp = C.MAXHP; p.alive = true; p.streak = 0; p.cur = 0; p.bloom = 0;
      p.reloadUntil = 0; p.medUntil = 0; p.switchUntil = 0;
      p.medkits = C.MEDKITS_START + (p.upgrades.includes('medbag') ? 1 : 0);
      p.spawnProt = this.time + C.SPAWN_PROT;
      for (const w of p.weapons) p.ammo[w] = { mag: WEAPONS[w].mag, res: WEAPONS[w].reserve };
      if (p.ai) p.ai.path = null;
      this.events.push({ e: 'spawn', id: p.id });
    }
    handleInputs(id, list) {
      useMap(this.map, this.dyn);
      const p = this.players.get(id);
      if (!p || !Array.isArray(list)) return;
      for (const it of list.slice(0, 20)) {
        if (!Array.isArray(it)) continue;
        const seq = it[0] | 0; if (seq <= p.ack) continue;
        const inp = { dt: clamp(num(it[1]), 0, 0.05), f: it[2], s: it[3], yaw: it[4], pitch: it[5], b: it[6] };
        if (p.budget < inp.dt - 0.004) { p.ack = seq; continue; } // anti speed-hack
        p.budget -= inp.dt;
        if (this.state === 'playing') applyInput(p, inp);
        p.ack = seq; p.lastInput = this.time;
      }
    }
    handleAction(id, a) {
      useMap(this.map, this.dyn);
      const p = this.players.get(id);
      if (!p || !a || this.state !== 'playing') return;
      switch (a.a) {
        case 'shoot': return this.shoot(p, a);
        case 'reload': return this.reload(p);
        case 'switch': {
          const s = a.s === 1 ? 1 : 0;
          if (s !== p.cur && p.alive && !p.medUntil) { p.cur = s; p.reloadUntil = 0; p.switchUntil = this.time + C.SWITCH; }
          return;
        }
        case 'med':
          if (p.alive && p.medkits > 0 && p.hp < C.MAXHP && !p.medUntil) { p.medUntil = this.time + C.MEDTIME; p.reloadUntil = 0; this.events.push({ e: 'medstart', id: p.id }); }
          return;
      }
    }
    reload(p) {
      const w = weaponOf(p), am = p.ammo[w.id];
      if (!p.alive || p.reloadUntil || p.medUntil || !am || am.mag >= w.mag || am.res <= 0) return;
      p.reloadUntil = this.time + w.reload;
      this.events.push({ e: 'reload', id: p.id });
    }
    shoot(p, a) {
      const w = weaponOf(p), am = p.ammo[w.id];
      if (a.seq) p.shotAck = Math.max(p.shotAck, a.seq | 0);
      if (!p.alive || a.w !== w.id || !am || am.mag <= 0 || p.reloadUntil || p.medUntil || this.time < p.switchUntil) return;
      if (this.time - p.lastShot < 60 / w.rpm - 0.025) return; // cadência
      p.lastShot = this.time; am.mag--;
      const yaw = num(a.yaw, p.yaw), pitch = clamp(num(a.pitch, p.pitch), -1.5, 1.5);
      const moving = Math.hypot(p.vx, p.vz) > 1.5 || !p.onGround;
      let spread = (p.ads ? w.adsSpread : w.spread) * (moving ? w.moveMul : 1) * (p.crouch ? 0.8 : 1) + p.bloom;
      p.bloom = Math.min(w.bloomMax, p.bloom + w.bloom);
      const ex = p.x, ey = p.y + (p.crouch ? C.EYEC : C.EYE), ez = p.z;
      const fwd = aimDir(yaw, pitch), sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(pitch), cp = Math.cos(pitch);
      const right = [cy, 0, -sy], up = [sy * sp, cp, cy * sp];
      // compensação de latência
      const rewind = clamp(p.bot ? C.INTERP : p.ping / 2 + C.INTERP, 0, 0.35);
      const past = this.pastPositions(this.time - rewind);
      const dmgMap = new Map();
      let firstEnd = null;
      for (let k = 0; k < w.pellets; k++) {
        const r = Math.sqrt(Math.random()) * spread, th = Math.random() * Math.PI * 2;
        const ox = Math.cos(th) * r, oy = Math.sin(th) * r;
        let dx = fwd[0] + right[0] * ox + up[0] * oy, dy = fwd[1] + right[1] * ox + up[1] * oy, dz = fwd[2] + right[2] * ox + up[2] * oy;
        const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
        let tw = raycastWorld(ex, ey, ez, dx, dy, dz, 250);
        let victim = null, head = false;
        for (const o of this.players.values()) {
          if (o === p || !o.alive) continue;
          const hp = past.get(o.id) || [o.x, o.y, o.z, o.crouch];
          const h = rayPlayer(ex, ey, ez, dx, dy, dz, hp[0], hp[1], hp[2], hp[3]);
          if (h && h.t < tw) { tw = h.t; victim = o; head = h.head; }
        }
        if (!firstEnd) firstEnd = [ex + dx * tw, ey + dy * tw, ez + dz * tw];
        if (victim && (isFFA(this.mode) || victim.team !== p.team)) {
          const e = dmgMap.get(victim) || { head: false };
          e.head = e.head || head; dmgMap.set(victim, e);
        }
      }
      this.events.push({ e: 'shot', id: p.id, w: w.id, o: [r2(ex), r2(ey), r2(ez)], t: firstEnd.map(r2) });
      // dano fixo por tiro que acerta (todas as armas): peito/corpo 10, cabeça 20 (a doze conta 1 vez por disparo)
      for (const [v, e] of dmgMap) this.damage(v, p, e.head ? C.DMG_HEAD : C.DMG_BODY, e.head, w.id);
    }
    damage(v, att, d, head, wid) {
      if (!v.alive || this.time < v.spawnProt || this.roundEndAt) return;
      v.hp = Math.max(0, v.hp - d);
      if (v.medUntil) v.medUntil = 0; // dano interrompe kit médico
      this.events.push({ e: 'hit', a: att.id, v: v.id, d, hs: head ? 1 : 0, x: r2(att.x), z: r2(att.z) });
      if (v.hp <= 0) this.kill(v, att, wid, head);
    }
    kill(v, k, wid, head) {
      v.alive = false; v.deaths++; v.respawnAt = this.time + C.RESPAWN; v.streak = 0; v.reloadUntil = 0; v.medUntil = 0;
      this.events.push({ e: 'kill', k: k.id, v: v.id, w: wid, hs: head ? 1 : 0 });
      if (this.rounds) return this.roundKill(v, k);
      if (k === v) return;
      k.kills++; k.streak++; k.stats.streakMax = Math.max(k.stats.streakMax, k.streak);
      if (head) k.stats.hs++;
      this.award(k, 100, 'Eliminação');
      if (head) this.award(k, 50, 'Headshot');
      if (!this.firstBlood) { this.firstBlood = true; this.award(k, 50, 'Objetivo: Primeiro sangue'); }
      if (k.streak === 3) this.award(k, 100, 'Objetivo: Série de 3');
      if (k.streak === 5) this.award(k, 200, 'Objetivo: Série de 5');
      if (k.streak === 10) this.award(k, 500, 'Objetivo: Imparável');
      if (!isFFA(this.mode)) { this.score[k.team]++; if (this.score[k.team] >= this.scoreLimit) this.endMatch(); }
      else if (k.kills >= this.scoreLimit) this.endMatch();
    }
    // ---- X1: cada eliminação encerra o round; quem vencer 7 rounds vence a partida
    // X1–X4: quem morre espera o próximo round; a equipe sem ninguém vivo perde o round
    roundKill(v, k) {
      v.respawnAt = Infinity;
      if (k !== v) {
        k.kills++; k.streak++; k.stats.streakMax = Math.max(k.stats.streakMax, k.streak);
        this.award(k, 100, 'Eliminação');
      }
      this.checkRound(k !== v ? k : null);
    }
    checkRound(lastKiller) {
      const alive = [0, 0], count = [0, 0];
      for (const p of this.players.values()) { count[p.team]++; if (p.alive) alive[p.team]++; }
      if (!count[0] || !count[1]) { // sem adversário: renasce e espera
        for (const p of this.players.values()) if (!p.alive) p.respawnAt = this.time + C.RESPAWN;
        return;
      }
      let wt = -1;
      if (!alive[0] && alive[1]) wt = 1; else if (!alive[1] && alive[0]) wt = 0; else if (!alive[0] && !alive[1]) wt = lastKiller ? lastKiller.team : 0;
      if (wt < 0) return;
      const solo = this.teamSize === 1;
      const winP = solo ? [...this.players.values()].find((p) => p.team === wt) : null;
      const name = solo ? (winP ? winP.name : '?') : wt === 0 ? 'Equipe Azul' : 'Equipe Vermelha';
      for (const p of this.players.values()) if (p.team === wt) this.award(p, 75, 'Round vencido');
      this.score[wt]++;
      this.roundWinners.push({ round: this.round, team: wt, id: winP ? winP.id : 0, name });
      this.events.push({ e: 'round', round: this.round, wt, win: winP ? winP.id : 0, name, score: this.score.slice() });
      if (this.score[wt] >= this.scoreLimit) { this.roundEndAt = 0; this.endMatch(); }
      else this.roundEndAt = this.time + 3.5;
    }
    nextRound() {
      this.roundEndAt = 0; this.round++;
      for (const p of this.players.values()) this.spawn(p);
      for (const m of this.medkits) m.active = true;
      this.events.push({ e: 'roundstart', round: this.round });
    }
    award(p, amt, why) { p.xp += amt; this.events.push({ e: 'xp', id: p.id, amt, why }); }
    winnerOf() {
      if (!isFFA(this.mode)) return this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
      let best = null; for (const p of this.players.values()) if (!best || p.kills > best.kills) best = p;
      return best ? best.id : -1;
    }
    endMatch() {
      if (this.state !== 'playing') return;
      this.state = 'ended'; this.endAt = this.time + 12;
      const win = this.winnerOf();
      let mvp = null; for (const p of this.players.values()) if (!mvp || p.kills > mvp.kills) mvp = p;
      const results = [];
      for (const p of this.players.values()) {
        const won = !isFFA(this.mode) ? p.team === win : p.id === win;
        if (won) this.award(p, 500, 'Vitória'); else this.award(p, 150, 'Partida concluída');
        if (mvp === p && p.kills > 0) this.award(p, 150, 'Objetivo: MVP da partida');
        let mmr = 0;
        if (this.ranked) mmr = (won ? 25 : -20) + clamp(p.kills - p.deaths, -10, 10);
        results.push({ id: p.id, name: p.name, team: p.team, bot: p.bot, kills: p.kills, deaths: p.deaths, xp: Math.round(p.xp * (this.training ? 0.5 : 1)), hs: p.stats.hs, won, medUsed: p.stats.medUsed, picks: p.stats.picks, streakMax: p.stats.streakMax, mmr });
      }
      results.sort((a, b) => b.kills - a.kills);
      this.events.push({ e: 'end', win, mode: this.mode, score: this.score.slice(), results, ranked: this.ranked, rounds: this.roundWinners.slice() });
      if (this.onMatchEnd) this.onMatchEnd(results, win);
    }
    restart() {
      this.state = 'playing'; this.matchTime = 0; this.trainSt = 0; this.score = [0, 0]; this.firstBlood = false; this.round = 1; this.roundEndAt = 0; this.roundWinners = [];
      for (const p of this.players.values()) { p.kills = 0; p.deaths = 0; p.xp = 0; p.stats = { hs: 0, medUsed: 0, picks: 0, streakMax: 0 }; this.spawn(p); }
      for (const m of this.medkits) m.active = true;
      this.events.push({ e: 'start' });
    }
    // trem: anda pelo trilho conforme o tempo da partida e empurra quem estiver na frente para o lado
    trainTick() {
      const tr = this.map.train, x = trainFront(tr, this.matchTime), moving = this.matchTime > tr.delay && x < tr.x1;
      this.trainX = x; trainBoxes(tr, x, this.dyn, moving);
      const st = moving ? 1 : x >= tr.x1 ? 2 : 0;
      if (st !== this.trainSt) { this.trainSt = st; if (st) this.events.push({ e: 'train', s: st }); }
      const back = x - tr.cars * (tr.len + tr.gap);
      for (const p of this.players.values()) {
        if (!p.alive || p.x + C.R < back || p.x - C.R > x || Math.abs(p.z - tr.z) > tr.hw + C.R || p.y > tr.y1 - 0.05) continue;
        const h = p.crouch ? C.HC : C.H, side = p.z >= tr.z ? 1 : -1;
        let nz = tr.z + side * (tr.hw + C.R + 0.03);
        if (collides(p.x, p.y, nz, C.R, h)) nz = tr.z - side * (tr.hw + C.R + 0.03);
        p.z = nz; p.vz = side * 2;
      }
    }
    pastPositions(t) {
      const h = this.history;
      if (!h.length) return new Map();
      let best = h[h.length - 1];
      for (let i = h.length - 1; i >= 0; i--) { best = h[i]; if (h[i].t <= t) break; }
      return best.m;
    }
    tick(dt) {
      useMap(this.map, this.dyn);
      this.time += dt;
      if (this.state === 'ended') { if (this.time >= this.endAt) this.restart(); return; }
      this.matchTime += dt;
      if (this.map.train) this.trainTick();
      if (this.timeLimit && this.matchTime >= this.timeLimit) { this.endMatch(); return; }
      if (this.roundEndAt && this.time >= this.roundEndAt) this.nextRound();
      for (const p of this.players.values()) {
        p.budget = Math.min(0.5, p.budget + dt);
        p.bloom = Math.max(0, p.bloom - dt * 0.12);
        if (!p.alive) { if (this.time >= p.respawnAt) this.spawn(p); continue; }
        if (p.reloadUntil && this.time >= p.reloadUntil) {
          p.reloadUntil = 0;
          const w = weaponOf(p), am = p.ammo[w.id];
          const n = Math.min(w.mag - am.mag, am.res); am.mag += n; am.res -= n;
        }
        if (p.medUntil && this.time >= p.medUntil) {
          p.medUntil = 0; p.medkits--; p.stats.medUsed++;
          p.hp = Math.min(C.MAXHP, p.hp + C.MEDHEAL);
          this.events.push({ e: 'med', id: p.id });
        }
        if (p.bot) this.botThink(p, dt);
        for (const m of this.medkits) {
          if (m.active && p.medkits < C.MEDKITS_MAX && Math.abs(p.y - m.y) < 1.2 && Math.hypot(p.x - m.x, p.z - m.z) < 1.1) {
            m.active = false; m.t = this.time + C.MEDKIT_RESPAWN; p.medkits++; p.stats.picks++;
            this.award(p, 10, 'Kit médico coletado');
            this.events.push({ e: 'pick', id: p.id });
          }
        }
      }
      for (const m of this.medkits) if (!m.active && this.time >= m.t) m.active = true;
      const snap = new Map();
      for (const p of this.players.values()) if (p.alive) snap.set(p.id, [p.x, p.y, p.z, p.crouch]);
      this.history.push({ t: this.time, m: snap });
      if (this.history.length > 15) this.history.shift();
    }
    // ---------------- IA dos bots
    addBot(team) {
      useMap(this.map, this.dyn);
      const used = new Set([...this.players.values()].map((p) => p.name));
      const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot' + this.nextId;
      const prim = ['ak47', 'm4a1', 'smg', 'doze', 'ak47', 'm4a1', 'sniper'][Math.floor(Math.random() * 7)];
      const uni = Object.keys(UNIFORMS)[Math.floor(Math.random() * 6)];
      buildNav();
      // alguns bots usam itens da lojinha, para as skins aparecerem nas partidas
      const pick = (t, chance) => { if (Math.random() > chance) return ''; const ids = Object.keys(COSMETICS).filter((k) => COSMETICS[k].type === t && COSMETICS[k].price > 0); return ids[Math.floor(Math.random() * ids.length)] || ''; };
      // bots: maioria é o soldado 3D realista; uns 25% vêm de Cowboy e alguns usam outras skins
      const rr = Math.random();
      // bots: soldado 3D (às vezes de calça 3D), Cyberpunk, Carter, Cowboy e outras skins
      const p3 = () => (Math.random() < 0.4 ? (Math.random() < 0.5 ? 'pa3_camo' : 'pa3_cargo') : '');
      const look = rr < 0.18 ? { c: 'ch_cowboy', s: '', p: '', w: {} } : rr < 0.33 ? { c: 'ch3_cyber', s: '', p: '', w: {} } : rr < 0.48 ? { c: 'ch3_carter', s: '', p: '', w: {} }
        : rr < 0.56 ? { c: pick('char', 1) || 'ch_soldado', s: '', p: '', w: {} } : { c: 'ch_soldado', s: '', p: p3(), w: {} };
      const ws = Object.keys(COSMETICS).filter((k) => COSMETICS[k].type === 'wskin' && COSMETICS[k].weapon === prim);
      if (ws.length && Math.random() < 0.35) look.w[prim] = ws[Math.floor(Math.random() * ws.length)];
      return this.addPlayer({ name, bot: true, team, uniform: uni, look, loadout: { primary: prim, secondary: Math.random() < 0.5 ? 'pistol' : 'deagle' }, level: 1 + Math.floor(Math.random() * 20) });
    }
    canSee(p, o) {
      const ex = p.x, ey = p.y + (p.crouch ? C.EYEC : C.EYE), ez = p.z;
      const tx = o.x, ty = o.y + (o.crouch ? 0.8 : 1.25), tz = o.z;
      let dx = tx - ex, dy = ty - ey, dz = tz - ez; const d = Math.hypot(dx, dy, dz);
      if (d > 70) return false;
      dx /= d; dy /= d; dz /= d;
      return raycastWorld(ex, ey, ez, dx, dy, dz, d) >= d - 0.05;
    }
    botThink(p, dt) {
      const sk = BOT_SKILL[this.training ? 0 : this.botSkill];
      const ai = p.ai || (p.ai = { scan: 0, target: null, seen: 0, path: null, pi: 0, goal: null, repath: 0, strafe: 1, strafeT: 0, lastX: p.x, lastZ: p.z, stuckT: 0, jump: false, crouchT: 0, errX: 0, errY: 0 });
      ai.scan -= dt;
      if (ai.scan <= 0) {
        ai.scan = 0.2;
        let best = null, bd = 1e9;
        for (const o of this.players.values()) {
          if (o === p || !o.alive || (!isFFA(this.mode) && o.team === p.team)) continue;
          const d = Math.hypot(o.x - p.x, o.z - p.z);
          if (d < bd && this.canSee(p, o)) { bd = d; best = o; }
        }
        if (best !== ai.target) { ai.target = best; ai.seen = this.time; ai.errX = (Math.random() - 0.5) * sk.err * 4; ai.errY = (Math.random() - 0.5) * sk.err * 4; }
        if (best) ai.lastSeen = [best.x, best.z];
      }
      const w = weaponOf(p), am = p.ammo[w.id];
      let f = 0, s = 0, b = 0, yaw = p.yaw, pitch = p.pitch;
      const t = ai.target && ai.target.alive ? ai.target : null;
      if (am.mag === 0 && !p.reloadUntil) { if (am.res > 0) this.reload(p); else if (p.cur === 0) this.handleAction(p.id, { a: 'switch', s: 1 }); }
      if (!t && p.hp < 55 && p.medkits > 0 && !p.medUntil) this.handleAction(p.id, { a: 'med' });
      if (t) {
        const ex = p.y + (p.crouch ? C.EYEC : C.EYE);
        const ty = t.y + (t.crouch ? 0.75 : 1.2) + (Math.random() < 0.15 ? 0.4 : 0);
        const dx = t.x - p.x, dz = t.z - p.z, dist = Math.hypot(dx, dz);
        const wantYaw = Math.atan2(-dx, -dz) + ai.errX, wantPitch = Math.atan2(ty - ex, dist) + ai.errY;
        let dy = wantYaw - p.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
        const mt = sk.turn * dt;
        yaw = p.yaw + clamp(dy, -mt, mt); pitch = p.pitch + clamp(wantPitch - p.pitch, -mt, mt);
        ai.errX *= 1 - dt * 1.5; ai.errY *= 1 - dt * 1.5;
        const aligned = Math.abs(dy) < 0.08 + 0.6 / Math.max(dist, 1);
        if (aligned && this.time - ai.seen > sk.react && Math.random() < sk.burst) {
          this.shoot(p, { w: w.id, yaw: yaw + (Math.random() - 0.5) * sk.err, pitch: pitch + (Math.random() - 0.5) * sk.err });
        }
        ai.strafeT -= dt;
        if (ai.strafeT <= 0) { ai.strafeT = 0.6 + Math.random() * 1.2; ai.strafe = Math.random() < 0.5 ? -1 : 1; if (Math.random() < 0.2 && this.botSkill > 0) ai.crouchT = 1 + Math.random(); }
        s = ai.strafe; f = dist > (w.id === 'doze' || w.id === 'smg' ? 6 : 14) ? 0.7 : dist < 4 ? -0.5 : 0;
        if (w.id === 'sniper' && dist > 12) { b |= BTN.ADS; s *= 0.3; }
        if (ai.crouchT > 0) { ai.crouchT -= dt; b |= BTN.CROUCH; }
        ai.path = null;
      } else {
        // navegação
        ai.repath -= dt;
        if (!ai.path || ai.pi >= ai.path.length || ai.repath <= 0) {
          ai.repath = 4 + Math.random() * 3;
          let gx, gz;
          if (ai.lastSeen && Math.random() < 0.6) { [gx, gz] = ai.lastSeen; ai.lastSeen = null; }
          else {
            // ir em direção aos inimigos (área central / inimigo aleatório)
            const enemies = [...this.players.values()].filter((o) => o.alive && o !== p && (isFFA(this.mode) || o.team !== p.team));
            enemies.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
            if (!NAV) buildNav();
            if (enemies.length && Math.random() < 0.65) { const e = enemies[Math.floor(Math.random() * Math.min(3, enemies.length))]; gx = e.x; gz = e.z; }
            else {
              const N = NAV; let id = 0;
              for (let k = 0; k < 30; k++) { id = N.freeList[Math.floor(Math.random() * N.freeList.length)]; if (Math.hypot(N.px((id / N.nj) | 0) - p.x, N.pz(id % N.nj) - p.z) < 60) break; }
              gx = N.px((id / N.nj) | 0); gz = N.pz(id % N.nj);
            }
          }
          ai.path = findPath(p.x, p.z, gx, gz); ai.pi = 0;
        }
        if (ai.path && ai.pi < ai.path.length) {
          const [wx, wz] = ai.path[ai.pi];
          const dx = wx - p.x, dz = wz - p.z, d = Math.hypot(dx, dz);
          if (d < 0.8) ai.pi++;
          const wantYaw = Math.atan2(-dx, -dz);
          let dy = wantYaw - p.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
          yaw = p.yaw + clamp(dy, -8 * dt, 8 * dt);
          pitch = p.pitch * (1 - dt * 3);
          f = Math.abs(dy) < 1.2 ? 1 : 0.2;
          if (Math.abs(dy) < 0.3 && d > 3) b |= BTN.SPRINT;
        }
        ai.stuckT += dt;
        if (ai.stuckT > 1) {
          if (Math.hypot(p.x - ai.lastX, p.z - ai.lastZ) < 0.6 && f > 0) { ai.path = null; ai.jump = true; s = Math.random() < 0.5 ? -1 : 1; }
          ai.stuckT = 0; ai.lastX = p.x; ai.lastZ = p.z;
        }
      }
      if (ai.jump) { b |= BTN.JUMP; ai.jump = false; }
      if (p.medUntil) { f *= 0.5; }
      applyInput(p, { dt, f, s, yaw, pitch, b });
    }
    // ---------------- snapshots
    snapCommon() {
      const pl = [];
      for (const p of this.players.values()) {
        const fl = (p.alive ? 1 : 0) | (p.crouch ? 2 : 0) | (p.ads ? 4 : 0) | (p.reloadUntil ? 8 : 0) | (p.medUntil ? 16 : 0) | (p.onGround ? 32 : 0) | (this.time < p.spawnProt ? 64 : 0);
        pl.push([p.id, r2(p.x), r2(p.y), r2(p.z), r3(p.yaw), r3(p.pitch), fl, p.hp | 0, p.team, p.weapons[p.cur], p.kills, p.deaths]);
      }
      let mk = 0; this.medkits.forEach((m, i) => { if (m.active) mk |= 1 << i; });
      const s = { t: 's', tm: r3(this.time), p: pl, sc: this.score, tl: this.timeLimit ? Math.max(0, Math.round(this.timeLimit - this.matchTime)) : -1, rd: this.round, st: this.state, mk, ev: this.events };
      if (this.map.train) s.tr = r2(this.trainX);
      return s;
    }
    snapMe(p) {
      const w = weaponOf(p), am = p.ammo[w.id] || { mag: 0, res: 0 };
      return {
        id: p.id, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, og: p.onGround ? 1 : 0, cr: p.crouch ? 1 : 0, ack: p.ack, sa: p.shotAck,
        hp: p.hp, al: p.alive ? 1 : 0, cur: p.cur, w: p.weapons, mag: am.mag, res: am.res,
        rl: p.reloadUntil ? r2(p.reloadUntil - this.time) : 0, mu: p.medUntil ? r2(p.medUntil - this.time) : 0, mk: p.medkits,
        ra: p.alive ? 0 : isFinite(p.respawnAt) ? r1(Math.max(0, p.respawnAt - this.time)) : -1, xp: p.xp, sp: this.time < p.spawnProt ? 1 : 0,
      };
    }
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function r3(v) { return Math.round(v * 1000) / 1000; }

  return {
    isRounds, isFFA, MAPS, mapFor, useMap, trainFront, trainBoxes, indexMap, C, BTN, WEAPONS, WEAPON_LIST, UNIFORMS, UPGRADES, COSMETICS, sanitizeLook, lookOf, MAP: MAP_BASE, MISSIONS, MODE_NAMES,
    clamp, collides, applyInput, raycastWorld, rayPlayer, aimDir, weaponOf,
    buildNav, findPath, levelInfo, xpForLevel, newProfile, fixProfile, addXp, applyMatchResult, buy, equip, rankName,
    sanitizeName, sanitizeChat, GameSim,
  };
});
