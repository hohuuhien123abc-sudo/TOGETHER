/* TOGETHER! - db.js : lưu trữ JSON đơn giản (tài khoản, tiến trình, bản đồ, bảng xếp hạng) */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const FILE = process.env.TOGETHER_DB || path.join(__dirname, '..', 'data', 'db.json');
let db = { users: {}, tokens: {}, maps: [], nextMap: 1 };
try { db = Object.assign(db, JSON.parse(fs.readFileSync(FILE, 'utf8'))); } catch (e) { /* db mới */ }
let timer = null, dirty = false;
function flush() { timer = null; if (!dirty) return; dirty = false; fs.mkdirSync(path.dirname(FILE), { recursive: true }); const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, FILE); }
function save() { dirty = true; if (!timer) { timer = setTimeout(flush, 400); timer.unref && timer.unref(); } }
process.on('exit', flush);

const NAME_RE = /^[\p{L}\p{N}_]{3,14}$/u;
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const newProgress = () => ({ unlocked: 1, best: {}, coins: 0, mini: {}, wins: 0 });

function register(name, pass) {
  name = String(name || '').trim(); pass = String(pass || '');
  if (!NAME_RE.test(name)) return { error: 'Tên 3-14 ký tự (chữ, số, gạch dưới)' };
  if (pass.length < 4 || pass.length > 64) return { error: 'Mật khẩu 4-64 ký tự' };
  const key = name.toLowerCase();
  if (db.users[key]) return { error: 'Tên đã được dùng' };
  const salt = crypto.randomBytes(12).toString('hex');
  db.users[key] = { name, salt, hash: hash(pass, salt), created: Date.now(), progress: newProgress() };
  save(); return { token: token(key), name };
}
function login(name, pass) {
  const u = db.users[String(name || '').trim().toLowerCase()];
  if (!u || !crypto.timingSafeEqual(Buffer.from(u.hash, 'hex'), Buffer.from(hash(String(pass || ''), u.salt), 'hex'))) return { error: 'Sai tên hoặc mật khẩu' };
  return { token: token(u.name.toLowerCase()), name: u.name };
}
function token(key) { const t = crypto.randomBytes(24).toString('hex'); db.tokens[t] = key; save(); return t; }
function auth(t) { const k = db.tokens[t]; return k && db.users[k] ? db.users[k] : null; }
function logout(t) { delete db.tokens[t]; save(); }
const progress = u => u.progress;
function stars(p) { return Object.values(p.best).reduce((s, b) => s + (b.stars || 0), 0); }
function score(p) { return Object.values(p.best).reduce((s, b) => s + (b.score || 0), 0) + Object.values(p.mini).reduce((s, v) => s + v, 0); }
function me(u) { const p = u.progress; return { name: u.name, unlocked: p.unlocked, best: p.best, coins: p.coins, mini: p.mini, stars: stars(p), score: score(p) }; }

function recordLevel(u, level, time, starCount, coins, pts) {
  const p = u.progress, b = p.best[level];
  if (!b) p.best[level] = { time, stars: starCount, score: pts };
  else { if (time < b.time) b.time = time; b.stars = Math.max(b.stars, starCount); b.score = Math.max(b.score, pts); }
  p.unlocked = Math.max(p.unlocked, Math.min(120, level + 1)); p.coins += coins; p.wins++; save();
}
function recordMini(u, kind, value) { const p = u.progress; if (value > (p.mini[kind] || 0)) p.mini[kind] = value; p.wins++; save(); }

function leaderboard(type) {
  const us = Object.values(db.users); let rows;
  if (type === 'stars') rows = us.map(u => ({ name: u.name, value: stars(u.progress), extra: u.progress.unlocked - 1 + ' màn' }));
  else if (type === 'levels') rows = us.map(u => ({ name: u.name, value: u.progress.unlocked - 1, extra: stars(u.progress) + ' sao' }));
  else if (/^mini_(coinrush|lava|race)$/.test(type)) { const k = type.slice(5); rows = us.filter(u => u.progress.mini[k]).map(u => ({ name: u.name, value: u.progress.mini[k] })); }
  else if (/^level_\d+$/.test(type)) { const n = type.slice(6); rows = us.filter(u => u.progress.best[n]).map(u => ({ name: u.name, value: u.progress.best[n].time, extra: u.progress.best[n].stars + ' sao' })); return rows.sort((a, b) => a.value - b.value).slice(0, 20); }
  else rows = us.map(u => ({ name: u.name, value: score(u.progress), extra: stars(u.progress) + ' sao' }));
  return rows.filter(r => r.value > 0).sort((a, b) => b.value - a.value).slice(0, 20);
}

function addMap(u, name, tiles, pub) {
  name = String(name || 'Bản đồ không tên').slice(0, 30);
  const m = { id: db.nextMap++, name, author: u.name, tiles, pub: !!pub, created: Date.now(), plays: 0 };
  db.maps.push(m); if (db.maps.length > 5000) db.maps.shift(); save(); return m;
}
const getMap = id => db.maps.find(m => m.id === +id);
function listMaps(u) { return db.maps.filter(m => m.pub || (u && m.author === u.name)).slice(-60).reverse().map(m => ({ id: m.id, name: m.name, author: m.author, pub: m.pub, plays: m.plays, w: m.tiles[0].length, h: m.tiles.length })); }
function delMap(u, id) { const i = db.maps.findIndex(m => m.id === +id && m.author === u.name); if (i < 0) return false; db.maps.splice(i, 1); save(); return true; }

module.exports = { register, login, auth, logout, progress, me, recordLevel, recordMini, leaderboard, addMap, getMap, listMaps, delMap, flush };
