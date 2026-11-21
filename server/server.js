/* TOGETHER! - server.js : HTTP tĩnh + REST API (tài khoản, BXH, bản đồ) + WebSocket phòng chơi */
const http = require('http'), fs = require('fs'), path = require('path');
const db = require('./db'), ws = require('./ws'), Levels = require('../public/js/levels.js');
const { Player } = require('./player'), { RoomManager, MAXP } = require('./rooms');
const PUBLIC = path.join(__dirname, '..', 'public'), mgr = new RoomManager();
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.wav': 'audio/wav', '.json': 'application/json', '.ico': 'image/x-icon' };

const json = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
function body(req) { return new Promise(r => { let s = ''; req.on('data', d => { s += d; if (s.length > 300000) req.destroy(); }); req.on('end', () => { try { r(JSON.parse(s || '{}')); } catch (e) { r({}); } }); }); }
const tokenOf = req => (req.headers.authorization || '').replace(/^Bearer /, '');
const userOf = req => db.auth(tokenOf(req));
const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

async function api(req, res, url) {
  const p = url.pathname, m = req.method;
  if (p === '/api/health') return json(res, 200, { ok: true, rooms: mgr.rooms.size });
  if (p === '/api/rooms') return json(res, 200, mgr.listPublic());
  if (p === '/api/register' && m === 'POST') { const b = await body(req), r = db.register(b.name, b.pass); return json(res, r.error ? 400 : 200, r); }
  if (p === '/api/login' && m === 'POST') { const b = await body(req), r = db.login(b.name, b.pass); return json(res, r.error ? 401 : 200, r); }
  if (p === '/api/logout' && m === 'POST') { db.logout(tokenOf(req)); return json(res, 200, { ok: true }); }
  if (p === '/api/me') { const u = userOf(req); return u ? json(res, 200, db.me(u)) : json(res, 401, { error: 'Chưa đăng nhập' }); }
  if (p === '/api/leaderboard') return json(res, 200, db.leaderboard(url.searchParams.get('type') || 'score'));
  if (p === '/api/maps' && m === 'GET') return json(res, 200, db.listMaps(userOf(req)));
  if (p === '/api/maps' && m === 'POST') {
    const u = userOf(req); if (!u) return json(res, 401, { error: 'Cần đăng nhập để lưu bản đồ' });
    const b = await body(req), err = Levels.validate(b.tiles); if (err) return json(res, 400, { error: err });
    const mp = db.addMap(u, clean(b.name, 30) || 'Bản đồ của tôi', b.tiles, b.pub); return json(res, 200, { id: mp.id });
  }
  let mm = p.match(/^\/api\/maps\/(\d+)$/);
  if (mm) {
    const mp = db.getMap(mm[1]), u = userOf(req);
    if (m === 'DELETE') return u && db.delMap(u, mm[1]) ? json(res, 200, { ok: true }) : json(res, 403, { error: 'Không thể xóa' });
    if (!mp || (!mp.pub && (!u || u.name !== mp.author))) return json(res, 404, { error: 'Không tìm thấy' });
    return json(res, 200, mp);
  }
  json(res, 404, { error: 'Không tìm thấy API' });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname); if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (e, data) => {
    if (e) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) api(req, res, url).catch(e => { console.error(e); json(res, 500, { error: 'Lỗi máy chủ' }); });
  else serveStatic(req, res, url);
});

server.on('upgrade', (req, socket) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') return socket.destroy();
  const sock = ws.accept(req, socket); if (!sock) return;
  let player = null;
  sock.on('message', s => {
    let m; try { m = JSON.parse(s); } catch (e) { return; }
    if (!player) {
      if (m.t !== 'join') return;
      const user = m.token ? db.auth(m.token) : null;
      const name = user ? user.name : (clean(m.name, 14) || 'Khách' + Math.floor(Math.random() * 900 + 100));
      let room;
      if (m.action === 'join') { room = mgr.get(m.code); if (!room) return sock.send(JSON.stringify({ t: 'err', fatal: 1, m: 'Không tìm thấy phòng ' + clean(m.code, 6) })); if (room.players.size >= MAXP) return sock.send(JSON.stringify({ t: 'err', fatal: 1, m: 'Phòng đã đầy (8/8)' })); }
      else if (m.action === 'quick') room = mgr.quick();
      else room = mgr.create(m.action === 'create' && m.pub);
      player = new Player(sock, name, user);
      room.add(player);
      if (m.sel && room.hostId === player.id) { const sl = room.validSel(m.sel); if (sl !== null) room.sel = sl; }
      player.send({ t: 'joined', id: player.id, code: room.code, solo: m.action === 'solo' });
      room.broadcastInfo();
      if (m.action === 'solo' && m.autostart) room.start();
      return;
    }
    if (player.room) player.room.handle(player, m);
  });
  sock.on('close', () => { if (player && player.room) player.room.remove(player); });
});

if (require.main === module) {
  const PORT = +process.env.PORT || 3000;
  server.listen(PORT, () => console.log('TOGETHER! đang chạy tại http://localhost:' + PORT));
}
module.exports = { server, mgr };
