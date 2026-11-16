/* ============================================================
   VORZAK — servidor multiplayer autoritativo
   Node.js >= 18, sem dependências externas.
   - HTTP: serve o jogo (dist/index.html)
   - WebSocket: lobby, salas públicas/privadas, convites, chat, partidas
   - Simulação autoritativa a 30 Hz (movimento, tiros, dano, vida, kits, XP)
   - Perfis persistentes em data/profiles.json (XP, nível, moedas, ranqueado)
   Uso: node server.js   (PORT=8080 por padrão)
   ============================================================ */
'use strict';
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const S = require('./shared.js');

const PORT = +process.env.PORT || 8080;
const zlib = require('zlib'), vzmCache = new Map();
const WAIT_MS = +process.env.WAIT_MS || 5 * 60 * 1000; // sala de espera fecha em 5 minutos se a partida não começar
const DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const MAX_CONN = +process.env.MAX_CONN || 400;
// arquivos do jogo: pasta dist/ (projeto completo) ou a própria pasta (pacote simples para GitHub/Render)
const DIST_DIR = fs.existsSync(path.join(__dirname, 'dist', 'index.html')) ? path.join(__dirname, 'dist') : __dirname;
const DIST = path.join(DIST_DIR, 'index.html');

// ------------------------------------------------------------ perfis
fs.mkdirSync(DATA, { recursive: true });
const PFILE = path.join(DATA, 'profiles.json');
let profiles = {};
try { profiles = JSON.parse(fs.readFileSync(PFILE, 'utf8')); } catch (e) { profiles = {}; }
const AFILE = path.join(DATA, 'accounts.json');
let accounts = {}; // 'google:<id>' / 'facebook:<id>' -> token do perfil
try { accounts = JSON.parse(fs.readFileSync(AFILE, 'utf8')); } catch (e) { accounts = {}; }
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '', FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '';
const FAKE_AUTH = process.env.FAKE_AUTH === '1'; // só para testes automatizados
let saveTimer = null;
function saveProfiles() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const tmp = PFILE + '.tmp';
    fs.writeFile(tmp, JSON.stringify(profiles), (err) => { if (!err) fs.rename(tmp, PFILE, () => {}); });
    fs.writeFile(AFILE + '.tmp', JSON.stringify(accounts), (err) => { if (!err) fs.rename(AFILE + '.tmp', AFILE, () => {}); });
  }, 2000);
}

// ------------------------------------------------------------ HTTP
const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  if (url === '/health') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ ok: true, players: clients.size, rooms: rooms.size })); }
  if (url === '/privacidade') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>VORZAK — Privacidade</title></head><body style="font-family:sans-serif;max-width:720px;margin:30px auto;padding:0 16px;line-height:1.5"><h1>VORZAK — Política de Privacidade</h1><p>Ao entrar com Google ou Facebook, o VORZAK usa apenas o identificador da sua conta, seu nome e (no Google) seu e-mail, para criar e reabrir seu perfil de jogo (nome, nível, XP, moedas e itens).</p><p>Esses dados ficam guardados só no servidor do jogo, não são vendidos nem compartilhados com terceiros e não são usados para publicidade.</p><p>Para apagar sua conta e seus dados, peça ao administrador do servidor ou use a página <a href="/excluir-dados">/excluir-dados</a>.</p></body></html>');
  }
  if (url === '/excluir-dados') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>VORZAK — Excluir dados</title></head><body style="font-family:sans-serif;max-width:720px;margin:30px auto;padding:0 16px"><h1>Excluir meus dados</h1><p>Envie uma mensagem ao administrador do servidor VORZAK com o nome do seu jogador e a conta usada (Google ou Facebook). Seu perfil e o vínculo da conta serão apagados.</p></body></html>');
  }
  if (url === '/config.json') { res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-cache' }); return res.end(JSON.stringify({ google: GOOGLE_CLIENT_ID || null, facebook: FACEBOOK_APP_ID || null })); }
  if (url === '/' || url === '/index.html') {
    fs.readFile(DIST, (err, data) => {
      if (err) { res.writeHead(500); return res.end('Rode "node build.js" antes de iniciar o servidor.'); }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      res.end(data);
    });
    return;
  }
  const STATIC = { '/manifest.json': 'application/manifest+json', '/sw.js': 'text/javascript', '/icon-192.png': 'image/png', '/icon-512.png': 'image/png' };
  if (STATIC[url]) {
    fs.readFile(path.join(DIST_DIR, url.slice(1)), (err, data) => {
      if (err) { res.writeHead(404); return res.end('404'); }
      res.writeHead(200, { 'content-type': STATIC[url], 'cache-control': url === '/sw.js' ? 'no-cache' : 'max-age=86400' });
      res.end(data);
    });
    return;
  }
  // personagens 3D (.vzm): comprimidos com gzip e guardados em memória
  if (/^\/[a-z0-9_-]+\.vzm$/.test(url)) {
    const send = (e) => {
      if (!e) { res.writeHead(404); return res.end('404'); }
      const gz = /\bgzip\b/.test(req.headers['accept-encoding'] || '');
      res.writeHead(200, Object.assign({ 'content-type': 'application/octet-stream', 'cache-control': 'max-age=86400' }, gz ? { 'content-encoding': 'gzip' } : {}));
      res.end(gz ? e.gz : e.raw);
    };
    if (vzmCache.has(url)) return send(vzmCache.get(url));
    fs.readFile(path.join(DIST_DIR, url.slice(1)), (err, raw) => {
      if (err) return send(null);
      const e = { raw, gz: zlib.gzipSync(raw, { level: 9 }) }; vzmCache.set(url, e); send(e);
    });
    return;
  }
  res.writeHead(404); res.end('404');
});

