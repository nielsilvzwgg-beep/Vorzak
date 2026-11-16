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
    CAR_DMG: 50, DOWN_TIME: 1.7, // atropelamento: perde 50 de vida, cai e levanta
    SHOP_START: 800, SHOP_KILL: 150, SHOP_ROUND: 400, SHOP_MAX: 4000, SHOP_DIST: 3.4, // fichas da lojinha das arenas
    R: 0.38, H: 1.8, HC: 1.2, EYE: 1.62, EYEC: 1.05, STEP: 0.55,
    DMG_BODY: 10, DMG_HEAD: 20, // dano por tiro acertado: peito/corpo 10, cabeça 20
    TICK: 1 / 30, MAXHP: 100, MEDHEAL: 50, MEDTIME: 1.6, RESPAWN: 3.5,
    MEDKITS_START: 2, MEDKITS_MAX: 3, SWITCH: 0.45, INTERP: 0.1,
    SPAWN_PROT: 1.5, MEDKIT_RESPAWN: 20, AMMO_BOX: 30, AMMO_RESPAWN: 25, BR_BUSCA: 15, BR_LOBBY: 20,
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
    doze: { id: 'doze', pump: true, name: 'Doze Nova (cal. 12)', slot: 0, dmg: 15, pellets: 8, rpm: 68, mag: 8, reserve: 32, reload: 3.0, spread: 0.075, adsSpread: 0.06, moveMul: 1.2, bloom: 0, bloomMax: 0, recoil: 0.07, recoilYaw: 0.02, range: 12, auto: false, head: 1.5, price: 2000, level: 3, zoom: 1.1, speed: 0.9, snd: { f: 480, d: 0.38, v: 1.1, b: 50 }, sightY: 0.07 },
    maverick: { id: 'maverick', name: 'Maverick 88 (cal. 12)', slot: 0, dmg: 16, pellets: 8, rpm: 75, mag: 6, reserve: 30, reload: 2.6, spread: 0.06, adsSpread: 0.045, moveMul: 1.2, bloom: 0, bloomMax: 0, recoil: 0.065, recoilYaw: 0.02, range: 16, auto: false, head: 1.5, price: 2400, level: 3, zoom: 1.12, speed: 0.92, snd: { f: 430, d: 0.4, v: 1.15, b: 48 }, sightY: 0.08, pump: true },
    smg: { id: 'smg', name: 'Submetralhadora MP5', slot: 0, dmg: 21, pellets: 1, rpm: 850, mag: 30, reserve: 150, reload: 2.0, spread: 0.022, adsSpread: 0.011, moveMul: 1.3, bloom: 0.004, bloomMax: 0.035, recoil: 0.011, recoilYaw: 0.006, range: 25, auto: true, head: 1.8, price: 0, level: 1, zoom: 1.2, speed: 1.0, snd: { f: 1700, d: 0.12, v: 0.7, b: 100 }, sightY: 0.08 },
    sniper: { id: 'sniper', name: 'Sniper AWM .338', slot: 0, dmg: 115, pellets: 1, rpm: 42, mag: 5, reserve: 25, reload: 3.4, spread: 0.09, adsSpread: 0.0008, moveMul: 2.0, bloom: 0, bloomMax: 0, recoil: 0.1, recoilYaw: 0.01, range: 200, auto: false, head: 2.5, price: 4500, level: 5, zoom: 4.5, scope: true, speed: 0.82, snd: { f: 380, d: 0.6, v: 1.25, b: 45 }, sightY: 0.1 },
  };
  const WEAPON_LIST = ['ak47', 'm4a1', 'doze', 'smg', 'sniper', 'pistol', 'deagle', 'maverick'];

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
    ch3_rebeca: { type: 'char', name: 'Rebeca', price: 2000, level: 1, tone: 1, gear: '', model: 'char_rebeca' }, // personagem 3D
    ch3_winter: { type: 'char', name: 'Inverno', price: 2000, level: 1, tone: 0, gear: 'cap', model: 'char_winter' }, // personagem 3D
    ch3_rebeca_mar: { type: 'char', name: 'Rebeca Marinheira', price: 2000, level: 1, tone: 1, gear: '', model: 'char_rebeca', outfit: 'outfit_sailor' }, // skin da Rebeca
    ch3_rebeca_ter: { type: 'char', name: 'Rebeca de Terno', price: 2000, level: 1, tone: 1, gear: '', model: 'char_rebeca', outfit: 'outfit_suit' }, // skin da Rebeca
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
  // caixas de colisão das casas 3D (geradas pelo tools/prop2vzm.py; coordenadas locais em metros)
  // casas por dentro (models/houses.json): cômodos com paredes internas, portas sem porta e janelas abertas
  const HOUSES = {"house_duplex":{"t":0.3,"inset":0.04,"tex":"concrete","col":[0.95,0.93,0.88],"cut":true,"depth":0.32,"rooms":[{"r":[-4.0,-3.7,4.0,5.35],"y":0,"h":2.6,"top":5.1,"open":[{"s":"n","a":0,"w":2.5,"y0":0,"y1":2.2},{"s":"n","a":-2.6,"w":2.0,"y0":0.75,"y1":2.1},{"s":"n","a":2.6,"w":2.0,"y0":0.75,"y1":2.1},{"s":"s","a":0,"w":1.8,"y0":0,"y1":2.15},{"s":"s","a":-2.45,"w":2.0,"y0":0.75,"y1":2.1},{"s":"s","a":2.5,"w":2.0,"y0":0.75,"y1":2.1},{"s":"w","a":0.8,"w":1.8,"y0":0.9,"y1":2.0},{"s":"e","a":0.8,"w":1.8,"y0":0.9,"y1":2.0}]}],"items":[[-2.3,0,3.6],[2.3,0,-2.2]]},"house_casas":{"t":0.18,"inset":0.03,"tex":"concrete","col":[0.86,0.8,0.7],"cut":true,"depth":0.3,"rooms":[{"r":[-2.9,7.3,2.6,10.3],"y":0,"h":2.6,"top":3.5,"open":[{"s":"e","a":8.8,"w":1.15,"y0":0,"y1":2.15},{"s":"n","a":-2.1,"w":0.8,"y0":0.7,"y1":1.6},{"s":"n","a":-0.9,"w":0.8,"y0":0.7,"y1":1.6},{"s":"s","a":-1.35,"w":1.4,"y0":0,"y1":2.15}]},{"r":[-2.9,2.0,0.2,7.3],"y":0,"h":2.5,"top":3.3,"open":[{"s":"n","a":-1.35,"w":1.4,"y0":0,"y1":2.15,"nocut":true},{"s":"e","a":3.3,"w":0.8,"y0":0.7,"y1":1.6},{"s":"e","a":5.2,"w":0.8,"y0":0.7,"y1":1.6},{"s":"w","a":3.2,"w":0.8,"y0":0.7,"y1":1.6},{"s":"w","a":5.1,"w":0.8,"y0":0.7,"y1":1.6},{"s":"s","a":-1.35,"w":1.2,"y0":0,"y1":2.15}]},{"r":[-2.2,-4.3,1.0,-1.2],"y":0,"h":2.35,"top":5.0,"open":[{"s":"e","a":-3.0,"w":1.15,"y0":0,"y1":2.1},{"s":"w","a":-2.75,"w":0.9,"y0":0.7,"y1":1.6},{"s":"n","a":-0.6,"w":0.9,"y0":0.7,"y1":1.6}]},{"r":[-2.3,-10.2,0.9,-7.6],"y":0,"h":2.0,"top":3.2,"open":[{"s":"e","a":-8.3,"w":1.1,"y0":0,"y1":1.95},{"s":"s","a":-0.3,"w":0.7,"y0":0.6,"y1":1.4},{"s":"s","a":-1.6,"w":0.7,"y0":0.6,"y1":1.4},{"s":"w","a":-8.9,"w":0.8,"y0":0.6,"y1":1.4}]}],"items":[[-1.4,0,4.0],[0.5,0,9.2],[-0.6,0,-2.4],[-0.7,0,-9.0]],"extra":[[-2.9,3.5,7.3,0.4,6.3,10.3,"prop"]]},"house_jp":{"t":0.22,"inset":0.04,"tex":"concrete","cut":false,"rooms":[{"r":[-3.66,-3.0,0.3,4.5],"y":1.27,"h":2.43,"top":7.0,"skip":["e"],"open":[{"s":"s","a":-0.56,"w":1.2,"y0":0,"y1":2.25},{"s":"s","a":-2.45,"w":1.2,"y0":0.82,"y1":2.2},{"s":"w","a":-1.24,"w":1.2,"y0":0.82,"y1":2.2},{"s":"w","a":1.88,"w":0.55,"y0":0.82,"y1":1.48},{"s":"w","a":3.21,"w":1.3,"y0":0.82,"y1":1.48},{"s":"n","a":-1.23,"w":1.2,"y0":0,"y1":2.25}]},{"r":[0.3,-3.75,3.9,4.5],"y":1.27,"h":2.43,"top":7.0,"open":[{"s":"w","a":0.75,"w":7.5,"y0":0,"y1":2.43},{"s":"s","a":2.33,"w":1.6,"y0":0,"y1":2.2},{"s":"e","a":-1.64,"w":1.6,"y0":0,"y1":2.2},{"s":"e","a":2.3,"w":1.6,"y0":0.52,"y1":1.89}]}],"extra":[[-3.66,0,-3.75,3.9,1.27,4.5,"prop"],[-3.58,0,-4.1,-1.45,0.89,-2.93,"prop"],[-4.96,0,4.5,0.17,1.27,5.63,"prop"],[3.9,0,-2.64,4.64,1.0,-0.64,"prop"],[4.64,0,-2.64,5.1,0.5,-0.64,"prop"],[-6.85,0,-5.88,-6.62,0.93,5.91,"prop"],[6.67,0,-5.66,6.84,1.04,5.64,"prop"],[-6.69,0,5.63,6.85,2.06,5.9,"prop"],[-3.3,0,-5.88,-2.0,1.95,-5.43,"prop"],[-2.0,0,-5.88,6.69,1.5,-5.43,"prop"],[-2.15,0,-5.43,-1.2,0.4,-4.1,"prop"],[-1.2,0,-5.43,0.63,0.8,-4.41,"prop"],[-1.46,0,-4.41,0.39,1.27,-3.75,"prop"]],"items":[[-2.2,1.27,2.5],[2.3,1.27,1.0]],"col":[0.92,0.9,0.85]}};
  // paredes (com vãos de porta/janela), teto e piso de cada casa — caixas locais [x0,y0,z0,x1,y1,z1,tipo,sólida,cor]
  function houseBoxes(H) {
    const out = [], T = H.t, IN = H.inset, tex = H.tex || 'prop', col = H.col || null;
    const B = (x0, y0, z0, x1, y1, z1, t = tex, solid = 1) => { if (x1 - x0 > 0.01 && y1 - y0 > 0.01 && z1 - z0 > 0.01) out.push([+x0.toFixed(3), +y0.toFixed(3), +z0.toFixed(3), +x1.toFixed(3), +y1.toFixed(3), +z1.toFixed(3), t, solid, t === 'prop' ? null : col]); };
    for (const rm of H.rooms) {
      const [x0, z0, x1, z1] = rm.r, y = rm.y, h = rm.h, skip = rm.skip || [];
      const sides = { n: ['x', z1 - IN - T, z1 - IN, x0 + IN, x1 - IN], s: ['x', z0 + IN, z0 + IN + T, x0 + IN, x1 - IN], e: ['z', x1 - IN - T, x1 - IN, z0 + IN + T, z1 - IN - T], w: ['z', x0 + IN, x0 + IN + T, z0 + IN + T, z1 - IN - T] };
      for (const sd in sides) {
        if (skip.includes(sd)) continue;
        const [along, c0, c1, a0, a1] = sides[sd];
        const ops = (rm.open || []).filter((o) => o.s === sd).map((o) => [Math.max(a0, o.a - o.w / 2), Math.min(a1, o.a + o.w / 2), o.y0, o.y1]).sort((p, q) => p[0] - q[0]);
        const seg = (s0, s1, yA, yB) => { if (along === 'x') B(s0, y + yA, c0, s1, y + yB, c1); else B(c0, y + yA, s0, c1, y + yB, s1); };
        let cur = a0;
        for (const [o0, o1, oy0, oy1] of ops) { seg(cur, o0, 0, h); seg(o0, o1, 0, oy0); seg(o0, o1, oy1, h); cur = Math.max(cur, o1); }
        seg(cur, a1, 0, h);
      }
      B(x0 + IN, y + h, z0 + IN, x1 - IN, y + h + 0.2, z1 - IN); // teto
      if (rm.top > y + h + 0.2) B(x0, y + h + 0.2, z0, x1, rm.top, z1, 'prop'); // andar de cima (fechado)
      if (H.tex) B(x0 + IN, y, z0 + IN, x1 - IN, y + 0.03, z1 - IN, 'wood', 0); // piso
    }
    for (const e of H.extra || []) B(e[0], e[1], e[2], e[3], e[4], e[5], e[6] || 'prop');
    return out;
  }
  const PROP_BOXES = {};
  for (const k in HOUSES) PROP_BOXES[k] = houseBoxes(HOUSES[k]);
  // vaga livre para um carro (nenhuma caixa sólida até 3,4 m)
  function carFree(solids, x, z) {
    for (const b of solids) if (b[1] < 1.6 && x + 3.4 > b[0] && x - 3.4 < b[3] && z + 3.4 > b[2] && z - 3.4 < b[5]) return false;
    return true;
  }
  const MAP_OPEN = (function () {
    const { solids, deco, add, bx, wall, door, win, house } = builder();
    let seed = 20261115;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const rr = (a, b) => a + rnd() * (b - a);
    const SX = 300, SZ = 200;
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
    for (let x = -210; x <= 210; x += 25) for (const s of [-1, 1]) {
      if (x > 148 && x < 212) continue; // estação tem cobertura
      add(x - 0.12, 0, s * 3.4 - 0.12, x + 0.12, 6.2, s * 3.4 + 0.12, 'pole', true, [0.3, 0.3, 0.32]);
      add(x - 0.06, 5.9, s > 0 ? 1.2 : -3.4, x + 0.06, 6.0, s > 0 ? 3.4 : -1.2, 'pole', false, [0.3, 0.3, 0.32]);
    }

    // ruas (decoração): duas transversais que cruzam a linha (passagens de nível) e duas paralelas
    add(-49, 0, -SZ + 0.5, -41, 0.02, SZ - 0.5, 'road', false); keepOut(-50, -SZ, -40, SZ);
    add(41, 0, -SZ + 0.5, 49, 0.02, SZ - 0.5, 'road', false); keepOut(40, -SZ, 50, SZ);
    add(-SX + 0.5, 0, 36, SX - 0.5, 0.021, 44, 'road', false); keepOut(-SX, 35, SX, 45);
    add(-SX + 0.5, 0, -49, SX - 0.5, 0.021, -41, 'road', false); keepOut(-SX, -50, SX, -40);
    add(-134, 0, -SZ + 0.5, -126, 0.019, SZ - 0.5, 'road', false); keepOut(-135, -SZ, -125, SZ);
    add(126, 0, -SZ + 0.5, 134, 0.019, SZ - 0.5, 'road', false); keepOut(125, -SZ, 135, SZ);
    add(-SX + 0.5, 0, 124, SX - 0.5, 0.022, 132, 'road', false); keepOut(-SX, 123, SX, 133);
    add(-SX + 0.5, 0, -132, SX - 0.5, 0.022, -124, 'road', false); keepOut(-SX, -133, SX, -123);
    // região nova (mapa maior): ruas nas pontas
    add(-264, 0, -SZ + 0.5, -256, 0.018, SZ - 0.5, 'road', false); keepOut(-265, -SZ, -255, SZ);
    add(256, 0, -SZ + 0.5, 264, 0.018, SZ - 0.5, 'road', false); keepOut(255, -SZ, 265, SZ);
    add(-SX + 0.5, 0, 171, SX - 0.5, 0.023, 179, 'road', false); keepOut(-SX, 170, SX, 180);
    add(-SX + 0.5, 0, -179, SX - 0.5, 0.023, -171, 'road', false); keepOut(-SX, -180, SX, -170);
    // casas 3D (duplex, fileira de casas e casa japonesa) — colisão pelas caixas do modelo, giradas de 90 em 90°
    const props = [], houseM = [], houseW = [];
    const prop = (name, x, z, q) => {
      props.push([name, x, z, q]);
      for (const b of PROP_BOXES[name]) {
        let [x0, y0, z0, x1, y1, z1] = b;
        for (let k = 0; k < q; k++) { const nx0 = z0, nx1 = z1, nz0 = -x1, nz1 = -x0; x0 = nx0; x1 = nx1; z0 = nz0; z1 = nz1; } // gira 90° (yaw +)
        add(x + x0, Math.max(0, y0), z + z0, x + x1, y1, z + z1, b[6] || 'prop', b[7] !== 0, b[8] || null);
      }
      // kit médico e arma dentro da casa (no chão), alternando
      ((HOUSES[name] && HOUSES[name].items) || []).forEach(([lx, ly, lz], k) => {
        for (let r = 0; r < q; r++) { const t = lx; lx = lz; lz = -t; }
        (k % 2 ? houseW : houseM).push([Math.round((x + lx) * 10) / 10, ly, Math.round((z + lz) * 10) / 10]);
      });
      const bb = PROP_BOXES[name].reduce((a, b) => [Math.min(a[0], b[0], b[2]), Math.max(a[1], b[3], b[5])], [0, 0]);
      keepOut(x + bb[0] - 1.5, z + bb[0] - 1.5, x + bb[1] + 1.5, z + bb[1] + 1.5);
    };
    for (const s of [-1, 1]) {
      // oeste: casas japonesas e duplex dos dois lados da rua x = -260
      for (const zz of [-160, -110, -60, 60, 110, 155]) prop('house_jp', -260 + s * 18, zz, s > 0 ? 1 : 3);
      for (const zz of [-135, -85, -35, 35, 85, 132]) prop('house_duplex', -260 + s * 14, zz, s > 0 ? 1 : 3);
      // leste: fileiras de casas e duplex na rua x = 260
      for (const zz of [-150, -110, -70, 70, 110, 150]) prop('house_casas', 260 + s * 14, zz, s > 0 ? 3 : 1);
      for (const zz of [-130, -90, -50, 50, 90, 130]) prop('house_duplex', 260 + s * 14, zz, s > 0 ? 3 : 1);
      // norte e sul: casas ao longo das ruas z = ±175
      for (let xx = -230; xx <= 230; xx += 32) {
        if (Math.abs(xx + 130) < 14 || Math.abs(xx + 45) < 14 || Math.abs(xx - 45) < 14 || Math.abs(xx - 130) < 14) continue;
        prop((xx / 32 + 8) % 2 ? 'house_casas' : 'house_duplex', xx, s * 160, s > 0 ? 2 : 0);
        prop('house_duplex', xx + 8, s * 190, s > 0 ? 0 : 2);
      }
    }
    // cancelas das passagens de nível
    for (const cx of [-130, -45, 45, 130]) for (const s of [-1, 1]) {
      const gx = cx + s * 4.6;
      add(gx - 0.15, 0, s * 4.2 - 0.15, gx + 0.15, 1.2, s * 4.2 + 0.15, 'barrier');
      add(Math.min(gx, gx - s * 3.6), 1.05, s * 4.2 - 0.06, Math.max(gx, gx - s * 3.6), 1.15, s * 4.2 + 0.06, 'barrier', false);
    }

    // depósito de trens (oeste): o trem começa aqui dentro
    {
      const x0 = -215, x1 = -144, h = 7.5, th = 0.4;
      wall('x', -5.6, x0, x1, th, h, 'brick', [door(-202, 2.4, 2.6), win(-190, 2.2), win(-178, 2.2), door(-166, 2.4, 2.6), win(-154, 2.2)]);
      wall('x', 5.6, x0, x1, th, h, 'brick', [win(-202, 2.2), door(-190, 2.4, 2.6), win(-178, 2.2), win(-166, 2.2), door(-154, 2.4, 2.6)]);
      wall('z', x0, -5.4, 5.4, th, h, 'brick', [win(-3.5, 2), win(3.5, 2)]);
      add(x1 - 0.5, 5.4, -5.8, x1, h, 5.8, 'brick'); // viga da porta grande (leste fica aberto)
      add(x0 - 0.3, h, -6.2, x1 + 0.3, h + 0.35, 6.2, 'roof');
      for (const s of [-1, 1]) for (let x = -210; x < -148; x += 12) bx(x, s * 4.2, 1.2, 1.2, 1.2, 'crate');
      bx(-210, -4.2, 1.2, 1.2, 1.2, 'crate', 1.2);
      keepOut(x0 - 2, -9, x1 + 2, 9);
    }

    // estação final (leste): plataformas dos dois lados, cobertura, prédio e para-choque
    {
      const xa = 150, xb = 211;
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
        const x0 = 164, x1 = 192, z0 = 9.5, z1 = 21, h = 5.2, th = 0.3;
        wall('x', z0 + th / 2, x0, x1, th, h, 'brick', [door(170, 2.2, 2.6), win(178, 2.4), door(186, 2.2, 2.6)]);
        wall('x', z1 - th / 2, x0, x1, th, h, 'brick', [win(170, 2.4), door(178, 2.4, 2.6), win(186, 2.4)]);
        wall('z', x0 + th / 2, z0 + th, z1 - th, th, h, 'brick', [win(15, 2)]);
        wall('z', x1 - th / 2, z0 + th, z1 - th, th, h, 'brick', [door(15, 2.2, 2.6)]);
        add(x0 - 0.3, h, z0 - 0.3, x1 + 0.3, h + 0.3, z1 + 0.3, 'roof');
        add(x0 + 4, 0, 13.5, x0 + 8, 1.1, 14.5, 'wood'); add(x1 - 8, 0, 13.5, x1 - 4, 1.1, 14.5, 'wood');
        // ligação plataforma -> prédio
        add(168, 0, 7.6, 172, 1.0, 9.4, 'concrete'); add(184, 0, 7.6, 188, 1.0, 9.4, 'concrete');
        add(168, 0, 9.4, 172, 0.5, 10.4, 'concrete'); add(184, 0, 9.4, 188, 0.5, 10.4, 'concrete');
      }
      add(212, 0, -1.7, 214.5, 1.5, 1.7, 'metal', true, [0.75, 0.15, 0.08]); // para-choque
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
    for (const cx of [-204, -188, -172, -156, -140, -108, -92, -76, -24, 14, 28, 62, 78, 94, 110, 148, 204]) houseAt(cx, 29, 1, rnd() < 0.5 ? 'brick' : 'concrete');
    for (const cx of [-204, -188, -172, -156, -140, -108, -92, -76, -24, -10, 14, 28, 62, 78, 94, 110, 148, 164, 180, 196]) houseAt(cx, 51, -1, rnd() < 0.6 ? 'brick' : 'concrete');
    // bairros novos (ruas z = 128 e z = -128)
    for (const zz of [116, -116]) for (let cx = -204; cx <= 204; cx += 16) { if (Math.abs(cx + 130) < 9 || Math.abs(cx + 45) < 9 || Math.abs(cx - 45) < 9 || Math.abs(cx - 130) < 9 || (zz < 0 && cx > 86 && cx < 156)) continue; houseAt(cx, zz, zz > 0 ? 1 : -1, rnd() < 0.5 ? 'brick' : 'concrete'); }
    for (const zz of [140, -140]) for (let cx = -196; cx <= 196; cx += 16) { if (Math.abs(cx + 130) < 9 || Math.abs(cx + 45) < 9 || Math.abs(cx - 45) < 9 || Math.abs(cx - 130) < 9) continue; if (rnd() < 0.2) continue; houseAt(cx, zz, zz > 0 ? -1 : 1, rnd() < 0.5 ? 'brick' : 'concrete'); }
    // casas soltas nas laterais (oeste e leste)
    for (const [cx, cz] of [[-200, -20], [-184, -24], [-196, -70], [-178, -88], [-200, 80], [-180, 92], [-160, 76], [176, -20], [196, -24], [180, -70], [200, -88], [166, 80], [186, 92], [204, 74]]) houseAt(cx, cz, rnd() < 0.5 ? 1 : -1, rnd() < 0.5 ? 'brick' : 'concrete');
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
    while (rocks < 75 && guard++ < 5000) {
      const x = rr(-SX + 6, SX - 6), z = rr(-SZ + 6, SZ - 6), w = rr(1.4, 3.4), d = rr(1.2, 3.0), h = rr(0.7, 1.8);
      if (!freeAt(x, z, Math.max(w, d))) continue;
      bx(x, z, w, d, h, 'rock', 0, [0.45 + rnd() * 0.1, 0.44 + rnd() * 0.08, 0.42]);
      if (rnd() < 0.4) bx(x + rr(-1, 1), z + rr(-1, 1), w * 0.6, d * 0.6, h * 0.6, 'rock', h * 0.9, [0.5, 0.49, 0.46]);
      rocks++;
    }
    let trees = 0; guard = 0;
    while (trees < 320 && guard++ < 9000) {
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
    const medkits = [[-120, 0, -24], [-100, 0, -31], [-51, 0, -72], [40, 0, -80], [60, 0, -64], [110, 0, -75], [128, 0, -92], [-60, 0, 60], [-20, 0, 66], [8, 0, 66], [60, 0, 92], [96, 0, 62], [-132, 0, 80], [-104, 0, 8], [-60, 0, -8], [20, 0, 12], [70, 0, -10], [178, 1.0, 5], [178, 1.0, -5], [0, 6.2, 0], [-140, 0, -60]];
    for (let g = 0; g < 400 && medkits.length < 31; g++) { const x = rr(-SX + 8, SX - 8), z = rr(-SZ + 8, SZ - 8); if (Math.abs(z) > 7 && freeAt(x, z, 1)) medkits.push([Math.round(x), 0, Math.round(z)]); }
    // armas no chão para pegar (trocam a arma do mesmo tipo)
    const WL = ['ak47', 'm4a1', 'doze', 'smg', 'sniper', 'deagle', 'ak47', 'm4a1', 'smg', 'pistol', 'maverick', 'maverick'];
    const weapons = [[0, 6.2, -4, 'sniper'], [0, 6.2, 4, 'sniper'], [-180, 0, 3.5, 'ak47'], [-170, 0, -3.5, 'm4a1'], [176, 1.0, 4, 'doze'], [182, 1.0, -4, 'm4a1'], [-112, 0, -24, 'doze'], [46, 0, -66, 'ak47'], [-20, 0, 76, 'deagle'], [60, 0, 88, 'smg']];
    for (let g = 0; g < 600 && weapons.length < 31; g++) { const x = rr(-SX + 8, SX - 8), z = rr(-SZ + 8, SZ - 8); if (Math.abs(z) > 7 && freeAt(x, z, 1)) weapons.push([Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10, WL[Math.floor(rnd() * WL.length)]]); }
    for (const m of houseM) medkits.push(m);
    houseW.forEach(([x, y, z], k) => weapons.push([x, y, z, ['maverick', 'ak47', 'm4a1', 'doze', 'smg', 'deagle', 'sniper', 'maverick'][(k * 5 + 3) % 8]]));
    // caixa de munição (+30) ao lado de cada arma do chão
    const ammoFree = (x, y, z) => {
      if (Math.abs(x) > SX - 2 || Math.abs(z) > SZ - 2) return false;
      for (const b of solids) if (x + 0.3 > b[0] && x - 0.3 < b[3] && z + 0.3 > b[2] && z - 0.3 < b[5] && y + 0.05 < b[4] && y + 0.45 > b[1]) return false;
      return true;
    };
    const ammo = [];
    for (const [x, y, z] of weapons) {
      for (const [dx, dz] of [[1.0, 0], [-1.0, 0], [0, 1.0], [0, -1.0], [0.8, 0.8], [-0.8, -0.8]]) {
        if (ammoFree(x + dx, y, z + dz)) { ammo.push([Math.round((x + dx) * 10) / 10, y, Math.round((z + dz) * 10) / 10]); break; }
      }
    }
    const train = { z: 0, x0: -146, x1: 209.5, speed: 7, delay: 12, cars: 3, len: 20.85, gap: 0.8, hw: 1.45, y0: 0.32, y1: 4.2 };
    // carros (McLaren) para dirigir: nas ruas, longe da linha do trem
    const cars = [];
    for (const [x0, z0, yaw, t] of [[-45, 95, 0], [45, -95, 3.14], [-130, -88, 0], [130, 88, 3.14], [-90, 40, 1.57], [90, -40, -1.57], [-200, 128, 1.57], [200, -128, -1.57], [-260, 20, 0], [260, -20, 3.14],
      [-45, -95, 0, 'luaz'], [45, 95, 3.14, 'luaz'], [-130, 92, 0, 'luaz'], [130, -92, 3.14, 'luaz'], [0, 128, 1.57, 'luaz'], [0, -128, -1.57, 'luaz']]) { // McLaren e LUAZ
      for (let g = 0; g < 60; g++) { const x = x0 + (g ? rr(-4, 4) : 0), z = z0 + (g ? rr(-12, 12) : 0); if (Math.abs(z) > 9 && carFree(solids, x, z) && !cars.some((c) => Math.hypot(c[0] - x, c[1] - z) < 7)) { cars.push(t ? [Math.round(x * 10) / 10, Math.round(z * 10) / 10, yaw, t] : [Math.round(x * 10) / 10, Math.round(z * 10) / 10, yaw]); break; } }
    }
    return { id: 'aberto', name: 'Cidade', solids, deco, spawns, medkits, weapons, ammo, props, sx: SX, sz: SZ, train, cars };
  })();
  // ================================================================ MAPA "ILHA" (inspirado na imagem enviada)
  // Ilha cercada de mar, com neve e montanhas a oeste, floresta ao norte, pântano a nordeste, campos no centro
  // (castelo), deserto a sudeste, lagos e ilhotas. Água rasa: dá para atravessar devagar; carro não entra.
  const ISLAND_ZONES = [ // 32 x 24 (norte em cima = -z). ~ mar, l lago, g grama, f floresta, w pântano, s neve, d deserto
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~ffffffffffff~~~~~~~~~~',
    '~~~~~~~fffffffffffffffff~~~~~~~~',
    '~~~~~ffffffffffffffffffff~~~~~~~',
    '~~~~~fffffffffffffffffffffwww~~~',
    '~~~~ffffflfffffffffffff~~wwwwww~',
    '~~~~~fffffffffffffff~~~~~wwwwww~',
    '~~~~gggggffffffffff~~~~~wwwwwww~',
    '~~sssggggggflllfff~~~~~~~wwwww~~',
    '~ssssgggggfflllfgg~~~~~~~~~~~~~~',
    '~sssssgggggggggggggg~ggggg~~~~~~',
    '~sssssggggggggggdddddddddd~gg~~~',
    '~ssssssgggggggggdddddddddd~~gg~~',
    '~sssssssggggggggddddddldddd~~~~~',
    '~ssssssggggggggdddddddlddd~~~~~~',
    '~~sssssgggggggddddddddddddd~~~~~',
    '~~ssssssggggggdddddddddddd~~gg~~',
    '~~ssssssgggggggdddddddddd~~~~~~~',
    '~~sssssssggggggggdddddd~~~~~~~~~',
    '~~~ssssssgggggggggggggg~~~~~~~~~',
    '~~~~sssss~~~ggggggggggg~~~~~~~~~',
    '~~~~~~~~~~~~~~~ggggggg~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ];
  const ZONE_ID = { '~': 0, l: 1, g: 2, f: 3, w: 4, s: 5, d: 6 }; // 0/1 = água
  const MAP_ISLAND = (function () {
    const { solids, deco, add, bx, wall, door, win, house } = builder();
    const SX = 260, SZ = 200, ZG = 2; // grade de zonas a cada 2 m
    let seed = 7342211;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const rr = (a, b) => a + rnd() * (b - a);
    // ruído suave (litoral recortado)
    const hsh = (i, j) => { let h = (i * 374761393 + j * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vn = (x, y) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy); return (hsh(i, j) * (1 - u) + hsh(i + 1, j) * u) * (1 - v) + (hsh(i, j + 1) * (1 - u) + hsh(i + 1, j + 1) * u) * v; };
    const RAILZ = -8, RX0 = -250, RX1 = 142;
    const NW = Math.round(2 * SX / ZG), NH = Math.round(2 * SZ / ZG), zone = new Uint8Array(NW * NH);
    for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
      const x = -SX + (i + 0.5) * ZG, z = -SZ + (j + 0.5) * ZG;
      const nu = (vn(x / 23, z / 23) - 0.5) * 1.5 + (vn(x / 9 + 50, z / 9) - 0.5) * 0.5, nv = (vn(x / 23 + 91, z / 23 + 17) - 0.5) * 1.5 + (vn(x / 9, z / 9 + 70) - 0.5) * 0.5;
      const u = Math.max(0, Math.min(31.99, (x + SX) / (2 * SX) * 32 + nu)), v = Math.max(0, Math.min(23.99, (z + SZ) / (2 * SZ) * 24 + nv));
      let id = ZONE_ID[ISLAND_ZONES[Math.floor(v)][Math.floor(u)]];
      if (Math.abs(z - RAILZ) < 9 && x > RX0 - 6 && x < RX1 + 6 && id <= 1) id = x < -150 ? 5 : x < -20 ? 2 : 6; // a linha do trem sempre em terra
      zone[j * NW + i] = id;
    }
    const zoneAt = (x, z) => { const i = Math.floor((x + SX) / ZG), j = Math.floor((z + SZ) / ZG); return i < 0 || j < 0 || i >= NW || j >= NH ? 0 : zone[j * NW + i]; };
    const land = (x, z, r = 0) => zoneAt(x, z) > 1 && (!r || (zoneAt(x - r, z - r) > 1 && zoneAt(x + r, z - r) > 1 && zoneAt(x - r, z + r) > 1 && zoneAt(x + r, z + r) > 1));
    const blocked = [];
    const keepOut = (x0, z0, x1, z1) => blocked.push([x0, z0, x1, z1]);
    function freeAt(x, z, r) {
      if (Math.abs(x) > SX - 4 || Math.abs(z) > SZ - 4 || !land(x, z, r)) return false;
      for (const b of blocked) if (x + r > b[0] && x - r < b[2] && z + r > b[1] && z - r < b[3]) return false;
      for (const b of solids) if (b[1] < 2 && x + r > b[0] && x - r < b[3] && z + r > b[2] && z - r < b[5]) return false;
      return true;
    }
    // borda do mundo (no mar)
    bx(0, -SZ, 2 * SX + 2, 1, 6, 'concrete'); bx(0, SZ, 2 * SX + 2, 1, 6, 'concrete');
    bx(-SX, 0, 1, 2 * SZ, 6, 'concrete'); bx(SX, 0, 1, 2 * SZ, 6, 'concrete');

    // ---- peças em coordenadas locais, giradas de 90 em 90° (q) e levadas para (cx, cz)
    function placer(cx, cz, q) {
      const T = (x, z) => { for (let k = 0; k < q; k++) { const t = x; x = z; z = -t; } return [cx + x, cz + z]; };
      const box = (x0, y0, z0, x1, y1, z1, t, solid = true, col = null) => { const a = T(x0, z0), b = T(x1, z1); return add(a[0], y0, a[1], b[0], y1, b[1], t, solid, col); };
      return { T, box };
    }
    const itemsM = [], itemsW = [];
    // casa de 2 andares: porta da frente aberta, janelas sem vidro, escada interna, sacada e laje
    function house2(cx, cz, q, t, col) {
      const { T, box } = placer(cx, cz, q), W = 5, D = 4, th = 0.25, H1 = 3.2, SL = 0.25, H2 = 2.9, F2 = H1 + SL;
      const wl = (along, c, a0, a1, h, ops, y0) => { // parede local
        ops = ops.slice().sort((p, r) => p.a - r.a); let cur = a0;
        const seg = (s0, s1, yA, yB) => { if (s1 - s0 < 0.01 || yB - yA < 0.01) return; if (along === 'x') box(s0, y0 + yA, c - th / 2, s1, y0 + yB, c + th / 2, t, true, col); else box(c - th / 2, y0 + yA, s0, c + th / 2, y0 + yB, s1, t, true, col); };
        for (const o of ops) { const o0 = o.a - o.w / 2, o1 = o.a + o.w / 2; seg(cur, o0, 0, h); seg(o0, o1, 0, o.y0); seg(o0, o1, o.y1, h); cur = o1; }
        seg(cur, a1, 0, h);
      };
      // térreo
      wl('x', -D + th / 2, -W, W, H1, [door(0, 1.7, 2.4), win(3.4, 1.4), win(-3.4, 1.4)], 0);
      wl('x', D - th / 2, -W, W, H1, [win(-2, 1.4), door(3.6, 1.3, 2.3)], 0);
      wl('z', -W + th / 2, -D + th, D - th, H1, [win(-1.2, 1.4)], 0);
      wl('z', W - th / 2, -D + th, D - th, H1, [door(0, 1.5, 2.4)], 0);
      // escada (11 degraus, junto da parede do fundo) e laje com o vão da escada
      const n = 11, rise = F2 / n, run = 0.5, sx0 = -3.9, sz0 = 2.55, sz1 = D - th;
      for (let i = 0; i < n; i++) box(sx0 + i * run, 0, sz0, sx0 + (i + 1) * run, rise * (i + 1), sz1, 'wood');
      const hx1 = sx0 + n * run;
      box(-W, H1, -D, W, F2, sz0, t === 'wood' ? 'wood' : 'concrete');
      box(hx1, H1, sz0, W, F2, D, t === 'wood' ? 'wood' : 'concrete');
      box(-W, H1, sz0, sx0, F2, D, t === 'wood' ? 'wood' : 'concrete');
      box(sx0, F2, sz0 - 0.1, hx1 - 1.0, F2 + 0.95, sz0, 'pole', true, [0.3, 0.3, 0.32]); // guarda-corpo do vão
      // andar de cima: janela grande e porta da sacada
      wl('x', -D + th / 2, -W, W, H2, [door(0, 1.5, 2.3), win(-3.2, 1.4), win(3.2, 1.4)], F2);
      wl('x', D - th / 2, -W, W, H2, [win(1.5, 1.6)], F2);
      wl('z', -W + th / 2, -D + th, D - th, H2, [win(-0.8, 1.6)], F2);
      wl('z', W - th / 2, -D + th, D - th, H2, [win(0, 1.6)], F2);
      box(-W - 0.35, F2 + H2, -D - 0.35, W + 0.35, F2 + H2 + 0.3, D + 0.35, 'roof');
      // sacada na frente
      box(-2.4, H1, -D - 1.6, 2.4, F2, -D, 'concrete');
      box(-2.4, F2, -D - 1.6, 2.4, F2 + 0.95, -D - 1.48, 'pole', true, [0.3, 0.3, 0.32]);
      box(-2.4, F2, -D - 1.6, -2.28, F2 + 0.95, -D, 'pole', true, [0.3, 0.3, 0.32]);
      box(2.28, F2, -D - 1.6, 2.4, F2 + 0.95, -D, 'pole', true, [0.3, 0.3, 0.32]);
      for (const x of [-2.2, 2.2]) box(x - 0.14, 0, -D - 1.5, x + 0.14, H1, -D - 1.22, 'concrete');
      // kits e armas: térreo, andar de cima e sacada
      for (const [lx, ly, lz, w] of [[3, 0, -1.5, 0], [-2.5, F2, -0.8, 1], [1.2, F2, 0.8, 0], [0, H1 + SL, -D - 0.8, 1]]) { const p = T(lx, lz); (w ? itemsW : itemsM).push([Math.round(p[0] * 10) / 10, ly, Math.round(p[1] * 10) / 10]); }
      const a = T(-W - 2, -D - 3), b = T(W + 2, D + 2); keepOut(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
    }
    // casa térrea de adobe (deserto): telhado plano com escada externa e mureta — dá para subir no teto
    function adobe(cx, cz, q) {
      const { T, box } = placer(cx, cz, q), W = 4, D = 3.5, th = 0.35, H = 3.0, col = [0.86, 0.72, 0.52];
      const wl = (along, c, a0, a1, ops) => { ops = ops.slice().sort((p, r) => p.a - r.a); let cur = a0; const seg = (s0, s1, yA, yB) => { if (s1 - s0 < 0.01 || yB - yA < 0.01) return; if (along === 'x') box(s0, yA, c - th / 2, s1, yB, c + th / 2, 'plaster', true, col); else box(c - th / 2, yA, s0, c + th / 2, yB, s1, 'plaster', true, col); }; for (const o of ops) { const o0 = o.a - o.w / 2, o1 = o.a + o.w / 2; seg(cur, o0, 0, H); seg(o0, o1, 0, o.y0); seg(o0, o1, o.y1, H); cur = o1; } seg(cur, a1, 0, H); };
      wl('x', -D + th / 2, -W, W, [door(-1, 1.5, 2.3), win(2, 1.2)]);
      wl('x', D - th / 2, -W, W, [win(-1.5, 1.2), win(1.8, 1.2)]);
      wl('z', -W + th / 2, -D + th, D - th, [door(0.3, 1.3, 2.3)]);
      wl('z', W - th / 2, -D + th, D - th, [win(0, 1.2)]);
      box(-W - 0.1, H, -D - 0.1, W + 0.1, H + 0.3, D + 0.1, 'plaster', true, [0.8, 0.66, 0.46]);
      for (const [x0, z0, x1, z1] of [[-W - 0.1, -D - 0.1, W + 0.1, -D + 0.15], [-W - 0.1, D - 0.15, W + 0.1, D + 0.1], [-W - 0.1, -D - 0.1, -W + 0.15, D + 0.1]]) box(x0, H + 0.3, z0, x1, H + 0.95, z1, 'plaster', true, col);
      const n = 8, rise = (H + 0.3) / n; // escada externa encostada na parede leste, chegando ao teto
      for (let i = 0; i < n; i++) box(W + 0.1, 0, D - 0.4 - (i + 1) * 0.55, W + 1.2, rise * (i + 1), D - 0.4 - i * 0.55, 'plaster', true, [0.78, 0.64, 0.44]);
      for (const [lx, ly, lz, w] of [[2, 0, 1.5, 0], [-2, H + 0.3, 0, 1]]) { const p = T(lx, lz); (w ? itemsW : itemsM).push([Math.round(p[0] * 10) / 10, ly, Math.round(p[1] * 10) / 10]); }
      const a = T(-W - 2, -D - 2), b = T(W + 3, D + 2); keepOut(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1]));
    }
    // cabana de madeira (neve, floresta e pântano)
    function cabin(cx, cz, q) {
      const { T } = placer(cx, cz, q), side = q % 2 ? 1 : -1;
      house(cx, cz, 8, 7, 3.0, side, 'wood');
      const p = T(1.5, 1); itemsM.push([Math.round(p[0] * 10) / 10, 0, Math.round(p[1] * 10) / 10]);
      const p2 = T(-2, -1); itemsW.push([Math.round(p2[0] * 10) / 10, 0, Math.round(p2[1] * 10) / 10]);
      keepOut(cx - 6, cz - 6, cx + 6, cz + 6);
    }
    const fits = (cx, cz, r) => freeAt(cx, cz, r);

    // ---- ferrovia (oeste -> leste, z = -8) com depósito e estação
    add(RX0, 0, RAILZ - 2.6, RX1 + 4, 0.04, RAILZ + 2.6, 'gravel', false);
    add(RX0, 0.04, RAILZ - 1.5, RX1 + 4, 0.06, RAILZ + 1.5, 'rail', false);
    keepOut(RX0 - 4, RAILZ - 6, RX1 + 8, RAILZ + 6);
    add(RX1 + 3.5, 0, RAILZ - 1.7, RX1 + 6, 1.5, RAILZ + 1.7, 'metal', true, [0.75, 0.15, 0.08]); // para-choque
    for (const s of [-1, 1]) { // plataforma da estação final
      const za = RAILZ + (s > 0 ? 2.35 : -7.6), zb = RAILZ + (s > 0 ? 7.6 : -2.35);
      add(RX1 - 40, 0, za, RX1 + 2, 1.0, zb, 'concrete'); add(RX1 - 41, 0, za, RX1 - 40, 0.5, zb, 'concrete');
      add(RX1 - 38, 4.6, s > 0 ? RAILZ + 1.9 : RAILZ - 8.2, RX1, 4.85, s > 0 ? RAILZ + 8.2 : RAILZ - 1.9, 'roof');
      for (let x = RX1 - 35; x < RX1; x += 10) add(x - 0.15, 1.0, RAILZ + s * 6.4 - 0.15, x + 0.15, 4.6, RAILZ + s * 6.4 + 0.15, 'pole', true, [0.25, 0.27, 0.3]);
    }
    keepOut(RX1 - 44, RAILZ - 11, RX1 + 8, RAILZ + 11);
    for (let x = RX0 + 20; x < RX1 - 40; x += 25) for (const s of [-1, 1]) add(x - 0.12, 0, RAILZ + s * 3.4 - 0.12, x + 0.12, 6.2, RAILZ + s * 3.4 + 0.12, 'pole', true, [0.3, 0.3, 0.32]);

    // ---- estradas de terra batida (decoração) ligando as vilas
    const road = (x0, z0, x1, z1) => { add(x0, 0, z0, x1, 0.02, z1, 'road', false); keepOut(x0 - 1, z0 - 1, x1 + 1, z1 + 1); };
    road(-200, 21, 120, 29); road(-4, -150, 4, 120); road(-150, 50, -142, 140); road(70, 29, 78, 110);

    // ---- castelo no centro (muralha com passarela, torres, portões e torre central)
    {
      const cx = -42, cz = 64, S2 = 22, Hm = 6, th = 2.2, stone = [0.42, 0.42, 0.46];
      for (const s of [-1, 1]) {
        // muralhas norte/sul com portão no meio; leste/oeste inteiras com portinhola
        for (const [a0, a1] of [[-S2, -3.5], [3.5, S2]]) { add(cx + a0, 0, cz + s * S2 - th / 2, cx + a1, Hm, cz + s * S2 + th / 2, 'stone', true, stone); add(cx - S2 - th / 2 + (s > 0 ? 2 * S2 : 0), 0, cz + a0, cx - S2 + th / 2 + (s > 0 ? 2 * S2 : 0), Hm, cz + a1, 'stone', true, stone); }
        add(cx - 3.5, 4.2, cz + s * S2 - th / 2, cx + 3.5, Hm, cz + s * S2 + th / 2, 'stone', true, stone); // arco do portão
        add(cx - S2 - th / 2 + (s > 0 ? 2 * S2 : 0), 3.0, cz - 3.5, cx - S2 + th / 2 + (s > 0 ? 2 * S2 : 0), Hm, cz + 3.5, 'stone', true, stone);
        // ameias
        for (let a = -S2; a < S2; a += 2) { add(cx + a, Hm, cz + s * (S2 + th / 2) - 0.3, cx + a + 1, Hm + 0.9, cz + s * (S2 + th / 2), 'stone', true, stone); add(cx + s * (S2 + th / 2) - 0.3, Hm, cz + a, cx + s * (S2 + th / 2), Hm + 0.9, cz + a + 1, 'stone', true, stone); }
      }
      // torres nos cantos
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const tx = cx + sx * S2, tz = cz + sz * S2; add(tx - 3, 0, tz - 3, tx + 3, Hm + 3, tz + 3, 'stone', true, [0.36, 0.36, 0.4]); add(tx - 3.3, Hm + 3, tz - 3.3, tx + 3.3, Hm + 3.4, tz + 3.3, 'roof'); }
      // escadas até a passarela da muralha (lado de dentro, norte e sul)
      for (const s of [-1, 1]) { const n = 12, rise = Hm / n, zi = cz + s * (S2 - th / 2), za = s < 0 ? zi : zi - 1.4, zb = s < 0 ? zi + 1.4 : zi; for (let i = 0; i < n; i++) { const x0 = cx + 6 + i * 0.6; add(x0, 0, za, x0 + 0.6, rise * (i + 1), zb, 'stone', true, stone); } }
      // torre central (2 andares, como as casas)
      house2(cx, cz, 0, 'stone', [0.5, 0.48, 0.5]);
      // caixotes no pátio
      for (const [x, z, n] of [[-12, -10, 2], [12, -12, 1], [-14, 12, 1], [13, 10, 2], [0, -14, 1]]) for (let k = 0; k < n; k++) bx(cx + x, cz + z, 1.3, 1.3, 1.3, 'crate', k * 1.3);
      itemsW.push([cx - 8, 0, cz - 8], [cx + 8, Hm, cz - S2 + 0.2]); itemsM.push([cx + 8, 0, cz + 8], [cx - 8, Hm, cz + S2 - 0.2]);
      keepOut(cx - S2 - 6, cz - S2 - 6, cx + S2 + 6, cz + S2 + 6);
    }

    // ---- vilas
    const tryPlace = (cx0, cz0, rad, n, fn, r) => {
      let placed = 0;
      for (let g = 0; g < 400 && placed < n; g++) {
        const x = Math.round(cx0 + rr(-rad, rad)), z = Math.round(cz0 + rr(-rad, rad)), q = Math.floor(rnd() * 4);
        if (!fits(x, z, r)) continue;
        fn(x, z, q); placed++;
      }
    };
    const t2 = () => (rnd() < 0.5 ? 'brick' : 'concrete');
    tryPlace(-100, 52, 30, 6, (x, z, q) => house2(x, z, q, t2()), 9);     // vila do campo (oeste do castelo)
    tryPlace(30, 78, 34, 7, (x, z, q) => house2(x, z, q, t2()), 9);       // vila do sul
    tryPlace(10, 26, 28, 5, (x, z, q) => house2(x, z, q, t2()), 9);       // perto da estrada central
    tryPlace(-70, -55, 30, 5, (x, z, q) => house2(x, z, q, 'wood'), 9);   // borda da floresta
    tryPlace(85, 45, 30, 8, (x, z, q) => adobe(x, z, q), 7);              // vila do deserto
    tryPlace(110, -2, 22, 4, (x, z, q) => adobe(x, z, q), 7);
    tryPlace(-205, 30, 30, 6, (x, z, q) => cabin(x, z, q), 7);            // cabanas na neve
    tryPlace(-180, 110, 30, 5, (x, z, q) => cabin(x, z, q), 7);
    tryPlace(-40, -125, 45, 6, (x, z, q) => cabin(x, z, q), 7);           // cabanas na floresta
    tryPlace(190, -100, 30, 5, (x, z, q) => cabin(x, z, q), 7);           // pântano
    tryPlace(0, 140, 30, 4, (x, z, q) => house2(x, z, q, t2()), 9);

    // ---- montanhas (neve): pirâmides de rocha com pico branco — servem de cobertura grande
    let mts = 0, guard = 0;
    while (mts < 16 && guard++ < 3000) {
      const x = rr(-250, -120), z = rr(-120, 190), w = rr(14, 26);
      if (zoneAt(x, z) !== 5 || !fits(x, z, w / 2)) continue;
      const H = rr(8, 15), steps = 5;
      for (let k = 0; k < steps; k++) { const f = 1 - k / steps, hh = H / steps; bx(x, z, w * f, w * f * rr(0.8, 1), hh, 'rock', k * hh, k >= steps - 2 ? [0.92, 0.94, 0.97] : [0.46, 0.46, 0.5]); }
      keepOut(x - w / 2 - 2, z - w / 2 - 2, x + w / 2 + 2, z + w / 2 + 2); mts++;
    }
    // ---- dunas (deserto): degraus baixos, dá para subir
    let dn = 0; guard = 0;
    while (dn < 26 && guard++ < 3000) {
      const x = rr(0, 160), z = rr(0, 130), w = rr(8, 16);
      if (zoneAt(x, z) !== 6 || !fits(x, z, w / 2)) continue;
      for (let k = 0; k < 3; k++) { const f = 1 - k * 0.3; add(x - w * f / 2, k * 0.42, z - w * f * 0.35, x + w * f / 2, (k + 1) * 0.42, z + w * f * 0.35, 'sand', true, [0.86, 0.74, 0.5]); }
      keepOut(x - w / 2 - 1, z - w / 2 - 1, x + w / 2 + 1, z + w / 2 + 1); dn++;
    }
    // ---- pedras e cactos
    let rocks = 0; guard = 0;
    while (rocks < 70 && guard++ < 5000) {
      const x = rr(-SX + 6, SX - 6), z = rr(-SZ + 6, SZ - 6), w = rr(1.4, 3.2), d = rr(1.2, 3.0), h = rr(0.7, 1.7), zn = zoneAt(x, z);
      if (!fits(x, z, Math.max(w, d))) continue;
      bx(x, z, w, d, h, 'rock', 0, zn === 5 ? [0.62, 0.63, 0.66] : zn === 6 ? [0.66, 0.52, 0.36] : [0.45, 0.44, 0.42]); rocks++;
    }
    for (let k = 0, g = 0; k < 40 && g < 3000; g++) { const x = rr(0, 170), z = rr(-10, 140); if (zoneAt(x, z) !== 6 || !fits(x, z, 1)) continue; add(x - 0.25, 0, z - 0.25, x + 0.25, rr(1.6, 2.6), z + 0.25, 'cactus', true, [0.25, 0.48, 0.24]); k++; }
    // ---- árvores: floresta densa ao norte, pinheiros na neve, árvores secas no pântano, algumas no campo
    let trees = 0; guard = 0;
    while (trees < 700 && guard++ < 30000) {
      const x = rr(-SX + 4, SX - 4), z = rr(-SZ + 4, SZ - 4), zn = zoneAt(x, z);
      const p = zn === 3 ? 1 : zn === 4 ? 0.7 : zn === 5 ? 0.25 : zn === 2 ? 0.08 : 0;
      if (rnd() > p || !fits(x, z, 2.0)) continue;
      const h = rr(5, 10), r = zn === 5 ? rr(1.3, 1.9) : rr(1.8, 3.0);
      add(x - 0.28, 0, z - 0.28, x + 0.28, zn === 4 ? h * 0.8 : h * 0.55, z + 0.28, 'trunk', true, zn === 4 ? [0.22, 0.2, 0.18] : null);
      const col = zn === 5 ? [0.13, 0.27, 0.2] : zn === 4 ? [0.25, 0.27, 0.12] : zn === 3 ? [0.14 + rnd() * 0.06, 0.3 + rnd() * 0.1, 0.12] : [0.2 + rnd() * 0.08, 0.36 + rnd() * 0.1, 0.15];
      if (zn === 4) add(x - r * 0.6, h * 0.6, z - r * 0.6, x + r * 0.6, h, z + r * 0.6, 'tree', false, col); // árvore seca: copa rala
      else add(x - r, h * 0.45, z - r, x + r, h, z + r, 'tree', false, col);
      trees++;
    }

    // ---- nascimento, kits, armas e munição (só em terra firme)
    const ffa = [];
    for (let gz = -SZ + 12; gz <= SZ - 12; gz += 22) for (let gx = -SX + 12; gx <= SX - 12; gx += 22) {
      for (let t = 0; t < 12; t++) { const x = gx + rr(-8, 8), z = gz + rr(-8, 8); if (Math.abs(z - RAILZ) < 7 || !freeAt(x, z, 1.6)) continue; ffa.push([Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10, Math.atan2(x, z)]); break; }
    }
    const spawns = { 0: ffa, 1: ffa, x1: { 0: ffa, 1: ffa }, ffa };
    const medkits = [];
    for (let g = 0; g < 900 && medkits.length < 26; g++) { const x = rr(-SX + 8, SX - 8), z = rr(-SZ + 8, SZ - 8); if (Math.abs(z - RAILZ) > 7 && freeAt(x, z, 1)) medkits.push([Math.round(x), 0, Math.round(z)]); }
    const WL = ['ak47', 'm4a1', 'doze', 'smg', 'sniper', 'deagle', 'ak47', 'm4a1', 'smg', 'pistol', 'maverick', 'maverick'];
    const weapons = [];
    for (let g = 0; g < 900 && weapons.length < 26; g++) { const x = rr(-SX + 8, SX - 8), z = rr(-SZ + 8, SZ - 8); if (Math.abs(z - RAILZ) > 7 && freeAt(x, z, 1)) weapons.push([Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10, WL[Math.floor(rnd() * WL.length)]]); }
    for (const m of itemsM) medkits.push(m);
    itemsW.forEach(([x, y, z], k) => weapons.push([x, y, z, ['maverick', 'ak47', 'm4a1', 'doze', 'smg', 'deagle', 'sniper', 'maverick'][(k * 5 + 3) % 8]]));
    const ammoFree = (x, y, z) => { if (Math.abs(x) > SX - 2 || Math.abs(z) > SZ - 2) return false; for (const b of solids) if (x + 0.3 > b[0] && x - 0.3 < b[3] && z + 0.3 > b[2] && z - 0.3 < b[5] && y + 0.05 < b[4] && y + 0.45 > b[1]) return false; return true; };
    const ammo = [];
    for (const [x, y, z] of weapons) for (const [dx, dz] of [[1.0, 0], [-1.0, 0], [0, 1.0], [0, -1.0], [0.8, 0.8], [-0.8, -0.8]]) if (ammoFree(x + dx, y, z + dz)) { ammo.push([Math.round((x + dx) * 10) / 10, y, Math.round((z + dz) * 10) / 10]); break; }
    // ---- carros (McLaren) espalhados em terra, longe de paredes
    const cars = [];
    for (const [x0, z0, t] of [[-60, 25], [20, 25], [-130, 25], [90, 30], [0, 100], [-100, 70], [60, 80], [-180, 40],
      [-30, 30, 'luaz'], [40, 60, 'luaz'], [-150, 30, 'luaz'], [110, 60, 'luaz'], [-20, 130, 'luaz'], [-200, 80, 'luaz']]) { // McLaren e LUAZ
      for (let g = 0; g < 300; g++) { const x = x0 + rr(-12, 12), z = z0 + rr(-8, 8); if (carFree(solids, x, z) && land(x, z, 4) && Math.abs(z - RAILZ) > 8 && !cars.some((c) => Math.hypot(c[0] - x, c[1] - z) < 7)) { const yaw = Math.round(rr(0, 6.28) * 100) / 100; cars.push(t ? [Math.round(x * 10) / 10, Math.round(z * 10) / 10, yaw, t] : [Math.round(x * 10) / 10, Math.round(z * 10) / 10, yaw]); break; } }
    }
    const train = { z: RAILZ, x0: -175, x1: RX1 - 2, speed: 7, delay: 12, cars: 3, len: 20.85, gap: 0.8, hw: 1.45, y0: 0.32, y1: 4.2 };
    return { id: 'ilha', name: 'Ilha', solids, deco, spawns, medkits, weapons, ammo, props: [], sx: SX, sz: SZ, train, cars, zone, zoneW: NW, zoneH: NH, zoneG: ZG, sea: true };
  })();

  // ================================================================ ARENAS (mata-mata 4x4 e X1–X4)
  // Recorte de um pedaço dos mapas do Mapa aberto (os originais ficam iguais): muralha em volta, base de cada
  // equipe nos lados opostos e uma lojinha no chão em cada base (armas grátis; kit, capacete e colete com fichas).
  function makeArena(src, id, name, cx, cz, hx, hz, wallT) {
    const { solids, deco, add, bx } = builder();
    const x0 = cx - hx, x1 = cx + hx, z0 = cz - hz, z1 = cz + hz;
    const inside = (x, z) => x > x0 && x < x1 && z > z0 && z < z1;
    const cut = (b, solid) => {
      if (b[6] === 'tree' || b[6] === 'trunk') { if (!inside((b[0] + b[3]) / 2, (b[2] + b[5]) / 2)) return; }
      if (b[3] <= x0 || b[0] >= x1 || b[5] <= z0 || b[2] >= z1) return;
      const nb = [Math.max(b[0], x0) - cx, b[1], Math.max(b[2], z0) - cz, Math.min(b[3], x1) - cx, b[4], Math.min(b[5], z1) - cz, b[6], b[7]];
      if (nb[3] - nb[0] < 0.05 || nb[5] - nb[2] < 0.05) return;
      (solid ? solids : deco).push(nb);
    };
    for (const b of src.solids) cut(b, true);
    for (const b of src.deco) cut(b, false);
    const props = (src.props || []).filter((p) => inside(p[1], p[2])).map((p) => [p[0], p[1] - cx, p[2] - cz, p[3]]);
    // muralha
    const T = 1, H = 5;
    bx(0, -hz - T / 2, 2 * hx + 2 * T, T, H, wallT); bx(0, hz + T / 2, 2 * hx + 2 * T, T, H, wallT);
    bx(-hx - T / 2, 0, T, 2 * hz, H, wallT); bx(hx + T / 2, 0, T, 2 * hz, H, wallT);
    let seed = id.length * 7919 + 13; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const hit = (x, z, r, h = 1.8) => solids.some((b) => x + r > b[0] && x - r < b[3] && z + r > b[2] && z - r < b[5] && b[1] < h && b[4] > 0.05);
    // lojinha de cada base: balcão, toldo colorido, placa e caixotes
    const shops = [];
    for (const team of [0, 1]) {
      const side = team === 0 ? -1 : 1, col = team === 0 ? [0.2, 0.45, 0.9] : [0.9, 0.25, 0.2];
      let sx = side * (hx - 6), sz = 0;
      for (let g = 0; g < 200 && hit(sx, sz, 2.6, 3); g++) { sx = side * (hx - 4 - rnd() * 12); sz = (rnd() * 2 - 1) * (hz - 6); }
      // limpa o espaço da loja (tira árvores e caixas pequenas que sobraram ali)
      for (let i = solids.length - 1; i >= 0; i--) { const b = solids[i]; if (b[4] < 4 && b[3] > sx - 3 && b[0] < sx + 3 && b[5] > sz - 3 && b[2] < sz + 3) solids.splice(i, 1); }
      for (let i = deco.length - 1; i >= 0; i--) { const b = deco[i]; if (b[6] === 'tree' && b[3] > sx - 3 && b[0] < sx + 3 && b[5] > sz - 3 && b[2] < sz + 3) deco.splice(i, 1); }
      add(sx - 1.3, 0, sz - 0.45, sx + 1.3, 1.0, sz + 0.45, 'shop', true, [0.55, 0.38, 0.22]); // balcão
      add(sx - 1.35, 1.0, sz - 0.5, sx + 1.35, 1.06, sz + 0.5, 'shop', true, [0.85, 0.85, 0.82]); // tampo
      for (const [px, pz] of [[-1.3, -0.45], [1.3, -0.45], [-1.3, 0.45], [1.3, 0.45]]) add(sx + px - 0.06, 1.06, sz + pz - 0.06, sx + px + 0.06, 2.6, sz + pz + 0.06, 'pole', true, [0.3, 0.3, 0.32]);
      add(sx - 1.55, 2.6, sz - 0.75, sx + 1.55, 2.72, sz + 0.75, 'shop', false, col); // toldo
      add(sx - 0.9, 2.72, sz - 0.04, sx + 0.9, 3.25, sz + 0.04, 'shop', false, [0.98, 0.82, 0.2]); // placa
      bx(sx + 2.0, sz + 0.3, 0.8, 0.8, 0.8, 'crate'); bx(sx - 2.0, sz - 0.3, 0.8, 0.8, 0.8, 'crate');
      shops.push([Math.round(sx * 10) / 10, Math.round(sz * 10) / 10, team]);
    }
    // nascimentos: cada equipe do seu lado, virada para o centro
    const sp = { 0: [], 1: [] };
    for (const team of [0, 1]) {
      const side = team === 0 ? -1 : 1;
      for (let g = 0; g < 4000 && sp[team].length < 10; g++) {
        const x = side * (hx - 2.5 - rnd() * 13), z = (rnd() * 2 - 1) * (hz - 3);
        if (hit(x, z, 0.8) || sp[team].some((s) => Math.hypot(s[0] - x, s[2] - z) < 3.5)) continue;
        sp[team].push([Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10, side < 0 ? -Math.PI / 2 : Math.PI / 2]);
      }
    }
    const ffa = [];
    for (let g = 0; g < 4000 && ffa.length < 24; g++) { const x = (rnd() * 2 - 1) * (hx - 3), z = (rnd() * 2 - 1) * (hz - 3); if (!hit(x, z, 0.8)) ffa.push([Math.round(x * 10) / 10, 0, Math.round(z * 10) / 10, Math.atan2(x, z)]); }
    const spawns = { 0: sp[0], 1: sp[1], x1: { 0: sp[0], 1: sp[1] }, ffa };
    const medkits = (src.medkits || []).filter((m) => inside(m[0], m[2])).slice(0, 8).map((m) => [m[0] - cx, m[1], m[2] - cz]);
    const out = { id, name, arena: true, solids, deco, spawns, medkits, weapons: [], ammo: [], props, sx: hx, sz: hz, shops, cars: [] };
    if (src.zone) { // chão com as cores das regiões da Ilha (sem mar em volta: grama além da muralha)
      const g = src.zoneG, NW = Math.round(2 * hx / g), NH = Math.round(2 * hz / g), zone = new Uint8Array(NW * NH);
      for (let j = 0; j < NH; j++) for (let i = 0; i < NW; i++) {
        const x = cx - hx + (i + 0.5) * g, z = cz - hz + (j + 0.5) * g, si = Math.floor((x + src.sx) / g), sj = Math.floor((z + src.sz) / g);
        zone[j * NW + i] = Math.max(2, src.zone[sj * src.zoneW + si]);
      }
      Object.assign(out, { zone, zoneW: NW, zoneH: NH, zoneG: g, outside: 'grass' });
    }
    return out;
  }
  const ARENA_CIDADE = makeArena(MAP_OPEN, 'arena_cidade', 'Arena Cidade', -176, 142, 42, 30, 'concrete');
  const ARENA_ILHA = makeArena(MAP_ISLAND, 'arena_ilha', 'Arena Ilha', -42, 64, 40, 32, 'stone');
  const ARENAS = ['arena_cidade', 'arena_ilha'];
  // lojinha das arenas: armas grátis; kit, capacete e colete custam fichas da partida
  const SHOP = { kit: { name: 'Kit médico', price: 150 }, helmet: { name: 'Capacete', price: 250 }, vest: { name: 'Colete', price: 350 } };
  const MAPS = { base: MAP_BASE, aberto: MAP_OPEN, ilha: MAP_ISLAND, arena_cidade: ARENA_CIDADE, arena_ilha: ARENA_ILHA };
  const OPEN_MAPS = ['aberto', 'ilha']; // mapas do modo Mapa aberto (o jogador escolhe)
  const isRoundsM = (m) => /^x[1-4]$/.test(m);
  // Mapa aberto: Cidade ou Ilha · mata-mata e X1–X4: arenas · 1 contra todos e treino: mapa base
  const mapFor = (mode, id) => (mode === 'aberto' ? (id === 'ilha' ? MAP_ISLAND : MAP_OPEN) : mode === 'tdm' || isRoundsM(mode) ? (id === 'arena_ilha' ? ARENA_ILHA : ARENA_CIDADE) : MAP_BASE);
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
  let MAP = indexMap(MAP_BASE), SOL = MAP.solids, CELLS = MAP.cells, DYN = [], CARL = [];
  function useMap(m, dyn, cars) {
    if (MAP !== m) { MAP = indexMap(m); SOL = m.solids; CELLS = m.cells; NAV = m.nav || null; }
    DYN = dyn || []; CARL = cars || [];
  }
  // água (mar e lagos do mapa Ilha): anda devagar; carro não entra
  function waterAt(x, z) {
    const m = MAP; if (!m.zone) return false;
    const i = Math.floor((x + m.sx) / m.zoneG), j = Math.floor((z + m.sz) / m.zoneG);
    return i < 0 || j < 0 || i >= m.zoneW || j >= m.zoneH ? true : m.zone[j * m.zoneW + i] <= 1;
  }
  // ---------------------------------------------------------------- carros (McLaren: motorista no centro, passageiro ao lado)
  const CAR = { MAXV: 31, REV: 9, ACC: 10.5, BRK: 26, ROLL: 3.2, WB: 2.36, STEER: 0.62, R: 0.9, H: 1.1, OFF: [-1.45, 0, 1.45], SEATS: [[0, -0.05], [-0.62, 0.3]] };
  // tipos de carro: McLaren (rápida e baixa) e LUAZ (jipinho mais lento, alto e curto). Os dois levam motorista + carona.
  const CAR_T = {
    f1: Object.assign({}, CAR, { name: 'McLaren F1', model: 'car_f1' }),
    luaz: Object.assign({}, CAR, { name: 'LUAZ', model: 'car_luaz', MAXV: 22, ACC: 8, BRK: 22, WB: 1.85, STEER: 0.7, R: 0.86, H: 1.55, OFF: [-1.05, 0, 1.05], SEATS: [[-0.34, 0.05], [0.34, 0.05]] }),
  };
  const ctype = (c) => CAR_T[c.t] || CAR_T.f1;
  const carFwd = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)];
  function seatPos(c, seat) { // posição do assento no mundo
    const [lx, lz] = ctype(c).SEATS[seat], f = carFwd(c.yaw), r = [Math.cos(c.yaw), -Math.sin(c.yaw)];
    return [c.x + r[0] * lx - f[0] * lz, c.z + r[1] * lx - f[1] * lz];
  }
  function carBlocked(c, x, z, yaw) {
    const f = carFwd(yaw), T = ctype(c);
    for (const o of T.OFF) {
      const px = x + f[0] * o, pz = z + f[1] * o;
      if (Math.abs(px) > MAP.sx - 1.5 || Math.abs(pz) > MAP.sz - 1.5 || waterAt(px, pz)) return true;
      if (collides(px, 0.36, pz, T.R - 0.05, 0.75, true)) return true;
      for (const o2 of CARL) {
        if (o2 === c || o2.id === c.id || Math.abs(o2.x - x) > 6 || Math.abs(o2.z - z) > 6) continue;
        const g = carFwd(o2.yaw), T2 = ctype(o2);
        for (const k of T2.OFF) { const dx = o2.x + g[0] * k - px, dz = o2.z + g[1] * k - pz; if (dx * dx + dz * dz < (T.R + T2.R) * (T.R + T2.R)) return true; }
      }
    }
    return false;
  }
  // um passo do carro (determinístico: o celular de quem dirige prevê, o servidor confirma)
  function carStep(c, f, s, dt) {
    f = clamp(num(f), -1, 1); s = clamp(num(s), -1, 1);
    const T = ctype(c);
    if (f > 0.05) { if (c.v < -0.4) c.v = Math.min(0, c.v + T.BRK * f * dt); else c.v += T.ACC * f * dt * (1 - Math.max(0, c.v) / T.MAXV * 0.6); }
    else if (f < -0.05) { if (c.v > 0.4) c.v = Math.max(0, c.v + T.BRK * f * dt); else c.v += T.ACC * 0.7 * f * dt; }
    else { const d = T.ROLL * dt; c.v = Math.abs(c.v) <= d ? 0 : c.v - Math.sign(c.v) * d; }
    c.v = clamp(c.v, -T.REV, T.MAXV);
    const tgt = s * T.STEER / (1 + Math.abs(c.v) / 13);
    c.st += (tgt - c.st) * Math.min(1, dt * 8);
    const ny = c.yaw - (c.v / T.WB) * Math.tan(c.st) * dt, fw = carFwd(ny);
    const nx = c.x + fw[0] * c.v * dt, nz = c.z + fw[1] * c.v * dt;
    if (carBlocked(c, nx, nz, ny)) {
      c.v = Math.abs(c.v) > 6 ? -c.v * 0.25 : 0;
      if (!carBlocked(c, c.x, c.z, ny)) c.yaw = ny;
      c.bump = (c.bump || 0) + 1;
      return;
    }
    c.x = nx; c.z = nz; c.yaw = ny;
  }
  // caixas do carro para quem anda a pé (e para as balas): 3 blocos ao longo do carro
  const CARBOX = [];
  function carBoxes() {
    let n = 0;
    for (const c of CARL) { const T = ctype(c), f = carFwd(c.yaw); for (const o of T.OFF) { const b = CARBOX[n] || (CARBOX[n] = [0, 0.15, 0, 0, 1, 0, 'car', null]); const x = c.x + f[0] * o, z = c.z + f[1] * o; b[0] = x - T.R * 0.85; b[2] = z - T.R * 0.85; b[3] = x + T.R * 0.85; b[4] = T.H; b[5] = z + T.R * 0.85; b.car = c.id; n++; } }
    CARBOX.length = n; return CARBOX;
  }
  function collides(x, y, z, r, h, noCars) {
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
    if (!noCars && CARL.length) for (const b of carBoxes()) if (x + r > b[0] && x - r < b[3] && y + h > b[1] && y < b[4] && z + r > b[2] && z - r < b[5]) return b;
    return null;
  }
  const GROUND = [-1e9, -1, -1e9, 1e9, 0, 1e9, 'ground'];

  // itens ativos do mapa: número (até 30) ou lista de blocos de 30 bits
  function maskOf(list) {
    if (list.length <= 30) { let m = 0; list.forEach((o, i) => { if (o.active) m |= 1 << i; }); return m; }
    const a = new Array(Math.ceil(list.length / 30)).fill(0);
    list.forEach((o, i) => { if (o.active) a[(i / 30) | 0] |= 1 << (i % 30); });
    return a;
  }
  const hasBit = (m, i) => (typeof m === 'number' ? i < 30 && (m >> i) & 1 : !!m && ((m[(i / 30) | 0] >> (i % 30)) & 1)) ? true : false;
  function weaponOf(p) { return WEAPONS[p.weapons ? p.weapons[p.cur] : 'smg'] || WEAPONS.smg; }

  // Aplica um comando de movimento (determinístico: cliente prevê, servidor confirma)
  function applyInput(p, inp) {
    const dt = clamp(num(inp.dt, 0), 0, 0.05);
    p.yaw = num(inp.yaw, p.yaw);
    p.pitch = clamp(num(inp.pitch, p.pitch), -1.5, 1.5);
    const b = inp.b | 0;
    p.ads = !!(b & BTN.ADS);
    if (!p.alive) return;
    if (p.car) { // dentro do carro: motorista dirige (frente/trás = acelerar/freio, lados = volante); passageiro só acompanha
      if (p.seat === 0) carStep(p.car, inp.f, inp.s, dt);
      const sp = seatPos(p.car, p.seat); p.x = sp[0]; p.z = sp[1]; p.y = 0.12; p.vx = p.vy = p.vz = 0; p.onGround = true; p.crouch = true; p.sprint = false;
      return;
    }
    if (b & BTN.CROUCH) p.crouch = true;
    else if (p.crouch && !collides(p.x, p.y, p.z, C.R, C.H)) p.crouch = false;
    const h = p.crouch ? C.HC : C.H;
    let f = clamp(num(inp.f), -1, 1), s = clamp(num(inp.s), -1, 1);
    if (p.down) { f = 0; s = 0; } // caído (atropelado): não anda até levantar
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const w = weaponOf(p);
    p.sprint = !p.crouch && !!(b & BTN.SPRINT) && f > 0.3 && !p.ads && !p.medUntil; // correndo (botão CORRER / Shift)
    let speed = p.crouch ? C.CROUCH : (p.sprint ? C.SPRINT : C.WALK);
    speed *= w.speed;
    if (p.ads) speed *= 0.65;
    if (p.medUntil) speed *= 0.6;
    if (p.y < 0.4 && waterAt(p.x, p.z)) { speed *= 0.5; p.sprint = false; } // água rasa
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    const wx = (-sy * f + cy * s) * speed, wz = (-cy * f - sy * s) * speed;
    const k = p.down ? Math.min(1, dt * 3) : p.onGround ? Math.min(1, dt * 14) : Math.min(1, dt * 2.5);
    p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k;
    if ((b & BTN.JUMP) && p.onGround && !p.crouch && !p.down) { p.vy = C.JUMP; p.onGround = false; }
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
    if (CARL.length) for (const b of carBoxes()) { if (ox > b[0] && ox < b[3] && oz > b[2] && oz < b[5] && oy > b[1] && oy < b[4]) continue; const t = rayBox(ox, oy, oz, dx, dy, dz, b[0], b[1], b[2], b[3], b[4], b[5]); if (t < best) best = t; }
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
    for (let i = 0; i < ni; i++) for (let j = 0; j < nj; j++) free[i * nj + j] = collides(px(i), 0.05, pz(j), C.R + 0.05, C.H - 0.1, true) || waterAt(px(i), pz(j)) ? 0 : 1; // bots não entram no mar
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
    const p = { v: 1, name: sanitizeName(name), xp: 0, level: 1, coins: 1500, owned: ['pistol', 'smg'], uniformsOwned: ['woodland', 'desert'], upgrades: [], loadout: { primary: 'smg', secondary: 'pistol' }, uniform: 'woodland', mmr: 1000, wins: 0, losses: 0, kills: 0, deaths: 0, hs: 0, matches: 0, missions: [], cos: { owned: ['ch_soldado'], char: 'ch_soldado', shirt: '', pants: '', wskins: {} }, pid: '', friends: [], fin: [], fout: [], mail: [], news: [] };
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
      this.map = indexMap(mapFor(this.mode, o.map)); this.mapId = this.map.id; this.dyn = [];
      this.shop = !!this.map.shops && !o.training; // arenas: lojinha no chão
      this.cars = (this.map.cars || []).map(([x, z, yaw, t], id) => ({ id, t: t || 'f1', x, z, yaw, v: 0, st: 0, seats: [0, 0], home: [x, z, yaw], idle: 0 })); this.trainX = this.map.train ? this.map.train.x0 : 0; this.trainSt = 0;
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
      // armas no chão: as do mapa voltam depois de um tempo; as largadas somem
      this.wpicks = (this.map.weapons || []).map(([x, y, z, w]) => ({ x, y, z, w, active: true, t: 0 })); this.drops = []; this.dropSeq = 0;
      this.ammos = (this.map.ammo || []).map(([x, y, z]) => ({ x, y, z, active: true, t: 0 }));
      this.onMatchEnd = null;
      // início estilo battle royale (mapa aberto online): procurar jogadores -> lobby -> trem -> pular
      this.br = !!o.br && !!this.map.train; this.brT = [o.brBusca || C.BR_BUSCA, o.brLobby || C.BR_LOBBY];
      if (this.br) this.brReset();
    }
    brReset() {
      this.ph = 'busca'; this.phEnd = this.time + this.brT[0]; this.trainStartAt = 0; this.matchTime = 0;
      for (const p of this.players.values()) { p.alive = false; p.respawnAt = Infinity; p.train = null; }
    }
    // pontos do lobby: todos juntos ao lado do trem parado no depósito
    lobbySpot(i) {
      const col = i % 6, row = Math.floor(i / 6) % 5;
      return [-185 + col * 2.2, 0, 7 + row * 2.2];
    }
    lobbySpawn(p, i) {
      this.spawn(p);
      const [x, y, z] = this.lobbySpot(i); p.x = x + (Math.random() - 0.5) * 0.4; p.y = y; p.z = z; p.yaw = Math.PI / 2;
      p.spawnProt = this.phEnd + 999; p.train = null;
    }
    // embarca: cada jogador num lugar dentro de um vagão (2 fileiras de 5 por vagão)
    board(p, i) {
      const tr = this.map.train, car = Math.floor(i / 10) % tr.cars, k = i % 10;
      p.train = { off: car * (tr.len + tr.gap) + 3 + (k >> 1) * 3.4, dz: (k & 1 ? 0.55 : -0.55) };
      p.x = this.trainX - p.train.off; p.y = tr.y0 + 0.02; p.z = tr.z + p.train.dz; p.vx = p.vy = p.vz = 0; p.onGround = true; p.crouch = false;
      p.spawnProt = Infinity; p.yaw = -Math.PI / 2;
    }
    // pula do trem: cai do lado (de acordo com o lado do lugar), sem ficar dentro de parede
    leap(p) {
      if (!p.train) return;
      const tr = this.map.train, side = p.train.dz >= 0 ? 1 : -1;
      p.train = null;
      let best = null;
      for (const dx of [0, 1.5, -1.5, 3, -3, 5, -5]) for (const sd of [side, -side]) {
        const x = p.x + dx, z = tr.z + sd * (tr.hw + C.R + 0.6);
        if (!collides(x, 0.6, z, C.R, C.H)) { best = [x, z, sd]; break; }
      }
      if (!best) best = [p.x, tr.z + side * (tr.hw + 1.2), side];
      p.x = best[0]; p.z = best[1]; p.y = 0.6; p.vx = 0; p.vz = best[2] * 3; p.vy = 4; p.onGround = false;
      p.spawnProt = this.time + 2.5;
      this.events.push({ e: 'leap', id: p.id });
    }
    brTick() {
      const n = this.players.size;
      if (!n) { if (this.ph !== 'busca') this.brReset(); else this.phEnd = this.time + this.brT[0]; return; }
      if ((this.ph === 'busca' || this.ph === 'lobby') && this.time >= this.phEnd) { // achou jogadores: todos direto para o trem
        this.ph = 'trem'; this.trainStartAt = this.time; let i = 0;
        for (const p of this.players.values()) { if (!p.alive) this.spawn(p); this.board(p, i++); }
        this.events.push({ e: 'br', ph: 'trem' });
      } else if (this.ph === 'trem') {
        const tr = this.map.train;
        this.phEnd = this.time + Math.max(0, (tr.x1 - this.trainX) / tr.speed);
        if (this.trainX >= tr.x1 - 0.01) { // chegou: quem não pulou desce na estação
          for (const p of this.players.values()) if (p.train) this.leap(p);
          this.ph = 'livre'; this.matchTime = 0; this.events.push({ e: 'br', ph: 'livre' });
        }
      }
    }
    teamCount(t) { let n = 0; for (const p of this.players.values()) if (p.team === t) n++; return n; }
    addPlayer(info = {}) {
      useMap(this.map, this.dyn, this.cars);
      const id = this.nextId++;
      const lo = info.loadout || {};
      const team = isFFA(this.mode) ? (this.mode === 'aberto' && info.sq ? 100000 + (info.sq | 0) : id) : (info.team === 0 || info.team === 1 ? info.team : (this.teamCount(0) <= this.teamCount(1) ? 0 : 1));
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
      p.baseW = p.weapons.slice(); // armas do equipamento (voltam ao renascer)
      this.players.set(id, p);
      if (this.br && this.ph === 'busca') { p.alive = false; p.respawnAt = Infinity; }
      else if (this.br && this.ph === 'lobby') this.lobbySpawn(p, this.players.size - 1);
      else if (this.br && this.ph === 'trem') { this.spawn(p); this.board(p, this.players.size - 1); }
      else this.spawn(p);
      this.rosterDirty = true;
      return p;
    }
    removePlayer(id) { const p = this.players.get(id); if (p && p.car) this.leaveCar(p, true); this.players.delete(id); this.rosterDirty = true; }
    // ---- carros: entrar (motorista ou passageiro) e sair
    enterCar(p, id, seat) {
      const c = this.cars[id | 0]; seat = seat ? 1 : 0;
      if (!c || !p.alive || p.car || p.train || p.medUntil || c.seats[seat]) return;
      if (Math.hypot(p.x - c.x, p.z - c.z) > 4.2 || p.y > 1.6) return;
      c.seats[seat] = p.id; p.car = c; p.seat = seat; p.reloadUntil = seat === 0 ? 0 : p.reloadUntil; p.ads = false;
      const sp = seatPos(c, seat); p.x = sp[0]; p.z = sp[1]; p.y = 0.12; p.vx = p.vy = p.vz = 0; p.crouch = true;
      this.events.push({ e: 'car', id: p.id, c: c.id, s: seat, in: 1 });
    }
    leaveCar(p, force) {
      const c = p.car; if (!c) return;
      if (c.seats[p.seat] === p.id) c.seats[p.seat] = 0;
      p.car = null; p.crouch = false;
      if (!force) { // sai pela lateral (ou pela frente/trás) em um lugar livre
        const f = carFwd(c.yaw), r = [Math.cos(c.yaw), -Math.sin(c.yaw)], side = p.seat === 1 ? -1 : 1;
        for (const [a, b] of [[side * 1.9, 0], [-side * 1.9, 0], [0, 3.3], [0, -3.3], [side * 2.4, 1.5], [-side * 2.4, -1.5]]) {
          const x = c.x + r[0] * a + f[0] * b, z = c.z + r[1] * a + f[1] * b;
          if (!collides(x, 0.05, z, C.R, C.H) && !waterAt(x, z)) { p.x = x; p.z = z; p.y = 0.02; break; }
        }
      }
      p.vx = p.vz = 0; p.vy = 0; p.onGround = false;
      this.events.push({ e: 'car', id: p.id, c: c.id, s: p.seat, in: 0 });
    }
    // atropelamento: carro rápido derruba quem estiver na frente (exceto a própria equipe)
    carTick(dt) {
      for (const c of this.cars) {
        let d = this.players.get(c.seats[0]);
        if (c.seats[0] && (!d || !d.alive || d.car !== c)) { c.seats[0] = 0; d = null; }
        const ps = this.players.get(c.seats[1]); if (c.seats[1] && (!ps || !ps.alive || ps.car !== c)) c.seats[1] = 0;
        if (!c.seats[0]) d = null;
        if (!d) { // sem motorista: o carro vai parando sozinho
          if (Math.abs(c.v) > 0.05) carStep(c, 0, 0, dt);
          // abandonado e longe de todos por muito tempo: volta para a vaga
          c.idle = c.seats[1] ? 0 : c.idle + dt;
          if (c.idle > 240) { const near = [...this.players.values()].some((q) => q.alive && Math.hypot(q.x - c.x, q.z - c.z) < 60); if (!near && !carBlocked(c, c.home[0], c.home[1], c.home[2])) { c.x = c.home[0]; c.z = c.home[1]; c.yaw = c.home[2]; c.v = 0; } c.idle = 0; }
          continue;
        }
        c.idle = 0;
        // velocidade real (quanto o carro andou de fato): carro parado não atropela ninguém
        const mv = c.px == null ? 0 : Math.hypot(c.x - c.px, c.z - c.pz) / Math.max(dt, 1e-3); c.px = c.x; c.pz = c.z;
        c.as = (c.as || 0) + (mv - (c.as || 0)) * 0.35;
        if (Math.abs(c.v) < 6 || c.as < 4) continue;
        const f = carFwd(c.yaw);
        for (const p of this.players.values()) {
          if (!p.alive || p.car || p.y > 1.3 || p.team === d.team || this.time < (p.carHitAt || 0)) continue;
          let hit = false;
          const T = ctype(c); for (const o of T.OFF) { const dx = p.x - (c.x + f[0] * o), dz = p.z - (c.z + f[1] * o); if (dx * dx + dz * dz < (T.R + C.R + 0.1) ** 2) hit = true; }
          if (!hit) continue;
          p.carHitAt = this.time + 1.0;
          // atropelado: cai, perde 50 de vida e levanta depois (2ª vez sem curar = eliminado)
          p.vx = f[0] * Math.sign(c.v) * 7; p.vz = f[1] * Math.sign(c.v) * 7; p.vy = 3.5; p.onGround = false;
          p.down = true; p.downUntil = this.time + C.DOWN_TIME; p.medUntil = 0; p.reloadUntil = 0; p.ads = false;
          c.v *= 0.85;
          this.events.push({ e: 'runover', id: p.id, by: d.id });
          if (this.time >= p.spawnProt) this.damage(p, d, C.CAR_DMG, false, 'car');
        }
      }
    }
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
        for (const o of this.players.values()) if (o !== p && o.alive && (this.rounds || o.team !== p.team)) md = Math.min(md, Math.hypot(o.x - s[0], o.z - s[2]));
        md += Math.random() * 6;
        if (md > bestD) { bestD = md; best = s; }
      }
      p.x = best[0] + (Math.random() - 0.5); p.y = best[1]; p.z = best[2] + (Math.random() - 0.5); p.yaw = best[3]; p.pitch = 0;
      // mapa aberto em equipe: renasce perto de um companheiro vivo
      if (this.mode === 'aberto' && p.team >= 100000 && this.ph === 'livre') {
        const mates = [...this.players.values()].filter((o) => o !== p && o.alive && o.team === p.team && !o.train && o.onGround);
        for (const m of mates) {
          let ok = false;
          for (let k = 0; k < 8 && !ok; k++) { const a = Math.random() * 6.283, x = m.x + Math.cos(a) * 3, z = m.z + Math.sin(a) * 3; if (!collides(x, m.y + 0.05, z, C.R, C.H)) { p.x = x; p.y = m.y; p.z = z; p.yaw = m.yaw; ok = true; } }
          if (ok) break;
        }
      }
      p.vx = p.vy = p.vz = 0; p.onGround = true; p.crouch = false;
      const keep = this.rounds && this.shop && p.alive && p.round === this.round - 1; // X1–X4: quem sobreviveu ao round mantém o que comprou
      p.round = this.round;
      if (p.money == null) p.money = this.shop ? C.SHOP_START : 0;
      if (!keep) { p.helmet = 0; p.vest = 0; }
      if (p.baseW && !keep) p.weapons = p.baseW.slice();
      p.hp = C.MAXHP; p.alive = true; p.streak = 0; p.cur = 0; p.bloom = 0;
      p.reloadUntil = 0; p.medUntil = 0; p.switchUntil = 0; p.down = false;
      if (this.shop && p.bot && !keep) { // bots também passam na lojinha
        const w = ['ak47', 'm4a1', 'smg', 'doze', 'ak47', 'm4a1', 'maverick', 'sniper'][Math.floor(Math.random() * 8)]; p.weapons[0] = w;
        if (p.money >= 350 && Math.random() < 0.7) { p.money -= 350; p.vest = 100; }
        if (p.money >= 250 && Math.random() < 0.5) { p.money -= 250; p.helmet = 100; }
      }
      p.medkits = C.MEDKITS_START + (p.upgrades.includes('medbag') ? 1 : 0);
      p.spawnProt = this.time + C.SPAWN_PROT;
      for (const w of p.weapons) p.ammo[w] = { mag: WEAPONS[w].mag, res: WEAPONS[w].reserve };
      if (p.ai) p.ai.path = null;
      this.events.push({ e: 'spawn', id: p.id });
    }
    handleInputs(id, list) {
      useMap(this.map, this.dyn, this.cars);
      const p = this.players.get(id);
      if (!p || !Array.isArray(list)) return;
      for (const it of list.slice(0, 20)) {
        if (!Array.isArray(it)) continue;
        const seq = it[0] | 0; if (seq <= p.ack) continue;
        const inp = { dt: clamp(num(it[1]), 0, 0.05), f: it[2], s: it[3], yaw: it[4], pitch: it[5], b: it[6] };
        if (p.budget < inp.dt - 0.004) { p.ack = seq; continue; } // anti speed-hack
        p.budget -= inp.dt;
        if (p.train) { p.yaw = num(inp.yaw, p.yaw); p.pitch = clamp(num(inp.pitch, p.pitch), -1.5, 1.5); }
        else if (this.state === 'playing') applyInput(p, inp);
        p.ack = seq; p.lastInput = this.time;
      }
    }
    handleAction(id, a) {
      useMap(this.map, this.dyn, this.cars);
      const p = this.players.get(id);
      if (!p || !a || this.state !== 'playing') return;
      if (this.br && this.ph !== 'livre') { if (a.a === 'leap' && this.ph === 'trem') this.leap(p); if (this.ph !== 'trem' || p.train) return; }
      switch (a.a) {
        case 'shoot': if ((p.car && p.seat === 0) || p.down) return; return this.shoot(p, a); // motorista e quem está caído não atiram
        case 'reload': return this.reload(p);
        case 'switch': {
          const s = a.s === 1 ? 1 : 0;
          if (s !== p.cur && p.alive && !p.medUntil) { p.cur = s; p.reloadUntil = 0; p.switchUntil = this.time + C.SWITCH; }
          return;
        }
        case 'grab': if (p.car) return; return this.grab(p, a);
        case 'buy': return this.buy(p, String(a.it || ''));
        case 'car': return this.enterCar(p, a.id, a.seat);
        case 'carx': return this.leaveCar(p);
        case 'med':
          if (p.alive && !p.down && p.medkits > 0 && p.hp < C.MAXHP && !p.medUntil) { p.medUntil = this.time + C.MEDTIME; p.reloadUntil = 0; this.events.push({ e: 'medstart', id: p.id }); }
          return;
      }
    }
    // pegar arma do chão: troca a arma do mesmo tipo (principal ou pistola), já equipa com munição cheia e larga a antiga
    grab(p, a) {
      if (!p.alive || p.medUntil) return;
      let best = null, bd = 2.2;
      const near = (o) => { const d = Math.hypot(p.x - o.x, p.z - o.z); if (Math.abs(p.y - o.y) < 1.6 && d < bd) { bd = d; best = o; } };
      for (const o of this.wpicks) if (o.active) near(o);
      for (const o of this.drops) near(o);
      if (!best || !WEAPONS[best.w]) return;
      const w = WEAPONS[best.w], slot = w.slot, old = p.weapons[slot];
      if (old === best.w) { p.ammo[w.id] = { mag: w.mag, res: w.reserve }; }
      else {
        p.weapons = p.weapons.slice(); p.weapons[slot] = w.id; p.ammo[w.id] = { mag: w.mag, res: w.reserve };
        if (old && WEAPONS[old]) { if (this.drops.length >= 24) this.drops.shift(); const sp = this.dropSpot(p.x, p.y, p.z); this.drops.push({ id: ++this.dropSeq, x: sp[0], y: p.y, z: sp[1], w: old, until: this.time + 40 }); }
      }
      p.cur = slot; p.reloadUntil = 0; p.switchUntil = this.time + C.SWITCH;
      if (best.until) this.drops.splice(this.drops.indexOf(best), 1); else { best.active = false; best.t = this.time + 30; }
      this.events.push({ e: 'grab', id: p.id, w: w.id });
    }
    reload(p) {
      const w = weaponOf(p), am = p.ammo[w.id];
      if (!p.alive || p.reloadUntil || p.medUntil || !am || am.mag >= w.mag || am.res <= 0) return;
      p.reloadUntil = this.time + w.reload;
      this.events.push({ e: 'reload', id: p.id });
    }
    // lugar para largar a arma sem ficar em cima de kit médico ou de outra arma
    dropSpot(x, y, z) {
      const near = (qx, qz) => {
        for (const m of this.medkits) if (m.active && Math.abs(m.y - y) < 1.2 && Math.hypot(m.x - qx, m.z - qz) < 1.3) return true;
        for (const o of this.wpicks) if (o.active && Math.abs(o.y - y) < 1.2 && Math.hypot(o.x - qx, o.z - qz) < 1.3) return true;
        for (const d of this.drops) if (Math.abs(d.y - y) < 1.2 && Math.hypot(d.x - qx, d.z - qz) < 1.1) return true;
        return false;
      };
      for (const r of [0, 1.2, 1.9]) for (let k = 0; k < (r ? 8 : 1); k++) {
        const qx = x + Math.cos(k * Math.PI / 4) * r, qz = z + Math.sin(k * Math.PI / 4) * r;
        if (!near(qx, qz) && !collides(qx, y + 0.05, qz, 0.25, 0.4)) return [qx, qz];
      }
      return [x, z];
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
        if (victim && victim.team !== p.team) { // no FFA cada um tem o próprio time; no mapa aberto a equipe (duo/squad) não se fere
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
      if (wid !== 'car') { // capacete protege a cabeça, colete o corpo (gastam com os tiros)
        if (head && v.helmet > 0) { v.helmet = Math.max(0, v.helmet - d * 0.5); d *= 0.55; }
        else if (!head && v.vest > 0) { v.vest = Math.max(0, v.vest - d * 0.5); d *= 0.6; }
        d = Math.max(1, Math.round(d));
      }
      v.hp = Math.max(0, v.hp - d);
      if (v.medUntil) v.medUntil = 0; // dano interrompe kit médico
      this.events.push({ e: 'hit', a: att.id, v: v.id, d, hs: head ? 1 : 0, x: r2(att.x), z: r2(att.z) });
      if (v.hp <= 0) this.kill(v, att, wid, head);
    }
    kill(v, k, wid, head) {
      if (v.car) this.leaveCar(v, true);
      v.down = false;
      v.alive = false; v.deaths++; v.respawnAt = this.time + C.RESPAWN; v.streak = 0; v.reloadUntil = 0; v.medUntil = 0;
      this.events.push({ e: 'kill', k: k.id, v: v.id, w: wid, hs: head ? 1 : 0 });
      if (this.rounds) return this.roundKill(v, k);
      if (k === v) return;
      if (this.shop) k.money = Math.min(C.SHOP_MAX, (k.money | 0) + C.SHOP_KILL);
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
        if (this.shop) k.money = Math.min(C.SHOP_MAX, (k.money | 0) + C.SHOP_KILL);
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
      if (this.shop) for (const p of this.players.values()) p.money = Math.min(C.SHOP_MAX, (p.money | 0) + C.SHOP_ROUND);
      for (const p of this.players.values()) this.spawn(p);
      for (const m of this.medkits) m.active = true;
      for (const w of this.wpicks) w.active = true; this.drops = []; for (const a of this.ammos) a.active = true;
      this.events.push({ e: 'roundstart', round: this.round });
    }
    award(p, amt, why) { p.xp += amt; this.events.push({ e: 'xp', id: p.id, amt, why }); }
    winnerOf() {
      if (!isFFA(this.mode)) return this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
      let best = null; for (const p of this.players.values()) if (!best || p.kills > best.kills) best = p;
      if (best && this.mode === 'aberto') return best.team; // mapa aberto: vence a equipe (solo = o próprio jogador) de quem fez mais eliminações
      return best ? best.id : -1;
    }
    endMatch() {
      if (this.state !== 'playing') return;
      this.state = 'ended'; this.endAt = this.time + 12;
      const win = this.winnerOf();
      let mvp = null; for (const p of this.players.values()) if (!mvp || p.kills > mvp.kills) mvp = p;
      const results = [];
      for (const p of this.players.values()) {
        const won = !isFFA(this.mode) || this.mode === 'aberto' ? p.team === win : p.id === win;
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
      for (const p of this.players.values()) { if (p.car) this.leaveCar(p, true); p.kills = 0; p.deaths = 0; p.xp = 0; p.stats = { hs: 0, medUsed: 0, picks: 0, streakMax: 0 }; if (!this.br) this.spawn(p); }
      for (const p of this.players.values()) { p.money = this.shop ? C.SHOP_START : 0; }
      for (const c of this.cars) { c.x = c.home[0]; c.z = c.home[1]; c.yaw = c.home[2]; c.v = 0; c.st = 0; c.seats = [0, 0]; }
      if (this.br) this.brReset();
      for (const m of this.medkits) m.active = true;
      for (const w of this.wpicks) w.active = true; this.drops = []; for (const a of this.ammos) a.active = true;
      this.events.push({ e: 'start' });
    }
    // trem: anda pelo trilho conforme o tempo da partida e empurra quem estiver na frente para o lado
    trainTick() {
      const tr = this.map.train, tt = this.br ? (this.trainStartAt ? this.time - this.trainStartAt + tr.delay : 0) : this.matchTime;
      const x = trainFront(tr, tt), moving = tt > tr.delay && x < tr.x1;
      this.trainX = x; trainBoxes(tr, x, this.dyn, moving);
      const st = moving ? 1 : x >= tr.x1 ? 2 : 0;
      if (st !== this.trainSt) { this.trainSt = st; if (st) this.events.push({ e: 'train', s: st }); }
      const back = x - tr.cars * (tr.len + tr.gap);
      for (const p of this.players.values()) {
        if (!p.alive || p.train || p.x + C.R < back || p.x - C.R > x || Math.abs(p.z - tr.z) > tr.hw + C.R || p.y > tr.y1 - 0.05) continue;
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
      useMap(this.map, this.dyn, this.cars);
      this.time += dt;
      if (this.state === 'ended') { if (this.time >= this.endAt) this.restart(); return; }
      if (this.br) this.brTick();
      if (!this.br || this.ph === 'livre') this.matchTime += dt;
      if (this.map.train) this.trainTick();
      if (this.cars.length) this.carTick(dt);
      if (this.timeLimit && this.matchTime >= this.timeLimit) { this.endMatch(); return; }
      if (this.roundEndAt && this.time >= this.roundEndAt) this.nextRound();
      for (const p of this.players.values()) {
        p.budget = Math.min(0.5, p.budget + dt);
        p.bloom = Math.max(0, p.bloom - dt * 0.12);
        if (!p.alive) { if (this.time >= p.respawnAt) this.spawn(p); continue; }
        if (p.train) { p.x = this.trainX - p.train.off; p.z = this.map.train.z + p.train.dz; p.y = this.map.train.y0 + 0.02; p.vx = p.vy = p.vz = 0; continue; }
        if (p.car && p.seat === 1) { const sp = seatPos(p.car, 1); p.x = sp[0]; p.z = sp[1]; p.y = 0.12; }
        if (p.down && this.time >= p.downUntil) p.down = false; // levantou
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
        // munição: passa por cima e ganha +30 balas (arma na mão; se estiver cheia, a outra)
        for (const a of this.ammos) {
          if (!a.active || Math.abs(p.y - a.y) > 1.2 || Math.hypot(p.x - a.x, p.z - a.z) > 1.1) continue;
          const order = [p.cur, 1 - p.cur].map((i) => p.weapons[i]).filter(Boolean);
          const wid = order.find((id) => p.ammo[id] && p.ammo[id].res < WEAPONS[id].reserve * 2);
          if (!wid) continue;
          p.ammo[wid].res = Math.min(WEAPONS[wid].reserve * 2, p.ammo[wid].res + C.AMMO_BOX);
          a.active = false; a.t = this.time + C.AMMO_RESPAWN;
          this.events.push({ e: 'ammo', id: p.id, w: wid });
        }
        for (const m of this.medkits) {
          if (m.active && p.medkits < C.MEDKITS_MAX && Math.abs(p.y - m.y) < 1.2 && Math.hypot(p.x - m.x, p.z - m.z) < 1.1) {
            m.active = false; m.t = this.time + C.MEDKIT_RESPAWN; p.medkits++; p.stats.picks++;
            this.award(p, 10, 'Kit médico coletado');
            this.events.push({ e: 'pick', id: p.id });
          }
        }
      }
      for (const m of this.medkits) if (!m.active && this.time >= m.t) m.active = true;
      for (const o of this.wpicks) if (!o.active && this.time >= o.t) o.active = true;
      for (const a of this.ammos) if (!a.active && this.time >= a.t) a.active = true;
      if (this.drops.length) this.drops = this.drops.filter((d) => this.time < d.until);
      const snap = new Map();
      for (const p of this.players.values()) if (p.alive) snap.set(p.id, [p.x, p.y, p.z, p.crouch]);
      this.history.push({ t: this.time, m: snap });
      if (this.history.length > 15) this.history.shift();
    }
    // ---------------- IA dos bots
    // lojinha: comprar arma (grátis), kit, capacete ou colete perto do balcão
    buy(p, it) {
      if (!this.shop || !p.alive || p.car || !p.ai && !this.nearShop(p)) return;
      const ok = (price) => { if ((p.money | 0) < price) { this.events.push({ e: 'buyno', id: p.id }); return false; } p.money -= price; return true; };
      if (WEAPONS[it]) {
        const w = WEAPONS[it], slot = w.slot ? 1 : 0;
        p.weapons[slot] = it; p.ammo[it] = { mag: w.mag, res: w.reserve }; p.cur = slot; p.reloadUntil = 0; p.switchUntil = this.time + C.SWITCH;
      } else if (it === 'kit') { if (p.medkits >= C.MEDKITS_MAX || !ok(SHOP.kit.price)) return; p.medkits++; }
      else if (it === 'helmet') { if (p.helmet >= 100 || !ok(SHOP.helmet.price)) return; p.helmet = 100; }
      else if (it === 'vest') { if (p.vest >= 100 || !ok(SHOP.vest.price)) return; p.vest = 100; }
      else return;
      this.events.push({ e: 'buy', id: p.id, it });
    }
    nearShop(p) { for (const s of this.map.shops || []) if (Math.hypot(p.x - s[0], p.z - s[1]) < C.SHOP_DIST && p.y < 1.5) return true; return false; }
    addBot(team) {
      useMap(this.map, this.dyn, this.cars);
      const used = new Set([...this.players.values()].map((p) => p.name));
      const name = BOT_NAMES.find((n) => !used.has(n)) || 'Bot' + this.nextId;
      const prim = ['ak47', 'm4a1', 'smg', 'doze', 'ak47', 'm4a1', 'sniper', 'maverick'][Math.floor(Math.random() * 8)];
      const uni = Object.keys(UNIFORMS)[Math.floor(Math.random() * 6)];
      buildNav();
      // alguns bots usam itens da lojinha, para as skins aparecerem nas partidas
      const pick = (t, chance) => { if (Math.random() > chance) return ''; const ids = Object.keys(COSMETICS).filter((k) => COSMETICS[k].type === t && COSMETICS[k].price > 0); return ids[Math.floor(Math.random() * ids.length)] || ''; };
      // bots: maioria é o soldado 3D realista; uns 25% vêm de Cowboy e alguns usam outras skins
      const rr = Math.random();
      // bots: soldado 3D (às vezes de calça 3D), Cyberpunk, Carter, Cowboy e outras skins
      const p3 = () => (Math.random() < 0.4 ? (Math.random() < 0.5 ? 'pa3_camo' : 'pa3_cargo') : '');
      const look = rr < 0.18 ? { c: 'ch_cowboy', s: '', p: '', w: {} } : rr < 0.33 ? { c: 'ch3_cyber', s: '', p: '', w: {} } : rr < 0.48 ? { c: 'ch3_carter', s: '', p: '', w: {} } : rr < 0.56 ? { c: 'ch3_rebeca', s: '', p: '', w: {} } : rr < 0.62 ? { c: 'ch3_winter', s: '', p: '', w: {} }
        : rr < 0.68 ? { c: pick('char', 1) || 'ch_soldado', s: '', p: '', w: {} } : { c: 'ch_soldado', s: '', p: p3(), w: {} };
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
          if (o === p || !o.alive || o.team === p.team) continue;
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
        s = ai.strafe; f = dist > (w.pump || w.id === 'smg' ? 6 : 14) ? 0.7 : dist < 4 ? -0.5 : 0;
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
            const enemies = [...this.players.values()].filter((o) => o.alive && o !== p && o.team !== p.team);
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
        const fl = (p.alive ? 1 : 0) | (p.crouch ? 2 : 0) | (p.ads ? 4 : 0) | (p.reloadUntil ? 8 : 0) | (p.medUntil ? 16 : 0) | (p.onGround ? 32 : 0) | (this.time < p.spawnProt ? 64 : 0) | (p.sprint && p.onGround ? 128 : 0) | (p.car ? 256 : 0) | (p.helmet > 0 ? 512 : 0) | (p.vest > 0 ? 1024 : 0) | (p.down ? 2048 : 0);
        pl.push([p.id, r2(p.x), r2(p.y), r2(p.z), r3(p.yaw), r3(p.pitch), fl, p.hp | 0, p.team, p.weapons[p.cur], p.kills, p.deaths]);
      }
      const mk = maskOf(this.medkits);
      const s = { t: 's', tm: r3(this.time), p: pl, sc: this.score, tl: this.timeLimit ? Math.max(0, Math.round(this.timeLimit - this.matchTime)) : -1, rd: this.round, st: this.state, mk, ev: this.events };
      if (this.map.train) s.tr = r2(this.trainX);
      if (this.cars.length) s.cr = this.cars.map((c) => [r2(c.x), r2(c.z), r3(c.yaw), r2(c.v), c.seats[0], c.seats[1], r3(c.st)]);
      if (this.br) { s.ph = this.ph; s.pe = this.ph === 'livre' ? 0 : Math.max(0, Math.ceil(this.phEnd - this.time)); s.pn = this.players.size; }
      if (this.wpicks.length) s.wk = maskOf(this.wpicks);
      if (this.ammos.length) s.ak = maskOf(this.ammos);
      if (this.drops.length) s.dw = this.drops.map((d) => [d.id, r2(d.x), r2(d.y), r2(d.z), WEAPON_LIST.indexOf(d.w)]);
      return s;
    }
    snapMe(p) {
      const w = weaponOf(p), am = p.ammo[w.id] || { mag: 0, res: 0 };
      return {
        id: p.id, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, og: p.onGround ? 1 : 0, cr: p.crouch ? 1 : 0, ack: p.ack, sa: p.shotAck,
        hp: p.hp, al: p.alive ? 1 : 0, cur: p.cur, w: p.weapons, mag: am.mag, res: am.res,
        rl: p.reloadUntil ? r2(p.reloadUntil - this.time) : 0, mu: p.medUntil ? r2(p.medUntil - this.time) : 0, mk: p.medkits,
        ra: p.alive ? 0 : isFinite(p.respawnAt) ? r1(Math.max(0, p.respawnAt - this.time)) : -1, xp: p.xp, sp: this.time < p.spawnProt ? 1 : 0,
        tn: p.train ? 1 : 0, to: p.train ? p.train.off : 0, tz: p.train ? p.train.dz : 0,
        car: p.car ? [p.car.id, p.seat, p.car.x, p.car.z, p.car.yaw, p.car.v, p.car.st] : 0,
        dn: p.down ? 1 : 0, $: this.shop ? p.money | 0 : -1, hm: Math.round(p.helmet || 0), vs: Math.round(p.vest || 0),
      };
    }
  }
  function r1(v) { return Math.round(v * 10) / 10; }
  function r2(v) { return Math.round(v * 100) / 100; }
  function r3(v) { return Math.round(v * 1000) / 1000; }

  return {
    isRounds, isFFA, hasBit, HOUSES, PROP_BOXES, MAPS, mapFor, useMap, trainFront, trainBoxes, indexMap, C, BTN, WEAPONS, WEAPON_LIST, UNIFORMS, UPGRADES, COSMETICS, sanitizeLook, lookOf, MAP: MAP_BASE, MISSIONS, MODE_NAMES,
    clamp, collides, applyInput, waterAt, carStep, carBlocked, seatPos, carFwd, CAR, CAR_T, OPEN_MAPS, ARENAS, SHOP, raycastWorld, rayPlayer, aimDir, weaponOf,
    buildNav, findPath, levelInfo, xpForLevel, newProfile, fixProfile, addXp, applyMatchResult, buy, equip, rankName,
    sanitizeName, sanitizeChat, GameSim,
  };
});
