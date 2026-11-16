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
// ------------------------------------------------------------ amigos e correio
// cada perfil tem um ID público de 8 dígitos (pid) — o token continua secreto
const pidIndex = new Map(); // pid -> token
for (const tok in profiles) if (profiles[tok] && profiles[tok].pid) pidIndex.set(profiles[tok].pid, tok);
function ensurePid(tok, p) {
  if (!p.pid || (pidIndex.has(p.pid) && pidIndex.get(p.pid) !== tok)) { do { p.pid = String(10000000 + Math.floor(Math.random() * 89999999)); } while (pidIndex.has(p.pid)); }
  pidIndex.set(p.pid, tok);
}
function profByPid(pid) { const tok = pidIndex.get(String(pid)); if (!tok || !profiles[tok]) return null; return (profiles[tok] = S.fixProfile(profiles[tok])); }
function clientByPid(pid) { for (const c of clients.values()) if (c.hello && c.profile && c.profile.pid === pid) return c; return null; }
// avisos do sistema (chegam no correio de todo mundo uma vez)
const NEWS = [
  { id: 'n-casas', title: 'Casas abertas no Mapa aberto', body: 'As casas novas não têm mais portas e ganharam janelas: entre para se esconder! Dentro delas tem kit médico e arma no chão.' },
  { id: 'n-maverick', title: 'Nova arma: Maverick 88', body: 'Escopeta de bomba com 6 tiros. Compre na Loja (nível 3) ou pegue no chão do Mapa aberto.' },
  { id: 'n-3p', title: 'Câmera em 3ª pessoa', body: 'Agora você vê o personagem inteiro. Use o botão 👁 CÂM (ou a tecla V) para trocar entre 3ª e 1ª pessoa.' },
  { id: 'n-corrida', title: 'Corrida nova', body: 'Os personagens agora correm com animação gravada de pessoas reais, segurando a arma.' },
  { id: 'n-trem', title: 'Mapa aberto: entre pelo trem', body: 'Ao jogar o Mapa aberto online, o jogo procura jogadores e todos começam dentro do trem. Pule onde quiser para procurar armas e kits!' },
  { id: 'n-social', title: 'Amigos e correio', body: 'Procure jogadores pelo nome ou pelo ID e envie pedidos de amizade no botão de amigos, no alto da tela inicial. Os avisos do jogo chegam aqui no correio.' },
];
function addMail(p, title, body) {
  p.mail.unshift({ id: crypto.randomBytes(5).toString('hex'), ts: Date.now(), title: String(title).slice(0, 60), body: String(body).slice(0, 400), read: 0 });
  if (p.mail.length > 40) p.mail.length = 40;
}
function syncNews(p) { for (const n of NEWS) if (!p.news.includes(n.id)) { p.news.push(n.id); addMail(p, n.title, n.body); } }
function pubOf(pid) {
  const p = profByPid(pid); if (!p) return null;
  const c = clientByPid(pid);
  return { id: pid, name: p.name, real: p.account && p.account.realName ? p.account.realName : '', level: p.level, char: S.lookOf(p).c, online: c ? 1 : 0, playing: c && (c.room || c.wroom) ? 1 : 0, uid: c ? c.uid : 0 };
}
function socialOf(p) {
  return { t: 'social', me: p.pid, friends: p.friends.map(pubOf).filter(Boolean), inc: p.fin.map(pubOf).filter(Boolean), out: p.fout.map(pubOf).filter(Boolean) };
}
function pushSocial(c) { if (c && c.alive && c.hello) c.send(socialOf(c.profile)); }
function pushProfile(c) { if (c && c.alive && c.hello) c.send({ t: 'profile', profile: c.profile }); }
function friendsOnlineChanged(p) { for (const f of p.friends) { const fc = clientByPid(f); if (fc) pushSocial(fc); } }
// ------------------------------------------------------------ cópia de segurança das contas
// No Render grátis o disco é apagado a cada atualização/reinício: o servidor manda para o aparelho uma cópia do perfil
// assinada (HMAC). Se o perfil sumir do servidor, o aparelho devolve a cópia e o servidor confere a assinatura e restaura.
// Defina SAVE_SECRET nas variáveis do Render para uma chave só sua.
const SAVE_SECRET = process.env.SAVE_SECRET || 'vorzak-save-v1-' + (process.env.RENDER_SERVICE_ID || 'local');
function makeSave(tok, p) {
  const d = JSON.stringify({ tok, p, ts: Date.now() });
  return { d, s: crypto.createHmac('sha256', SAVE_SECRET).update(d).digest('hex') };
}
function readSave(sv) {
  try {
    if (!sv || typeof sv.d !== 'string' || typeof sv.s !== 'string' || sv.d.length > 200000) return null;
    const s = crypto.createHmac('sha256', SAVE_SECRET).update(sv.d).digest('hex');
    if (s.length !== sv.s.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(sv.s))) return null;
    const o = JSON.parse(sv.d);
    return o && typeof o.tok === 'string' && /^[a-f0-9]{32}$/.test(o.tok) && o.p && typeof o.p === 'object' ? o : null;
  } catch (e) { return null; }
}
let saveTimer = null;
function saveProfiles() {
  for (const c of clients.values()) if (c.hello && c.profile) c.profile.savedAt = Date.now();
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
  send(obj) {
    // todo perfil enviado leva junto uma cópia assinada: o aparelho guarda e devolve se o servidor reiniciar e perder os dados
    if (obj && typeof obj === 'object' && (obj.t === 'profile' || obj.t === 'welcome') && this.token && this.profile) obj.save = makeSave(this.token, this.profile);
    this.sendRaw(typeof obj === 'string' ? obj : JSON.stringify(obj));
  }
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
    partyLeave(this);
    clients.delete(this.uid);
    broadcastOnline();
    if (this.hello && this.profile) friendsOnlineChanged(this.profile);
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
    this.sqs = this.mode === 'aberto' ? ([1, 2, 4].includes(o.sqs) ? o.sqs : 1) : 1; // mapa aberto: solo (1), duo (2) ou squad (4)
    this.squads = new Map(); this.nextSq = 1; // equipes da sala: id -> { n, open }
    this.sim = new S.GameSim({ mode: this.mode, ranked: this.ranked, br: this.mode === 'aberto', brBusca: process.env.BR_FAST ? +process.env.BR_FAST || 2 : 0, brLobby: process.env.BR_FAST ? +process.env.BR_FAST || 2 : 0 }); // mapa aberto online: procurar jogadores -> lobby -> trem
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
  // mapa aberto online: só jogadores de verdade (tira qualquer bot que tenha sobrado)
  fillBots() {
    if (this.mode !== 'aberto' || this.waiting) return;
    const want = 0;
    let bots = [...this.sim.players.values()].filter((p) => p.bot);
    while (bots.length > want) { const b = bots.pop(); this.sim.removePlayer(b.id); }
    for (let i = bots.length; i < want; i++) this.sim.addBot();
  }
  info() { const tc = [0, 0]; if (this.waiting) { for (const w of this.wait.values()) tc[w.team]++; } else for (const p of this.sim.players.values()) if (p.team === 0 || p.team === 1) tc[p.team]++; return { sqs: this.sqs, waiting: this.waiting, msLeft: this.waiting ? Math.max(0, this.expiresAt - Date.now()) : 0, id: this.id, name: this.name, mode: this.mode, ranked: this.ranked, n: this.waiting ? this.wait.size : this.members.size, max: this.max, priv: this.priv, teams: S.isFFA(this.mode) ? null : tc }; }
  // equipe para quem entra sozinho no duo/squad: completa uma equipe aberta (formada por jogadores sozinhos)
  openSquad() {
    if (this.sqs <= 1) return 0;
    for (const [id, q] of this.squads) if (q.open && q.n < this.sqs) return id;
    const id = this.nextSq++; this.squads.set(id, { n: 0, open: true }); return id;
  }
  newSquad() { const id = this.nextSq++; this.squads.set(id, { n: 0, open: false }); return id; }
  join(c, team, sq) {
    if (this.waiting) return this.wjoin(c);
    if (this.members.size >= this.max) return c.send({ t: 'err', m: 'Sala cheia' });
    if (c.room) c.room.leave(c);
    if (c.wroom) c.wroom.wleave(c, true);
    const p = c.profile;
    if (this.mode === 'aberto' && this.sqs > 1 && !sq) sq = this.openSquad();
    if (sq) { const q = this.squads.get(sq); if (q) q.n++; }
    c.sq = sq || 0;
    const pl = this.sim.addPlayer({ sq, team, name: p.name, loadout: p.loadout, uniform: p.uniform, level: p.level, upgrades: p.upgrades, look: S.lookOf(p) });
    c.room = this; c.pid = pl.id; this.members.set(pl.id, c);
    c.send({ t: 'joined', pid: pl.id, room: { id: this.id, name: this.name, mode: this.mode, code: this.code, priv: this.priv, ranked: this.ranked } });
    this.system(`${p.name} entrou na sala`);
    this.fillBots();
    broadcastRooms(); broadcastOnline();
  }
  leave(c) {
    if (c.room !== this) return;
    this.sim.removePlayer(c.pid); this.members.delete(c.pid);
    if (c.sq) { const q = this.squads.get(c.sq); if (q && --q.n <= 0) this.squads.delete(c.sq); c.sq = 0; }
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

// ------------------------------------------------------------ grupo (solo / duo / squad) do mapa aberto
let nextParty = 1;
const parties = new Map();
function newParty(c, size) { partyLeave(c); const p = { id: nextParty++, leader: c.uid, size, members: [c], invited: new Set() }; c.party = p; parties.set(p.id, p); return p; }
function partyState(p) {
  return { t: 'party', id: p.id, leader: p.leader, size: p.size, members: p.members.map((m) => ({ uid: m.uid, pid: m.profile.pid, name: m.profile.name, level: m.profile.level, char: S.lookOf(m.profile).c, playing: m.room ? 1 : 0 })) };
}
function pushParty(p) { const s = JSON.stringify(partyState(p)); for (const m of p.members) m.sendRaw(s); }
function partyLeave(c) {
  const p = c.party; if (!p) return;
  p.members = p.members.filter((m) => m !== c); c.party = null;
  if (c.alive) c.send({ t: 'party', id: 0, size: p.size });
  if (!p.members.length) { parties.delete(p.id); return; }
  if (p.leader === c.uid) p.leader = p.members[0].uid;
  pushParty(p);
}
// busca do mapa aberto: o grupo inteiro entra na mesma sala e na mesma equipe
function quickOpen(c, m) {
  const pt = c.party && c.party.members.length > 1 ? c.party : null;
  const size = pt ? pt.size : [1, 2, 4].includes(m.sq) ? m.sq : c.party ? c.party.size : 1;
  if (pt && pt.leader !== c.uid) return c.send({ t: 'err', m: 'Só o líder do grupo pode buscar partida.' });
  const group = pt ? pt.members.slice() : [c];
  const busy = group.find((o) => o !== c && o.room);
  if (busy) return c.send({ t: 'err', m: busy.profile.name + ' ainda está em uma partida. Espere ele voltar ao menu.' });
  const brOk = (r) => !r.sim.br || r.sim.ph === 'busca' || (r.sim.ph === 'lobby' && r.sim.phEnd - r.sim.time > 3);
  let best = null;
  for (const r of rooms.values()) if (!r.priv && r.mode === 'aberto' && r.sqs === size && !r.waiting && r.members.size + group.length <= r.max && brOk(r) && (!best || r.members.size > best.members.size)) best = r;
  if (!best) best = new Room({ name: 'Mapa aberto ' + (size === 4 ? 'Squad' : size === 2 ? 'Duo' : 'Solo') + ' #' + nextRoomId, mode: 'aberto', max: 30, sqs: size });
  const sq = size > 1 ? (pt ? best.newSquad() : best.openSquad()) : 0;
  for (const o of group) { if (o.wroom) o.wroom.wleave(o, true); best.join(o, undefined, sq); }
  if (pt) pushParty(pt);
}
// quem escuta a voz: companheiros da mesma equipe na partida; no menu, os outros membros do grupo
function voiceGroup(c) {
  const out = [];
  if (c.room) {
    const r = c.room, me = r.sim.players.get(c.pid);
    if (!me || r.mode === 'ffa' || (r.mode === 'aberto' && !(me.team >= 100000))) return out;
    for (const [pid, o] of r.members) { if (o === c) continue; const p = r.sim.players.get(pid); if (p && p.team === me.team) out.push(o); }
  } else if (c.party) for (const o of c.party.members) if (o !== c && !o.room) out.push(o);
  return out;
}

// ------------------------------------------------------------ mensagens
function handle(c, m) {
  if (m.t === 'hello') {
    if (c.hello || c.authing) return;
    const finish = (tok, acct) => {
      if (!c.alive) return;
      let fresh = false;
      // perfil sumiu do servidor (reinício): restaura a cópia assinada que o aparelho guardou
      const sv = readSave(m.save);
      if (sv && (!profiles[sv.tok] || (profiles[sv.tok].savedAt || 0) < (sv.p.savedAt || 0)) && (!tok || tok === sv.tok || !profiles[tok])) {
        profiles[sv.tok] = sv.p; tok = sv.tok; console.log('perfil restaurado da cópia do aparelho:', sv.p.name);
      }
      if (!tok || !profiles[tok]) { tok = crypto.randomBytes(16).toString('hex'); profiles[tok] = S.newProfile(m.name); fresh = true; }
      c.token = tok; c.profile = S.fixProfile(profiles[tok]); profiles[tok] = c.profile; c.hello = true;
      ensurePid(tok, c.profile);
      if (fresh) addMail(c.profile, 'Bem-vindo ao VORZAK!', 'Seu ID de jogador é ' + c.profile.pid + '. Passe para seus amigos para eles te adicionarem. Bom jogo!');
      syncNews(c.profile);
      if (acct) { accounts[acct.key] = tok; c.profile.account = { provider: acct.provider, email: acct.email || '', realName: S.sanitizeChat(acct.name || '').slice(0, 40) }; }
      if (m.name && (m.setName || !acct)) c.profile.name = S.sanitizeName(m.name);
      saveProfiles();
      c.send({ t: 'welcome', uid: c.uid, token: tok, profile: c.profile, account: c.profile.account || null });
      pushSocial(c); friendsOnlineChanged(c.profile);
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
    // ---------------- amigos
    case 'social': return pushSocial(c);
    case 'fsearch': {
      const q = String(m.q || '').trim().toLowerCase().slice(0, 20), me = c.profile, out = [];
      if (q.length >= 2) {
        if (/^\d{8}$/.test(q)) { if (q !== me.pid && pidIndex.has(q)) out.push(q); }
        else for (const [pid] of pidIndex) { if (pid === me.pid) continue; const p = profByPid(pid); if (p && (p.name.toLowerCase().includes(q) || (p.account && p.account.realName && p.account.realName.toLowerCase().includes(q)))) out.push(pid); if (out.length >= 20) break; }
      }
      const list = out.map(pubOf).filter(Boolean).map((x) => Object.assign(x, { friend: me.friends.includes(x.id) ? 1 : 0, sent: me.fout.includes(x.id) ? 1 : 0, got: me.fin.includes(x.id) ? 1 : 0 }));
      return c.send({ t: 'fresults', q, list });
    }
    case 'freq': {
      const me = c.profile, id = String(m.id || ''), o = profByPid(id);
      if (!o || id === me.pid) return c.send({ t: 'err', m: 'Jogador não encontrado.' });
      if (me.friends.includes(id)) return c.send({ t: 'err', m: 'Vocês já são amigos.' });
      if (me.friends.length >= 100) return c.send({ t: 'err', m: 'Sua lista de amigos está cheia (100).' });
      if (me.fin.includes(id)) return handle(c, { t: 'fresp', id, ok: 1 }); // ele já tinha pedido: vira amizade
      if (!me.fout.includes(id)) me.fout.push(id);
      if (!o.fin.includes(me.pid)) { o.fin.push(me.pid); addMail(o, 'Pedido de amizade', me.name + ' (ID ' + me.pid + ') quer ser seu amigo. Abra Amigos > Pedidos para aceitar.'); }
      saveProfiles(); pushSocial(c);
      const oc = clientByPid(id); if (oc) { pushSocial(oc); pushProfile(oc); oc.send({ t: 'fnote', m: me.name + ' enviou um pedido de amizade' }); }
      return c.send({ t: 'fnote', m: 'Pedido enviado para ' + o.name });
    }
    case 'fresp': {
      const me = c.profile, id = String(m.id || ''), o = profByPid(id);
      me.fin = me.fin.filter((x) => x !== id);
      if (o) o.fout = o.fout.filter((x) => x !== me.pid);
      if (o && m.ok) {
        if (!me.friends.includes(id)) me.friends.push(id);
        if (!o.friends.includes(me.pid)) o.friends.push(me.pid);
        me.fout = me.fout.filter((x) => x !== id); o.fin = o.fin.filter((x) => x !== me.pid);
        addMail(o, 'Amizade aceita', me.name + ' aceitou seu pedido de amizade.');
      }
      saveProfiles(); pushSocial(c);
      const oc = clientByPid(id); if (oc) { pushSocial(oc); pushProfile(oc); if (m.ok) oc.send({ t: 'fnote', m: me.name + ' aceitou sua amizade!' }); }
      return;
    }
    case 'frem': {
      const me = c.profile, id = String(m.id || ''), o = profByPid(id);
      me.friends = me.friends.filter((x) => x !== id); me.fout = me.fout.filter((x) => x !== id);
      if (o) { o.friends = o.friends.filter((x) => x !== me.pid); o.fin = o.fin.filter((x) => x !== me.pid); }
      saveProfiles(); pushSocial(c); const oc = clientByPid(id); if (oc) pushSocial(oc);
      return;
    }
    // ---------------- correio
    case 'mread': { for (const x of c.profile.mail) if (m.all || x.id === m.id) x.read = 1; saveProfiles(); return pushProfile(c); }
    case 'mdel': { c.profile.mail = c.profile.mail.filter((x) => !(m.all ? x.read : x.id === m.id)); saveProfiles(); return pushProfile(c); }
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
      if (mode === 'aberto') return quickOpen(c, m);
      let best = null;
      // mapa aberto: só entra em sala que ainda está procurando jogadores ou no lobby; senão abre outra sala
      // (assim todo mundo sempre passa por: procurar jogadores -> lobby -> trem)
      const brOk = (r) => mode !== 'aberto' || !r.sim.br || r.sim.ph === 'busca' || (r.sim.ph === 'lobby' && r.sim.phEnd - r.sim.time > 3);
      for (const r of rooms.values()) if (!r.priv && r.mode === mode && r.ranked === ranked && !r.waiting && r.members.size < r.max && brOk(r) && (!best || r.members.size > best.members.size)) best = r;
      if (!best) best = new Room({ name: ranked ? 'Ranqueado #' + nextRoomId : (mode === 'aberto' ? 'Mapa aberto #' + nextRoomId : mode === 'ffa' ? 'Todos contra todos' : S.isRounds(mode) ? mode.toUpperCase() : 'Mata-mata'), mode, ranked, max: ranked ? 10 : mode === 'aberto' ? 30 : 12 });
      return best.join(c);
    }
    case 'leave': if (room) room.leave(c); else if (c.wroom) c.wroom.wleave(c); return;
    // ---------------- grupo do mapa aberto (solo / duo / squad)
    case 'psize': {
      const size = [1, 2, 4].includes(m.size) ? m.size : 1;
      if (!c.party) { if (size > 1) { newParty(c, size); pushParty(c.party); } else c.send({ t: 'party', id: 0, size: 1 }); return; }
      const pt = c.party;
      if (pt.leader !== c.uid) return c.send({ t: 'err', m: 'Só o líder do grupo escolhe Solo, Duo ou Squad.' });
      if (pt.members.length > size) return c.send({ t: 'err', m: `Seu grupo tem ${pt.members.length} jogadores: escolha um modo maior ou remova alguém.` });
      pt.size = size; return pushParty(pt);
    }
    case 'pinv': {
      const id = String(m.id || ''), me = c.profile;
      if (!me.friends.includes(id)) return c.send({ t: 'err', m: 'Você só pode convidar amigos.' });
      const oc = clientByPid(id); if (!oc) return c.send({ t: 'err', m: 'Seu amigo não está online.' });
      if (!c.party) newParty(c, 4);
      const pt = c.party;
      if (pt.leader !== c.uid) return c.send({ t: 'err', m: 'Só o líder do grupo pode convidar.' });
      if (pt.size < 2) pt.size = 4;
      if (pt.members.includes(oc)) return c.send({ t: 'err', m: oc.profile.name + ' já está no seu grupo.' });
      if (pt.members.length >= pt.size) return c.send({ t: 'err', m: 'Seu grupo está cheio.' });
      if (Date.now() - (c.lastPinv || 0) < 1000) return; c.lastPinv = Date.now();
      pt.invited.add(oc.uid); pushParty(pt);
      oc.send({ t: 'pinvite', party: pt.id, from: me.name, pid: me.pid, size: pt.size });
      return c.send({ t: 'fnote', m: 'Convite enviado para ' + oc.profile.name });
    }
    case 'pjoin': {
      const pt = parties.get(m.party | 0);
      if (!pt || !pt.invited.has(c.uid)) return c.send({ t: 'err', m: 'Esse convite não vale mais.' });
      if (pt.members.length >= pt.size) return c.send({ t: 'err', m: 'O grupo já está cheio.' });
      if (room) room.leave(c);
      if (c.wroom) c.wroom.wleave(c, true);
      partyLeave(c);
      pt.invited.delete(c.uid); pt.members.push(c); c.party = pt; pushParty(pt);
      for (const o of pt.members) if (o !== c) o.send({ t: 'fnote', m: c.profile.name + ' entrou no grupo!' });
      return;
    }
    case 'pleave': return partyLeave(c);
    case 'pkick': {
      const pt = c.party; if (!pt || pt.leader !== c.uid) return;
      const o = pt.members.find((x) => x.uid === (m.uid | 0)); if (!o || o === c) return;
      partyLeave(o); o.send({ t: 'fnote', m: 'Você saiu do grupo.' }); return;
    }
    // ---------------- voz da equipe: o servidor só repassa para os companheiros (qualquer distância)
    case 'vc': {
      if (typeof m.d !== 'string' || m.d.length > 2400) return;
      const t = Date.now(); if (t - (c.vcWin || 0) > 1000) { c.vcWin = t; c.vcN = 0; } if (++c.vcN > 20) return;
      const out = JSON.stringify({ t: 'vc', u: c.uid, p: c.room ? c.pid : 0, d: m.d });
      for (const o of voiceGroup(c)) o.sendRaw(out);
      return;
    }
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
