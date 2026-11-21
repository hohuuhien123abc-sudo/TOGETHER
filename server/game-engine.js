/* TOGETHER! - game-engine.js : logic game phía server (nút/cửa, xu, checkpoint, hố/gai, cổng đích, mini-game) */
const Levels = require('../public/js/levels.js');
const T = 32, PW = 24, PH = 30, COUNTDOWN = 3;
const MINI = { coinrush: 45, lava: 100, race: 120 };

class GameEngine {
  constructor(sel, seed, level) {
    this.sel = sel; this.seed = seed;
    this.mode = typeof sel === 'string' && sel.startsWith('mini:') ? sel.slice(5) : 'coop';
    this.level = level || (this.mode === 'coop' ? Levels.get(+sel) : Levels.arena(this.mode, seed));
    this.world = Levels.parse(this.level);
    this.players = new Map(); this.t = 0; this.finished = false; this.result = null;
    this.dt = { A: 0, B: 0, C: 0 }; this.open = { A: false, B: false, C: false };
    this.taken = []; this.dyn = []; this.dynId = 1000; this.spawnT = 0; this.events = [];
    this.cpK = null; this.exitT = 0; this.order = []; this.endAt = null;
    this.lavaY = this.world.h * T; this.rnd = Levels.rng(seed || 1);
    const sp = this.world.spawn; this.spawn = { x: sp.x * T + 16, y: (sp.y + 1) * T };
    this.spots = [];
    for (let y = 1; y < this.world.h; y++) for (let x = 0; x < this.world.w; x++) if (this.world.at(x, y) === '#' && this.world.at(x, y - 1) === '.') this.spots.push({ x: x * T + 16, y: (y - 1) * T + 16 });
  }
  get rt() { return Math.max(0, this.t - COUNTDOWN); }
  addPlayer(p) {
    const i = this.players.size, cp = this.cpK ? { x: this.cpK.x * T + 16, y: (this.cpK.y + 1) * T } : this.spawn;
    p.g = { x: cp.x + ((i % 4) - 1.5) * 8, y: cp.y, vx: 0, vy: 0, f: 1, dead: false, out: false, rs: 0, coins: 0, score: 0, deaths: 0, done: false, ft: null, surv: 0, cp, last: Date.now(), cpx: 0 };
    this.players.set(p.id, p);
  }
  removePlayer(p) { this.players.delete(p.id); p.g = null; }
  input(p, m) {
    const g = p.g; if (!g || g.dead || g.out || this.t < COUNTDOWN || this.finished) return;
    const x = +m.x, y = +m.y; if (!isFinite(x) || !isFinite(y)) return;
    const now = Date.now(), el = Math.min(0.5, Math.max(0.01, (now - g.last) / 1000));
    if (Math.hypot(x - g.x, y - g.y) > 1100 * el + 60) { p.send({ t: 'fix', x: g.x, y: g.y }); g.last = now; return; }
    g.last = now; g.x = Math.max(0, Math.min(this.world.w * T, x)); g.y = Math.max(-200, Math.min(this.world.h * T + 300, y));
    g.vx = +m.vx || 0; g.vy = +m.vy || 0; g.f = m.f < 0 ? -1 : 1;
  }
  unstick(p) { const g = p.g; if (g && !g.out && !this.finished && this.t >= COUNTDOWN) this.respawn(p); }
  rect(g) { return { l: g.x - PW / 2 + 3, r: g.x + PW / 2 - 3, t: g.y - PH + 3, b: g.y - 1 }; }
  hitTile(g, tx, ty, ox, oy, ow, oh) { const r = this.rect(g); return r.r > tx * T + ox && r.l < tx * T + ox + ow && r.b > ty * T + oy && r.t < ty * T + oy + oh; }
  hazard(g) {
    const w = this.world, r = this.rect(g);
    for (let ty = Math.floor(r.t / T); ty <= Math.floor(r.b / T); ty++) for (let tx = Math.floor(r.l / T); tx <= Math.floor(r.r / T); tx++)
      if (w.at(tx, ty) === '^' && this.hitTile(g, tx, ty, 6, 14, 20, 18)) return true;
    return g.y > w.h * T + 60;
  }
  kill(p) {
    const g = p.g; g.dead = true; g.deaths++; this.events.push({ e: 'die', id: p.id, x: g.x, y: g.y });
    if (this.mode === 'lava') { g.out = true; g.surv = Math.round(this.rt * 10) / 10; } else g.rs = 0.9;
  }
  respawn(p) {
    const g = p.g, cp = this.mode === 'race' ? g.cp : (this.cpK ? { x: this.cpK.x * T + 16, y: (this.cpK.y + 1) * T } : this.spawn);
    g.x = cp.x; g.y = cp.y; g.vx = g.vy = 0; g.dead = false; g.last = Date.now();
    p.send({ t: 'respawn', x: g.x, y: g.y }); this.events.push({ e: 'spawn', id: p.id, x: g.x, y: g.y });
  }
  tick(dt) {
    this.t += dt; if (this.finished || this.t < COUNTDOWN) return;
    const ps = [...this.players.values()], alive = ps.filter(p => !p.g.dead && !p.g.out), rt = this.rt, w = this.world;
    for (const p of ps) {
      const g = p.g;
      if (g.out) continue;
      if (g.dead) { if ((g.rs -= dt) <= 0) this.respawn(p); continue; }
      if (this.mode === 'lava' && g.y > this.lavaY + 6) { this.kill(p); continue; }
      if (this.hazard(g)) this.kill(p);
    }
    const live = ps.filter(p => !p.g.dead && !p.g.out);
    // nút & cửa
    const pressed = {};
    for (const b of w.buttons) for (const p of live) if (this.hitTile(p.g, b.x, b.y, 4, 18, 24, 14)) pressed[b.id] = true;
    for (const L of ['A', 'B', 'C']) {
      if (pressed[L]) this.dt[L] = 2.5; else this.dt[L] = Math.max(0, this.dt[L] - dt);
      if (this.dt[L] <= 0 && this.open[L] && w.doors.some(d => d.id === L && live.some(p => this.hitTile(p.g, d.x, d.y, 0, 0, T, T)))) this.dt[L] = 0.2;
      const o = this.dt[L] > 0; if (o !== this.open[L]) { this.open[L] = o; this.events.push({ e: o ? 'dopen' : 'dclose', L }); }
    }
    // checkpoint
    for (const k of w.checks) for (const p of live) if (this.hitTile(p.g, k.x, k.y, 0, 0, T, T)) {
      if (this.mode === 'race') { if (p.g.cp.x < k.x * T) { p.g.cp = { x: k.x * T + 16, y: (k.y + 1) * T }; this.events.push({ e: 'cp', id: p.id }); } }
      else if (!this.cpK || k.x > this.cpK.x) { this.cpK = k; this.events.push({ e: 'cp' }); }
    }
    // xu cố định
    for (const c of w.coins) if (!this.taken.includes(c.id)) for (const p of live) if (Math.hypot(p.g.x - c.x, p.g.y - PH / 2 - c.y) < 26) {
      this.taken.push(c.id); p.g.coins++; p.g.score++; this.events.push({ e: 'coin', id: p.id, x: c.x, y: c.y, v: 1 }); break;
    }
    // mini-game
    if (this.mode === 'coinrush') {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.dyn.length < 14 && this.spots.length) {
        this.spawnT = 0.7; const s = this.spots[Math.floor(this.rnd() * this.spots.length)], gold = this.rnd() < 0.15;
        this.dyn.push({ id: this.dynId++, x: s.x, y: s.y, v: gold ? 3 : 1 });
      }
      this.dyn = this.dyn.filter(c => {
        for (const p of live) if (Math.hypot(p.g.x - c.x, p.g.y - PH / 2 - c.y) < 26) { p.g.coins += c.v; p.g.score += c.v; this.events.push({ e: 'coin', id: p.id, x: c.x, y: c.y, v: c.v }); return false; }
        return true;
      });
      if (rt >= MINI.coinrush) return this.finish();
    } else if (this.mode === 'lava') {
      this.lavaY -= (16 + rt * 0.4) * dt;
      if (ps.length && ps.every(p => p.g.out)) return this.finish();
      if (rt >= MINI.lava) { for (const p of ps) if (!p.g.out) p.g.surv = Math.round(rt * 10) / 10; return this.finish(); }
    }
    // cổng đích
    const ex = w.exit, inExit = p => ex && p.g.x > (ex.x - 1) * T && p.g.x < (ex.x + 2) * T && p.g.y > (ex.y - 1) * T && p.g.y <= (ex.y + 1) * T + 4;
    if (this.mode === 'coop') {
      if (ps.length && ps.every(p => !p.g.dead && inExit(p))) { this.exitT += dt; if (this.exitT >= 0.6) return this.finish(); } else this.exitT = 0;
    } else if (this.mode === 'race') {
      for (const p of live) if (!p.g.done && inExit(p)) { p.g.done = true; p.g.ft = Math.round(rt * 100) / 100; this.order.push(p.id); this.events.push({ e: 'fin', id: p.id }); if (this.endAt === null) this.endAt = rt + 15; }
      if ((ps.length && ps.every(p => p.g.done)) || (this.endAt !== null && rt >= this.endAt) || rt >= MINI.race) return this.finish();
    }
  }
  snapshot() {
    const ps = [...this.players.values()], ev = this.events; this.events = [];
    return { t: 'state', cd: Math.max(0, COUNTDOWN - this.t), time: Math.round(this.rt * 10) / 10,
      p: ps.map(p => [p.id, Math.round(p.g.x * 10) / 10, Math.round(p.g.y * 10) / 10, Math.round(p.g.vx), Math.round(p.g.vy), p.g.f, p.g.dead ? 1 : 0, p.g.score, p.g.out ? 1 : 0, p.g.done ? 1 : 0]),
      d: (this.open.A ? 1 : 0) | (this.open.B ? 2 : 0) | (this.open.C ? 4 : 0), tk: this.taken, dc: this.dyn.map(c => [c.id, c.x, c.y, c.v]),
      lava: this.mode === 'lava' ? Math.round(this.lavaY) : null, ev, left: this.mode === 'coinrush' ? Math.max(0, Math.round(MINI.coinrush - this.rt)) : null };
  }
  finish() {
    if (this.finished) return; this.finished = true;
    const rt = Math.round(this.rt * 100) / 100, ps = [...this.players.values()], PTS = [100, 70, 50, 35, 25, 15, 10, 5];
    let rows, stars = 0, ok = true;
    if (this.mode === 'coop') {
      const par = this.level.par; stars = rt <= par ? 3 : rt <= par * 1.6 ? 2 : 1;
      rows = ps.map(p => ({ id: p.id, name: p.name, ci: p.ci, coins: p.g.coins, deaths: p.g.deaths, pts: 100 + stars * 100 + p.g.coins * 10 }));
    } else {
      const key = p => this.mode === 'lava' ? p.g.surv : this.mode === 'coinrush' ? p.g.score : (p.g.done ? 1e6 - p.g.ft : p.g.x);
      const sorted = ps.slice().sort((a, b) => key(b) - key(a));
      rows = sorted.map((p, i) => ({ id: p.id, name: p.name, ci: p.ci, coins: p.g.coins, deaths: p.g.deaths, rank: i + 1, value: this.mode === 'lava' ? p.g.surv : this.mode === 'coinrush' ? p.g.score : (p.g.done ? p.g.ft : null), pts: PTS[i] + (this.mode === 'coinrush' ? p.g.score * 2 : this.mode === 'lava' ? Math.round(p.g.surv) : 0) }));
    }
    this.result = { t: 'result', mode: this.mode, sel: this.sel, name: this.level.name, ok, time: rt, par: this.level.par, stars, rows };
    this.events.push({ e: 'win' });
  }
}
module.exports = { GameEngine, MINI, COUNTDOWN };
