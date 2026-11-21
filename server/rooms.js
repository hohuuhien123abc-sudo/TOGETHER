/* TOGETHER! - rooms.js : phòng chơi (mã phòng, phòng công khai, tối đa 8 người) */
const { COLORS } = require('./player');
const { GameEngine } = require('./game-engine');
const Levels = require('../public/js/levels.js');
const db = require('./db');
const MAXP = 8, CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MINIS = ['coinrush', 'lava', 'race'];

class Room {
  constructor(mgr, code, pub) {
    this.mgr = mgr; this.code = code; this.pub = !!pub; this.players = new Map(); this.hostId = null;
    this.sel = 1; this.state = 'lobby'; this.engine = null; this.timer = null; this.result = null;
  }
  limit() { let m = 10; for (const p of this.players.values()) if (p.user) m = Math.max(m, db.progress(p.user).unlocked); return Math.min(Levels.TOTAL, m); }
  validSel(sel) {
    if (typeof sel === 'number' || /^\d+$/.test(sel)) { const n = +sel; return n >= 1 && n <= this.limit() ? n : null; }
    if (typeof sel === 'string' && sel.startsWith('mini:') && MINIS.includes(sel.slice(5))) return sel;
    if (typeof sel === 'string' && /^map:\d+$/.test(sel) && db.getMap(sel.slice(4))) return sel;
    return null;
  }
  add(p) {
    const used = new Set([...this.players.values()].map(x => x.ci)); let ci = 0; while (used.has(ci)) ci++;
    p.ci = ci % COLORS.length; p.room = this; p.ready = false; this.players.set(p.id, p);
    if (!this.hostId) this.hostId = p.id;
    if (this.state === 'playing' && this.engine) { this.engine.addPlayer(p); p.send(this.startMsg()); }
    this.broadcastInfo();
  }
  remove(p) {
    if (!this.players.delete(p.id)) return;
    if (this.engine) this.engine.removePlayer(p);
    p.room = null;
    if (!this.players.size) return this.destroy();
    if (this.hostId === p.id) this.hostId = this.players.keys().next().value;
    this.broadcastInfo();
  }
  destroy() { clearInterval(this.timer); this.timer = null; this.mgr.rooms.delete(this.code); }
  broadcast(o) { const s = JSON.stringify(o); for (const p of this.players.values()) if (p.ws.alive) p.ws.send(s); }
  info() { return { t: 'room', code: this.code, pub: this.pub, sel: this.sel, state: this.state, limit: this.limit(), hostId: this.hostId, players: [...this.players.values()].map(p => p.info(this.hostId)) }; }
  broadcastInfo() { this.broadcast(this.info()); }
  startMsg() {
    const e = this.engine, l = e.level;
    return { t: 'start', sel: this.sel, mode: e.mode, level: { name: l.name, theme: l.theme, par: l.par, tiles: l.tiles }, players: [...this.players.values()].map(p => ({ id: p.id, name: p.name, ci: p.ci })) };
  }
  start() {
    if (this.state === 'playing') return;
    let level = null;
    if (typeof this.sel === 'string' && this.sel.startsWith('map:')) {
      const m = db.getMap(this.sel.slice(4)); if (!m) return this.broadcast({ t: 'err', m: 'Bản đồ không tồn tại' });
      m.plays++; level = { id: 'map' + m.id, name: m.name, theme: m.id % 10, par: Math.round(m.tiles[0].length * 0.25 + 14), tiles: m.tiles };
    }
    this.engine = new GameEngine(this.sel, (Math.random() * 1e9) | 0, level);
    for (const p of this.players.values()) { p.ready = false; this.engine.addPlayer(p); }
    this.state = 'playing'; this.result = null;
    this.broadcast(this.startMsg()); this.broadcastInfo();
    clearInterval(this.timer); this.timer = setInterval(() => this.tick(), 1000 / 30);
  }
  tick() {
    try { this.engine.tick(1 / 30); } catch (e) { console.error('engine error', e); this.toLobby(); return; }
    this.broadcast(this.engine.snapshot());
    if (this.engine.finished) this.finish();
  }
  finish() {
    clearInterval(this.timer); this.timer = null; this.state = 'result';
    const r = this.engine.result, numeric = typeof this.sel === 'number';
    for (const row of r.rows) {
      const p = this.players.get(row.id); if (!p || !p.user) continue;
      if (r.mode === 'coop') { if (numeric) db.recordLevel(p.user, this.sel, r.time, r.stars, row.coins, row.pts); }
      else db.recordMini(p.user, r.mode, row.pts);
    }
    this.result = Object.assign({}, r, { next: numeric && this.sel < Levels.TOTAL });
    this.broadcast(this.result); this.broadcastInfo();
  }
  toLobby() { clearInterval(this.timer); this.timer = null; this.state = 'lobby'; this.engine = null; for (const p of this.players.values()) { p.g = null; p.ready = false; } this.broadcastInfo(); }
  handle(p, m) {
    const host = p.id === this.hostId;
    switch (m.t) {
      case 'in': if (this.engine && this.state === 'playing') this.engine.input(p, m); break;
      case 'ready': if (this.state === 'lobby') { p.ready = !p.ready; this.broadcastInfo(); } break;
      case 'sel': { if (!host || this.state === 'playing') break; const s = this.validSel(m.sel); if (s === null) return p.send({ t: 'err', m: 'Màn chơi chưa mở khóa' }); this.sel = s; this.broadcastInfo(); break; }
      case 'pub': if (host) { this.pub = !!m.v; this.broadcastInfo(); } break;
      case 'start': if (host && this.state !== 'playing') this.start(); break;
      case 'retry': if (host && this.state === 'result') this.start(); break;
      case 'next': if (host && this.state === 'result' && typeof this.sel === 'number') { const s = this.validSel(this.sel + 1); if (s !== null) { this.sel = s; this.start(); } else p.send({ t: 'err', m: 'Màn kế tiếp chưa mở khóa' }); } break;
      case 'lobby': if (host && this.state !== 'lobby') this.toLobby(); break;
      case 'unstick': if (this.engine) this.engine.unstick(p); break;
      case 'chat': { const s = String(m.m || '').trim().slice(0, 120); if (s) this.broadcast({ t: 'chat', id: p.id, name: p.name, ci: p.ci, m: s }); break; }
      case 'emote': this.broadcast({ t: 'emote', id: p.id, e: Math.max(0, Math.min(5, m.e | 0)) }); break;
    }
  }
}

class RoomManager {
  constructor() { this.rooms = new Map(); }
  code() { let c; do { c = ''; for (let i = 0; i < 4; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; } while (this.rooms.has(c)); return c; }
  create(pub) { const r = new Room(this, this.code(), pub); this.rooms.set(r.code, r); return r; }
  get(code) { return this.rooms.get(String(code || '').toUpperCase().trim()); }
  listPublic() {
    return [...this.rooms.values()].filter(r => r.pub && r.players.size < MAXP).map(r => ({ code: r.code, count: r.players.size, max: MAXP, state: r.state, sel: r.sel, host: (r.players.get(r.hostId) || {}).name }));
  }
  quick() { return [...this.rooms.values()].find(r => r.pub && r.state === 'lobby' && r.players.size < MAXP) || this.create(true); }
}
module.exports = { Room, RoomManager, MAXP };