// ------------------------------------------------------------ WebSocket (RFC 6455) sem dependências
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
server.on('upgrade', (req, socket) => {
  if ((req.headers.upgrade || '').toLowerCase() !== 'websocket' || !req.headers['sec-websocket-key'] || clients.size >= MAX_CONN) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const c = new Client(socket, req.socket.remoteAddress);
  clients.set(c.uid, c);
});
function encodeFrame(str, opcode = 1) {
  const payload = Buffer.from(str), n = payload.length;
  let head;
  if (n < 126) { head = Buffer.alloc(2); head[1] = n; }
  else if (n < 65536) { head = Buffer.alloc(4); head[1] = 126; head.writeUInt16BE(n, 2); }
  else { head = Buffer.alloc(10); head[1] = 127; head.writeBigUInt64BE(BigInt(n), 2); }
  head[0] = 0x80 | opcode;
  return Buffer.concat([head, payload]);
}

let nextUid = 1;
const clients = new Map();
class Client {
  constructor(socket, ip) {
    this.uid = nextUid++; this.socket = socket; this.ip = ip; this.buf = Buffer.alloc(0); this.frag = [];
    this.name = 'Soldado'; this.token = null; this.profile = null; this.room = null; this.pid = 0; this.hello = false;
    this.msgCount = 0; this.msgWindow = Date.now(); this.alive = true; this.lastPong = Date.now();
    socket.on('data', (d) => this.onData(d));
    socket.on('close', () => this.onClose());
    socket.on('error', () => this.onClose());
  }
  send(obj) { this.sendRaw(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  sendRaw(str) { if (!this.socket.destroyed && this.socket.writableLength < 512 * 1024) this.socket.write(encodeFrame(str)); }
  close() { try { this.socket.end(encodeFrame('', 8)); } catch (e) {} this.socket.destroy(); }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    if (this.buf.length > 1 << 20) return this.close();
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1], op = b0 & 15, fin = b0 & 0x80, masked = b1 & 0x80;
      let len = b1 & 127, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (len > 64 * 1024) return this.close();
      if (!masked) return this.close();
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.slice(off, off + 4), data = Buffer.from(this.buf.slice(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.slice(off + 4 + len);
      if (op === 8) return this.close();
      if (op === 9) { this.socket.write(encodeFrame(data.toString(), 10)); continue; }
      if (op === 10) continue;
      if (op === 0 || op === 1) {
        this.frag.push(data);
        if (fin) { const msg = Buffer.concat(this.frag).toString('utf8'); this.frag = []; this.onText(msg); }
      }
    }
  }
  onText(txt) {
    const t = Date.now();
    if (t - this.msgWindow > 1000) { this.msgWindow = t; this.msgCount = 0; }
    if (++this.msgCount > 120) return; // limite de mensagens
    let m; try { m = JSON.parse(txt); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    try { handle(this, m); } catch (e) { console.error('erro ao tratar', m.t, e); }
  }
  onClose() {
    if (!this.alive) return; this.alive = false;
    if (this.wroom) this.wroom.wleave(this);
    if (this.room) this.room.leave(this);
    clients.delete(this.uid);
    broadcastOnline();
  }
}

// ------------------------------------------------------------ salas
let nextRoomId = 1;
const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newRoomId() { let id; do { id = 100000 + crypto.randomInt(900000); } while (rooms.has(id)); return id; }
class Room {
  constructor(o) {
    this.id = newRoomId(); nextRoomId++; this.name = S.sanitizeChat(o.name).slice(0, 28) || 'Sala ' + this.id;
    this.mode = S.isFFA(o.mode) || S.isRounds(o.mode) ? o.mode : 'tdm'; this.priv = !!o.priv; this.ranked = !!o.ranked; this.persistent = !!o.persistent;
    this.max = S.isRounds(this.mode) ? 2 * +this.mode[1] : this.mode === 'aberto' ? S.clamp(o.max | 0 || 30, 2, 30) : S.clamp(o.max | 0 || 10, 2, 12); this.code = String(this.id); this.owner = o.owner || 0;
    this.sim = new S.GameSim({ mode: this.mode, ranked: this.ranked });
    this.sim.onMatchEnd = (results, win) => this.onMatchEnd(results, win);
    this.members = new Map(); // pid -> client
    // sala criada por um jogador: começa numa sala de espera; só o criador inicia a partida
    this.waiting = !!o.custom; this.wait = new Map(); // uid -> { c, team }
    this.expiresAt = this.waiting ? Date.now() + WAIT_MS : 0;
    rooms.set(this.id, this);
  }
  teamSize() { return S.isRounds(this.mode) ? +this.mode[1] : S.isFFA(this.mode) ? this.max : Math.ceil(this.max / 2); }
  wcount(t) { let n = 0; for (const w of this.wait.values()) if (w.team === t) n++; return n; }
  canStart() { return S.isFFA(this.mode) ? this.wait.size >= 2 : this.wcount(0) >= 1 && this.wcount(1) >= 1; }
  wstate() {
    return { t: 'wroom', room: { id: this.id, name: this.name, mode: this.mode, priv: this.priv, max: this.max, size: this.teamSize() }, owner: this.owner, msLeft: Math.max(0, this.expiresAt - Date.now()), canStart: this.canStart(),
      players: [...this.wait.values()].map((w) => ({ uid: w.c.uid, name: w.c.profile.name, level: w.c.profile.level, team: w.team, char: S.lookOf(w.c.profile).c })) };
  }
  wbroadcast() { const s = JSON.stringify(this.wstate()); for (const w of this.wait.values()) w.c.sendRaw(s); broadcastRooms(); }
  wjoin(c) {
    if (this.wait.has(c.uid)) return c.send(this.wstate());
    if (this.wait.size >= this.max) return c.send({ t: 'err', m: 'Sala cheia' });
    if (c.room) c.room.leave(c);
    if (c.wroom) c.wroom.wleave(c);
    const team = S.isFFA(this.mode) ? 0 : this.wcount(0) <= this.wcount(1) ? 0 : 1;
    this.wait.set(c.uid, { c, team }); c.wroom = this;
    this.wbroadcast(); broadcastOnline();
  }
  wteam(c, team) {
    const w = this.wait.get(c.uid);
    if (!w || S.isFFA(this.mode) || (team !== 0 && team !== 1) || w.team === team || this.wcount(team) >= this.teamSize()) return;
    w.team = team; this.wbroadcast();
  }
  wleave(c, quiet) {
    if (!this.wait.has(c.uid)) return;
    this.wait.delete(c.uid); c.wroom = null;
    if (c.uid === this.owner) return this.wclose('O criador saiu e a sala foi fechada.');
    if (!quiet && c.alive) c.send({ t: 'wclosed', m: 'Você saiu da sala.', self: 1 });
    this.wbroadcast(); broadcastOnline();
  }
  wclose(msg) {
    const s = JSON.stringify({ t: 'wclosed', m: msg });
    for (const w of this.wait.values()) { w.c.wroom = null; w.c.sendRaw(s); }
    this.wait.clear(); rooms.delete(this.id); broadcastRooms(); broadcastOnline();
  }
  wstart(c) {
    if (!this.waiting || c.uid !== this.owner) return c.send({ t: 'err', m: 'Só o criador da sala pode iniciar a partida.' });
    if (!this.canStart()) return c.send({ t: 'err', m: S.isFFA(this.mode) ? 'Espere pelo menos mais 1 jogador.' : 'Espere um jogador entrar no outro time.' });
    this.waiting = false;
    const list = [...this.wait.values()]; this.wait.clear();
    for (const w of list) { w.c.wroom = null; this.join(w.c, w.team); }
    this.system('A partida começou! Boa sorte.');
    this.fillBots();
    broadcastRooms();
  }
  // mapa aberto: completa com bots até 12 jogadores (saem quando entra gente de verdade)
  fillBots() {
    if (this.mode !== 'aberto' || this.waiting) return;
    const want = Math.max(0, 12 - this.members.size);
    let bots = [...this.sim.players.values()].filter((p) => p.bot);
    while (bots.length > want) { const b = bots.pop(); this.sim.removePlayer(b.id); }
    for (let i = bots.length; i < want; i++) this.sim.addBot();
  }
  info() { const tc = [0, 0]; if (this.waiting) { for (const w of this.wait.values()) tc[w.team]++; } else for (const p of this.sim.players.values()) if (p.team === 0 || p.team === 1) tc[p.team]++; return { waiting: this.waiting, msLeft: this.waiting ? Math.max(0, this.expiresAt - Date.now()) : 0, id: this.id, name: this.name, mode: this.mode, ranked: this.ranked, n: this.waiting ? this.wait.size : this.members.size, max: this.max, priv: this.priv, teams: S.isFFA(this.mode) ? null : tc }; }
  join(c, team) {
    if (this.waiting) return this.wjoin(c);
    if (this.members.size >= this.max) return c.send({ t: 'err', m: 'Sala cheia' });
    if (c.room) c.room.leave(c);
    if (c.wroom) c.wroom.wleave(c, true);
    const p = c.profile;
    const pl = this.sim.addPlayer({ team, name: p.name, loadout: p.loadout, uniform: p.uniform, level: p.level, upgrades: p.upgrades, look: S.lookOf(p) });
    c.room = this; c.pid = pl.id; this.members.set(pl.id, c);
    c.send({ t: 'joined', pid: pl.id, room: { id: this.id, name: this.name, mode: this.mode, code: this.code, priv: this.priv, ranked: this.ranked } });
    this.system(`${p.name} entrou na sala`);
    this.fillBots();
    broadcastRooms(); broadcastOnline();
  }
  leave(c) {
    if (c.room !== this) return;
    this.sim.removePlayer(c.pid); this.members.delete(c.pid);
    this.system(`${c.profile ? c.profile.name : 'Jogador'} saiu`);
    c.room = null; c.pid = 0;
    if (c.alive) c.send({ t: 'left' });
    this.fillBots();
    if (!this.members.size && !this.persistent) rooms.delete(this.id);
    broadcastRooms(); broadcastOnline();
  }
  system(m) { const s = JSON.stringify({ t: 'chat', sys: 1, m }); for (const c of this.members.values()) c.sendRaw(s); }
  chat(c, text, team) {
    const m = S.sanitizeChat(text); if (!m) return;
    const now = Date.now(); if (now - (c.lastChat || 0) < 600) return; c.lastChat = now;
    const p = this.sim.players.get(c.pid);
    const out = JSON.stringify({ t: 'chat', from: c.profile.name, m, team: !!team && this.mode === 'tdm' });
    for (const [pid, o] of this.members) { if (team && this.mode === 'tdm' && this.sim.players.get(pid).team !== p.team) continue; o.sendRaw(out); }
  }
  onMatchEnd(results) {
    for (const r of results) {
      const c = this.members.get(r.id); if (!c || r.bot) continue;
      const out = S.applyMatchResult(c.profile, r);
      out.me = { mmr: r.mmr };
      saveProfiles();
      // envia depois do evento 'end' chegar ao cliente
      setTimeout(() => c.alive && c.send({ t: 'profile', profile: c.profile, result: out }), 150);
    }
  }
  tick(dt) {
    const sim = this.sim;
    sim.tick(dt);
    if (sim.rosterDirty) { sim.rosterDirty = false; const r = JSON.stringify({ t: 'roster', r: sim.roster() }); for (const c of this.members.values()) c.sendRaw(r); }
    const common = JSON.stringify(sim.snapCommon()); sim.events = [];
    const head = common.slice(0, -1) + ',"me":';
    for (const [pid, c] of this.members) { const p = sim.players.get(pid); if (p) c.sendRaw(head + JSON.stringify(sim.snapMe(p)) + '}'); }
  }
}
// salas públicas permanentes
new Room({ name: 'Mata-mata #1 (público)', mode: 'tdm', persistent: true, max: 12 });
new Room({ name: 'Todos contra todos #1', mode: 'ffa', persistent: true, max: 10 });
new Room({ name: 'Mapa aberto #1', mode: 'aberto', persistent: true, max: 30 });

function roomList() { return [...rooms.values()].filter((r) => !r.priv).map((r) => r.info()); }
function broadcastRooms() { const s = JSON.stringify({ t: 'rooms', list: roomList() }); for (const c of clients.values()) if (c.hello && !c.room) c.sendRaw(s); }
let onlineTimer = null;
function broadcastOnline() {
  if (onlineTimer) return;
  onlineTimer = setTimeout(() => {
    onlineTimer = null;
    const list = [...clients.values()].filter((c) => c.hello).slice(0, 100).map((c) => ({ uid: c.uid, name: c.profile.name, level: c.profile.level, room: c.room || c.wroom ? 1 : 0 }));
    const s = JSON.stringify({ t: 'online', list });
    for (const c of clients.values()) if (c.hello) c.sendRaw(s);
  }, 300);
}

// ------------------------------------------------------------ mensagens
function handle(c, m) {
  if (m.t === 'hello') {
    if (c.hello || c.authing) return;
    const finish = (tok, acct) => {
      if (!c.alive) return;
      if (!tok || !profiles[tok]) { tok = crypto.randomBytes(16).toString('hex'); profiles[tok] = S.newProfile(m.name); }
      c.token = tok; c.profile = S.fixProfile(profiles[tok]); profiles[tok] = c.profile; c.hello = true;
      if (acct) { accounts[acct.key] = tok; c.profile.account = { provider: acct.provider, email: acct.email || '' }; }
      if (m.name && (m.setName || !acct)) c.profile.name = S.sanitizeName(m.name);
      saveProfiles();
      c.send({ t: 'welcome', uid: c.uid, token: tok, profile: c.profile, account: c.profile.account || null });
      c.send({ t: 'rooms', list: roomList() });
      broadcastOnline();
    };
    const tok = typeof m.token === 'string' && /^[a-f0-9]{32}$/.test(m.token) ? m.token : null;
    if (m.auth && m.auth.provider && m.auth.cred) {
      c.authing = true;
      verifyAuth(m.auth.provider, String(m.auth.cred)).then((acct) => {
        c.authing = false;
        if (!acct) return c.send({ t: 'autherr', m: 'Não foi possível confirmar o login com ' + (m.auth.provider === 'google' ? 'Google' : 'Facebook') + '.' });
        finish(accounts[acct.key] || null, acct);
      }).catch(() => { c.authing = false; c.send({ t: 'autherr', m: 'Erro ao validar o login. Tente novamente.' }); });
      return;
    }
    return finish(tok, null);
  }
  if (!c.hello) return;
  const room = c.room;
  switch (m.t) {
    case 'ping': return c.send({ t: 'pong', c: m.c });
    case 'sp': { const rtt = Date.now() - (+m.c || 0); if (rtt >= 0 && rtt < 5000 && room) { const p = room.sim.players.get(c.pid); if (p) p.ping = p.ping * 0.7 + (rtt / 1000) * 0.3; } return; }
    case 'rooms': return c.send({ t: 'rooms', list: roomList() });
    case 'find': { const r = rooms.get(parseInt(m.id, 10)); return c.send({ t: 'found', id: parseInt(m.id, 10) || 0, room: r ? r.info() : null }); }
    case 'create': {
      const r = new Room({ name: m.name, mode: m.mode, priv: !!m.priv, max: m.max, owner: c.uid, custom: true });
      return r.join(c);
    }
    case 'join': {
      let r = null;
      const id = parseInt(m.id || m.code, 10);
      if (id) r = rooms.get(id);
      if (!r) return c.send({ t: 'err', m: 'Sala não encontrada' });
      if (r === room || r === c.wroom) return r.waiting ? c.send(r.wstate()) : undefined;
      return r.join(c);
    }
    case 'quick': {
      const ranked = m.mode === 'ranked', mode = ranked ? 'tdm' : S.isFFA(m.mode) || S.isRounds(m.mode) ? m.mode : 'tdm';
      let best = null;
      for (const r of rooms.values()) if (!r.priv && r.mode === mode && r.ranked === ranked && !r.waiting && r.members.size < r.max && (!best || r.members.size > best.members.size)) best = r;
      if (!best) best = new Room({ name: ranked ? 'Ranqueado #' + nextRoomId : (mode === 'aberto' ? 'Mapa aberto' : mode === 'ffa' ? 'Todos contra todos' : S.isRounds(mode) ? mode.toUpperCase() : 'Mata-mata'), mode, ranked, max: ranked ? 10 : mode === 'aberto' ? 30 : 12 });
      return best.join(c);
    }
    case 'leave': if (room) room.leave(c); else if (c.wroom) c.wroom.wleave(c); return;
    case 'wteam': if (c.wroom) c.wroom.wteam(c, m.team); return;
    case 'wstart': if (c.wroom) c.wroom.wstart(c); return;
    case 'in': if (room) room.sim.handleInputs(c.pid, m.l); return;
    case 'act': if (room) room.sim.handleAction(c.pid, m); return;
    case 'team': if (room && !room.ranked && !S.isFFA(room.mode)) { room.sim.setTeam(c.pid, m.team); room.system(`${c.profile.name} trocou de equipe`); } return;
    case 'chat': if (room) room.chat(c, m.m, m.team); return;
    case 'buy': {
      const err = S.buy(c.profile, String(m.item));
      if (err) c.send({ t: 'err', m: err }); else { saveProfiles(); c.send({ t: 'profile', profile: c.profile }); }
      return;
    }
    case 'equip': S.equip(c.profile, { primary: m.primary, secondary: m.secondary, uniform: m.uniform, char: m.char, shirt: m.shirt, pants: m.pants, wskin: m.wskin }); saveProfiles(); return c.send({ t: 'profile', profile: c.profile });
    case 'rename': c.profile.name = S.sanitizeName(m.name); saveProfiles(); broadcastOnline(); return c.send({ t: 'profile', profile: c.profile });
    case 'invite': {
      const to = clients.get(m.to | 0);
      const ir = room || c.wroom;
      if (!to || !to.hello || !ir) return;
      if (Date.now() - (c.lastInvite || 0) < 1500) return; c.lastInvite = Date.now();
      return to.send({ t: 'invite', from: c.profile.name, roomName: ir.name, code: ir.code });
    }
  }
}

// ------------------------------------------------------------ login Google / Facebook (validado no servidor)
async function verifyAuth(provider, cred) {
  if (FAKE_AUTH && cred.startsWith('test:')) { const [, id, name] = cred.split(':'); return { key: provider + ':' + id, provider, name }; }
  if (provider === 'google') {
    if (!GOOGLE_CLIENT_ID) return null;
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
    if (!r.ok) return null;
    const j = await r.json();
    if (j.aud !== GOOGLE_CLIENT_ID || !/accounts\.google\.com$/.test(j.iss || '') || +j.exp * 1000 < Date.now()) return null;
    return { key: 'google:' + j.sub, provider, name: j.name || j.given_name || '', email: j.email || '' };
  }
  if (provider === 'facebook') {
    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) return null;
    const app = FACEBOOK_APP_ID + '|' + FACEBOOK_APP_SECRET;
    const d = await (await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(cred)}&access_token=${encodeURIComponent(app)}`)).json();
    if (!d.data || !d.data.is_valid || String(d.data.app_id) !== String(FACEBOOK_APP_ID)) return null;
    const me = await (await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${encodeURIComponent(cred)}`)).json();
    return { key: 'facebook:' + d.data.user_id, provider, name: me.name || '' };
  }
  return null;
}

// ------------------------------------------------------------ laço do servidor (30 Hz)
let lastTick = process.hrtime.bigint(), acc = 0;
setInterval(() => {
  const t = process.hrtime.bigint(); acc += Number(t - lastTick) / 1e9; lastTick = t;
  if (acc > 0.5) acc = 0.5;
  while (acc >= S.C.TICK) { acc -= S.C.TICK; for (const r of rooms.values()) if (r.members.size) r.tick(S.C.TICK); }
}, 10);
// salas de espera vencidas fecham sozinhas
setInterval(() => { const t = Date.now(); for (const r of [...rooms.values()]) if (r.waiting && t >= r.expiresAt) r.wclose('A sala fechou: o tempo de 5 minutos acabou e a partida não começou.'); }, 1000);
// medição de ping para compensação de latência
setInterval(() => { const s = JSON.stringify({ t: 'sp', c: Date.now() }); for (const c of clients.values()) if (c.room) c.sendRaw(s); }, 2000);

S.buildNav();
server.listen(PORT, () => console.log(`VORZAK rodando em http://localhost:${PORT}`));
module.exports = { server, rooms, clients };
