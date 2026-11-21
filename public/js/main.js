/* TOGETHER! - main.js : phòng chờ, vòng lặp game, render 2D hoạt hình, hiệu ứng, HUD */
const $ = s => document.querySelector(s), Q = new URLSearchParams(location.search), T = 32;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const Sound = { on: true, cache: {}, play(n, v) { if (!this.on) return; try { const a = this.cache[n] || (this.cache[n] = new Audio('assets/sounds/' + n + '.wav')), b = a.cloneNode(); b.volume = v || 0.5; b.play().catch(() => { }); } catch (e) { /* bỏ qua */ } } };
const net = new Net(), input = new Input(), cv = $('#cv'), ctx = cv.getContext('2d');
let myId = null, room = null, G = null, prog = null;
const resize = () => { cv.width = innerWidth; cv.height = innerHeight; }; addEventListener('resize', resize); resize();

/* ===== Mạng ===== */
net.on('joined', m => { myId = m.id; })
  .on('room', m => { room = m; if (m.state === 'lobby') { G = null; $('#hud').classList.add('hidden'); $('#result').classList.add('hidden'); $('#lobby').classList.remove('hidden'); } updateLobby(); })
  .on('start', setupGame).on('state', onState).on('result', showResult)
  .on('respawn', m => { const p = G && G.pl.get(myId); if (p) { p.x = m.x; p.y = m.y; p.vx = p.vy = 0; p.dead = false; p.ground = false; } })
  .on('fix', m => { const p = G && G.pl.get(myId); if (p) { p.x = m.x; p.y = m.y; p.vx = p.vy = 0; } })
  .on('chat', m => { addChat(m); })
  .on('emote', m => { const p = G && G.pl.get(m.id); if (p) p.emote = { e: m.e, t: 2.2 }; Sound.play('emote', 0.25); })
  .on('err', m => { $('#l-err').textContent = m.m; if (G) addChat({ name: '⚠', m: m.m, ci: 0 }); if (m.fatal) { alert(m.m); location.href = 'index.html'; } })
  .on('close', () => { document.body.insertAdjacentHTML('beforeend', '<div class="modal"><div class="card" style="text-align:center"><h2>Mất kết nối với máy chủ</h2><br><button onclick="location.href=\'index.html\'">Về menu</button></div></div>'); });
const selQ = Q.get('sel'), act = Q.get('action') || 'quick';
net.connect({ action: act, code: Q.get('code'), pub: !!Q.get('pub'), name: Q.get('name'), sel: selQ && /^\d+$/.test(selQ) ? +selQ : selQ, autostart: !!Q.get('autostart') });
if (Auth.token) api('me').then(m => { prog = m; buildGrid(); if (room) updateLobby(); }).catch(() => { });

/* ===== Phòng chờ ===== */
const selLabel = s => typeof s === 'number' ? 'Màn ' + s : String(s).startsWith('mini:') ? (Puzzles.minis.find(x => 'mini:' + x.id === s) || {}).name : 'Bản đồ #' + String(s).slice(4);
function buildGrid() {
  const g = $('#lvgrid'); g.innerHTML = '';
  for (let n = 1; n <= Levels.TOTAL; n++) { const b = document.createElement('button'), st = prog && prog.best[n] ? prog.best[n].stars : 0; b.dataset.n = n; b.innerHTML = n + (st ? '<small>' + '★'.repeat(st) + '</small>' : ''); b.onclick = () => { if (!b.classList.contains('lock')) { net.send({ t: 'sel', sel: n }); Sound.play('click', 0.3); } }; g.appendChild(b); }
}
buildGrid();
$('#p-mini').innerHTML = Puzzles.minis.map(m => `<div class="row"><button class="y" data-m="${m.id}" style="min-width:190px">${m.icon} ${m.name}</button><span class="muted">${m.desc}</span></div>`).join('');
$('#p-mini').onclick = e => { const m = e.target.dataset.m; if (m) { net.send({ t: 'sel', sel: 'mini:' + m }); Sound.play('click', 0.3); } };
$('#l-tabs').onclick = async e => {
  const p = e.target.dataset.p; if (!p) return;
  document.querySelectorAll('#l-tabs button').forEach(b => b.classList.toggle('on', b === e.target)); ['camp', 'mini', 'maps'].forEach(k => $('#p-' + k).classList.toggle('hidden', k !== p));
  if (p === 'maps') { $('#p-maps').innerHTML = '<p class="muted">Đang tải…</p>'; try { const ms = await api('maps'); $('#p-maps').innerHTML = ms.length ? '<table>' + ms.map(m => `<tr><td>${esc(m.name)}</td><td class="muted">${esc(m.author)} • ${m.w}×${m.h} • ${m.plays} lượt</td><td><button class="s g" data-map="${m.id}">Chọn</button></td></tr>`).join('') + '</table>' : '<p class="muted">Chưa có bản đồ nào. Hãy tạo bản đồ ở menu chính!</p>'; } catch (x) { $('#p-maps').textContent = x.message; } }
};
$('#p-maps').onclick = e => { if (e.target.dataset.map) net.send({ t: 'sel', sel: 'map:' + e.target.dataset.map }); };
$('#l-ready').onclick = () => net.send({ t: 'ready' }); $('#l-start').onclick = () => net.send({ t: 'start' }); $('#l-leave').onclick = () => { location.href = 'index.html'; };
$('#l-pub').onchange = e => net.send({ t: 'pub', v: e.target.checked });
$('#l-code').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(room.code).then(() => { $('#l-err').textContent = 'Đã sao chép mã phòng ' + room.code; }); };
function updateLobby() {
  if (!room) return; const host = room.hostId === myId, lv = $('#lvgrid');
  $('#l-code').textContent = room.code; $('#l-count').textContent = room.players.length + '/8 người'; $('#l-pub').checked = room.pub; $('#l-pub').disabled = !host;
  $('#slots').innerHTML = Array.from({ length: 8 }, (_, i) => { const p = room.players[i]; return p ? `<div class="slot f${p.ready ? ' rd' : ''}" style="--p:${CHAR_COLORS[p.ci]}">${p.host ? '<span class="tag">👑</span>' : ''}<img src="assets/characters/char_${p.ci}.svg"><div>${esc(p.name)}${p.id === myId ? ' (bạn)' : ''}</div></div>` : '<div class="slot"><div style="opacity:.4;padding-top:36px">Trống</div></div>'; }).join('');
  $('#l-sel').textContent = '– đang chọn: ' + selLabel(room.sel);
  [...lv.children].forEach(b => { const n = +b.dataset.n; b.classList.toggle('lock', n > room.limit); b.classList.toggle('on', n === room.sel); if (n > room.limit) b.title = 'Chưa mở khóa'; });
  $('#l-lim').textContent = 'Đã mở khóa tới màn ' + room.limit + '. ' + (Auth.token ? 'Hoàn thành màn để mở thêm!' : 'Đăng nhập (menu chính) để lưu tiến trình và mở thêm màn.');
  $('#l-start').disabled = !host; $('#l-wait').textContent = host ? 'Bạn là chủ phòng 👑' : 'Chờ chủ phòng bắt đầu…';
  $('#l-ready').textContent = (room.players.find(p => p.id === myId) || {}).ready ? 'Hủy sẵn sàng' : 'Sẵn sàng';
  for (const t of ['#lvgrid', '#p-mini', '#p-maps']) $(t).style.pointerEvents = host ? '' : 'none';
}
function addChat(m) {
  const t = (m.name ? '<b style="color:' + CHAR_COLORS[m.ci % 8] + '">' + esc(m.name) + ':</b> ' : '') + esc(m.m);
  const l = $('#lchat'); l.insertAdjacentHTML('beforeend', '<div>' + t + '</div>'); l.scrollTop = l.scrollHeight;
  const g = $('#chatlog'); g.insertAdjacentHTML('beforeend', '<div>' + t + '</div>'); while (g.children.length > 6) g.firstChild.remove(); const el = g.lastChild; setTimeout(() => el.remove(), 9000);
}
$('#lchatin').onkeydown = e => { if (e.key === 'Enter' && e.target.value.trim()) { net.send({ t: 'chat', m: e.target.value }); e.target.value = ''; } };
$('#chatin').onkeydown = e => { if (e.key === 'Enter' || e.key === 'Escape') { if (e.key === 'Enter' && e.target.value.trim()) net.send({ t: 'chat', m: e.target.value }); e.target.value = ''; e.target.classList.add('hidden'); e.target.blur(); } };
input.onKey = c => {
  if (!G) return;
  if (c === 'KeyR') net.send({ t: 'unstick' }); else if (c === 'KeyM') Sound.on = !Sound.on;
  else if (c.startsWith('Digit') && +c[5] >= 1 && +c[5] <= 6) net.send({ t: 'emote', e: +c[5] - 1 });
  else if (c === 'Enter') { const i = $('#chatin'); i.classList.remove('hidden'); i.focus(); }
  else if (c === 'Escape' && confirm('Rời phòng và về menu?')) location.href = 'index.html';
};

/* ===== Khởi tạo ván chơi ===== */
function addPl(p) { const o = { id: p.id, name: p.name, ci: p.ci, x: 0, y: 0, vx: 0, vy: 0, f: 1, dead: false, rx: 0, ry: 0, tx: 0, ty: 0, score: 0, ground: false, coy: 0, buf: 0, sq: 0, t: Math.random() * 9, init: false, out: 0, done: 0, emote: null, local: p.id === myId }; G.pl.set(p.id, o); return o; }
function setupGame(m) {
  $('#lobby').classList.add('hidden'); $('#result').classList.add('hidden'); $('#hud').classList.remove('hidden'); $('#chatlog').innerHTML = '';
  const world = Levels.parse(m.level), th = Levels.THEMES[(m.level.theme || 0) % 10];
  G = { mode: m.mode, world, th, name: m.level.name, par: m.level.par, pl: new Map(), doors: { A: false, B: false, C: false }, taken: new Set(), dyn: [], time: 0, cd: 3, lava: null, t: 0, parts: [], shake: 0, cam: { x: 0, y: 0 }, camInit: false, left: null, cpOn: new Set(), over: false, lastCd: 4, goT: 0, sendT: 0, mid: new Set(), texts: [] };
  for (const p of m.players) addPl(p);
  const byX = {}; world.doors.forEach(d => (byX[d.x] = byX[d.x] || []).push(d.y)); for (const x in byX) { const a = byX[x]; G.mid.add(x + ',' + a[Math.floor(a.length / 2)]); }
  buildStatic(); $('#h-name').textContent = G.name;
}
function buildStatic() {
  const w = G.world, th = G.th, s = document.createElement('canvas'); s.width = w.w * T; s.height = w.h * T; const c = s.getContext('2d'), rnd = Levels.rng(w.w * 131 + w.h);
  const S = (x, y) => y >= 0 && y < w.h && x >= 0 && x < w.w && w.rows[y][x] === '#';
  for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
    const ch = w.rows[y][x], px = x * T, py = y * T;
    if (ch === '#') {
      c.fillStyle = th.dirt; c.fillRect(px, py, T, T);
      if (rnd() < 0.4) { c.fillStyle = '#0002'; c.beginPath(); c.arc(px + 4 + rnd() * 24, py + 4 + rnd() * 24, 2 + rnd() * 3, 0, 6.3); c.fill(); }
      c.fillStyle = '#0002'; if (!S(x - 1, y)) c.fillRect(px, py, 3, T); if (!S(x + 1, y)) c.fillRect(px + T - 3, py, 3, T); if (!S(x, y + 1)) c.fillRect(px, py + T - 4, T, 4);
      if (!S(x, y - 1)) {
        c.fillStyle = th.ground; c.beginPath(); c.roundRect(px - (S(x - 1, y) ? 0 : 1), py, T + (S(x + 1, y) ? 1 : 2), 12, [S(x - 1, y) ? 0 : 7, S(x + 1, y) ? 0 : 7, 0, 0]); c.fill();
        c.fillStyle = '#fff4'; c.fillRect(px + 3, py + 2, T - 6, 3); c.fillStyle = '#0002'; c.fillRect(px, py + 10, T, 2);
        if (rnd() < 0.5) { c.fillStyle = th.ground; const gx = px + 4 + rnd() * 22; c.beginPath(); c.moveTo(gx, py + 1); c.lineTo(gx + 3, py - 5); c.lineTo(gx + 6, py + 1); c.fill(); }
      }
    } else if (ch === '^') {
      for (let i = 0; i < 2; i++) { const bx = px + i * 16; c.fillStyle = '#ced4da'; c.strokeStyle = '#495057'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx + 1, py + 32); c.lineTo(bx + 8, py + 10); c.lineTo(bx + 15, py + 32); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#fff8'; c.beginPath(); c.moveTo(bx + 6, py + 24); c.lineTo(bx + 8, py + 15); c.lineTo(bx + 9, py + 24); c.fill(); }
    }
  }
  G.stat = s;
}

/* ===== Trạng thái từ server ===== */
function onState(m) {
  if (!G) return; G.cd = m.cd; G.time = m.time; G.lava = m.lava; G.left = m.left;
  G.doors = { A: !!(m.d & 1), B: !!(m.d & 2), C: !!(m.d & 4) }; G.taken = new Set(m.tk); G.dyn = m.dc;
  const seen = new Set();
  for (const a of m.p) {
    const id = a[0]; seen.add(id); let p = G.pl.get(id);
    if (!p) { const ri = room && room.players.find(q => q.id === id); p = addPl({ id, name: ri ? ri.name : '?', ci: ri ? ri.ci : 0 }); }
    p.dead = !!a[6]; p.score = a[7]; p.out = a[8]; p.done = a[9];
    if (p.local) { if (!p.init || G.cd > 0) { p.x = a[1]; p.y = a[2]; p.vx = p.vy = 0; p.init = true; } }
    else { p.tx = a[1]; p.ty = a[2]; p.vx = a[3]; p.vy = a[4]; p.f = a[5]; if (!p.init) { p.rx = a[1]; p.ry = a[2]; p.init = true; } }
  }
  for (const id of [...G.pl.keys()]) if (!seen.has(id)) G.pl.delete(id);
  for (const e of m.ev) {
    switch (e.e) {
      case 'die': burst(e.x, e.y - 15, '#fff', 12, 220); burst(e.x, e.y - 15, CHAR_COLORS[(G.pl.get(e.id) || {}).ci || 0], 10, 160); G.shake = Math.max(G.shake, e.id === myId ? 9 : 3); Sound.play('die', e.id === myId ? 0.5 : 0.18); break;
      case 'spawn': burst(e.x, e.y - 15, '#a5d8ff', 14, 150, 'star'); if (e.id === myId) Sound.play('respawn', 0.4); break;
      case 'coin': burst(e.x, e.y, '#ffd43b', 8, 120, 'star'); G.texts.push({ x: e.x, y: e.y, s: '+' + e.v, t: 1 }); Sound.play('coin', e.id === myId ? 0.45 : 0.15); break;
      case 'dopen': case 'dclose': Sound.play(e.e === 'dopen' ? 'button' : 'door', 0.4); break;
      case 'cp': Sound.play('checkpoint', 0.4); break;
      case 'fin': if (e.id === myId) Sound.play('win', 0.4); break;
      case 'win': for (let i = 0; i < 90; i++) G.parts.push({ x: G.cam.x + Math.random() * cv.width / zoom(), y: G.cam.y - 20, vx: (Math.random() - 0.5) * 140, vy: 40 + Math.random() * 160, life: 3 + Math.random() * 2, max: 5, size: 5 + Math.random() * 5, color: CHAR_COLORS[i % 8], type: 'conf', r: Math.random() * 6, g: 60 }); Sound.play('win', 0.5); break;
    }
  }
}
function burst(x, y, color, n, sp, type) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.3, v = sp * (0.3 + Math.random() * 0.7); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.5 + Math.random() * 0.4, max: 0.9, size: 3 + Math.random() * 4, color, type: type || 'c', g: 500, r: 0 }); } }

/* ===== Cập nhật ===== */
const zoom = () => G ? cv.height / (Math.min(G.world.h, 22) * T) : 1;
let last = performance.now();
function update(dt) {
  if (!G) return; G.t += dt;
  const c = Math.ceil(G.cd); if (G.cd > 0 && c !== G.lastCd) { G.lastCd = c; Sound.play('tick', 0.4); } if (G.cd <= 0 && G.lastCd > 0) { G.lastCd = 0; Sound.play('go', 0.4); G.goT = 0.8; }
  if (G.goT > 0) G.goT -= dt;
  const me = G.pl.get(myId), others = [...G.pl.values()].filter(p => !p.local && !p.dead && !p.out && p.init).map(p => ({ x: p.rx, y: p.ry }));
  if (me && me.init && !me.dead && !me.out && G.cd <= 0 && !G.over) {
    const inp = input.get(); let rem = dt, jp = inp.jumpPressed;
    while (rem > 0) {
      const h = Math.min(1 / 120, rem); rem -= h; inp.jumpPressed = jp; jp = false;
      for (const e of Physics.step(me, inp, h, G.world, G.doors, others)) {
        if (e === 'jump') { Sound.play('jump', 0.25); burst(me.x, me.y, '#fff', 4, 60); }
        else if (e === 'land') { me.sq = 0.12; burst(me.x, me.y, '#ffffffaa', 5, 70); }
      }
    }
    input.clear(); G.sendT -= dt;
    if (G.sendT <= 0) { G.sendT = 1 / 30; net.send({ t: 'in', x: +me.x.toFixed(1), y: +me.y.toFixed(1), vx: Math.round(me.vx), vy: Math.round(me.vy), f: me.f }); }
    if (me.ground && Math.abs(me.vx) > 150 && Math.random() < dt * 10) burst(me.x - me.f * 8, me.y - 1, '#ffffff88', 1, 30);
  } else input.clear();
  for (const p of G.pl.values()) {
    p.t += dt; if (p.sq > 0) p.sq -= dt; if (p.emote && (p.emote.t -= dt) <= 0) p.emote = null;
    if (!p.local) { const k = Math.min(1, dt * 16); p.rx += (p.tx - p.rx) * k; p.ry += (p.ty - p.ry) * k; p.ground = Math.abs(p.vy) < 40; }
  }
  for (const k of G.world.checks) for (const p of G.pl.values()) { const x = p.local ? p.x : p.rx, y = p.local ? p.y : p.ry; if (!p.dead && Math.abs(x - (k.x * T + 16)) < 22 && y > k.y * T && y <= (k.y + 1) * T + 2 && !G.cpOn.has(k.x + ',' + k.y)) { G.cpOn.add(k.x + ',' + k.y); burst(k.x * T + 20, k.y * T + 8, '#ffd43b', 10, 120, 'star'); } }
  for (const q of G.parts) { q.life -= dt; q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += dt * 6; } G.parts = G.parts.filter(q => q.life > 0);
  for (const t of G.texts) { t.t -= dt; t.y -= 40 * dt; } G.texts = G.texts.filter(t => t.t > 0);
  if (G.lava != null && Math.random() < dt * 20) G.parts.push({ x: Math.random() * G.world.w * T, y: G.lava + 4, vx: 0, vy: -60 - Math.random() * 60, life: 0.8, max: 0.8, size: 3 + Math.random() * 4, color: '#ffb347', type: 'c', g: 0, r: 0 });
  G.shake = Math.max(0, G.shake - dt * 30);
  updateCam(dt);
}
function updateCam(dt) {
  const Z = zoom(), vw = cv.width / Z, vh = cv.height / Z, w = G.world; let tx = 0, ty = 0, n = 0;
  for (const p of G.pl.values()) { if (p.dead || p.out || !p.init) continue; tx += p.local ? p.x : p.rx; ty += (p.local ? p.y : p.ry) - 20; n++; }
  const cam = G.cam; if (!n) { if (G.camInit) return; tx = G.world.spawn.x * T; ty = G.world.spawn.y * T; n = 1; }
  tx /= n; ty /= n; const me = G.pl.get(myId);
  if (me && me.init && !me.dead) { tx = Math.max(me.x - vw * 0.3, Math.min(me.x + vw * 0.3, tx)); ty = Math.max(me.y - vh * 0.25, Math.min(me.y + vh * 0.25, ty)); }
  let cx = tx - vw / 2, cy = ty - vh / 2; const W = w.w * T, H = w.h * T;
  cx = W <= vw ? (W - vw) / 2 : Math.max(0, Math.min(W - vw, cx)); cy = H <= vh ? (H - vh) / 2 : Math.max(0, Math.min(H - vh, cy));
  if (!G.camInit) { cam.x = cx; cam.y = cy; G.camInit = true; } else { const k = Math.min(1, dt * 6); cam.x += (cx - cam.x) * k; cam.y += (cy - cam.y) * k; }
}

/* ===== Vẽ ===== */
function drawSky() {
  const th = G.th, W = cv.width, H = cv.height, g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (th.dark) { ctx.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { const x = (i * 197 + 31) % W, y = (i * 83 + 17) % (H * 0.7), a = 0.4 + 0.6 * Math.abs(Math.sin(G.t * 1.5 + i)); ctx.globalAlpha = a; ctx.fillRect(x, y, 2 + i % 2, 2 + i % 2); } ctx.globalAlpha = 1; ctx.fillStyle = '#fff8'; ctx.beginPath(); ctx.arc(W * 0.8, H * 0.18, 34, 0, 6.3); ctx.fill(); }
  else { ctx.fillStyle = '#fff9'; for (let i = 0; i < 6; i++) { const x = ((i * 370 + G.t * 12 - G.cam.x * 0.1) % (W + 400) + W + 400) % (W + 400) - 200, y = 50 + (i * 67) % 160; for (const [dx, dy, r] of [[0, 0, 32], [34, 8, 26], [-34, 10, 24], [10, -14, 24]]) { ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, 6.3); ctx.fill(); } } }
  for (const [k, base, amp, a] of [[0.12, 0.62, 70, 0.55], [0.28, 0.74, 50, 0.9]]) { ctx.fillStyle = th.far; ctx.globalAlpha = a; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W + 20; x += 20) ctx.lineTo(x, H * base + Math.sin((x + G.cam.x * k) * 0.006 + k * 9) * amp + Math.sin((x + G.cam.x * k) * 0.017) * amp * 0.3); ctx.lineTo(W + 20, H); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  if (!G) { const g = ctx.createLinearGradient(0, 0, 0, cv.height); g.addColorStop(0, '#7fd1ff'); g.addColorStop(1, '#d9f4ff'); ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height); return; }
  drawSky(); const Z = zoom(), sh = G.shake, w = G.world;
  ctx.setTransform(Z, 0, 0, Z, -G.cam.x * Z + (Math.random() - 0.5) * sh, -G.cam.y * Z + (Math.random() - 0.5) * sh);
  ctx.drawImage(G.stat, 0, 0);
  for (const b of w.buttons) Puzzles.button(ctx, b, G.doors[b.id], G.t);
  for (const d of w.doors) Puzzles.door(ctx, d, G.doors[d.id], G.t, G.mid.has(d.x + ',' + d.y));
  for (const k of w.checks) Puzzles.checkpoint(ctx, k, G.cpOn.has(k.x + ',' + k.y), G.t);
  for (const c of w.coins) if (!G.taken.has(c.id)) Puzzles.coin(ctx, c.x, c.y, G.t, 1);
  for (const c of G.dyn) Puzzles.coin(ctx, c[1], c[2], G.t, c[3]);
  if (w.exit && G.mode !== 'coinrush' && G.mode !== 'lava') { const ex = w.exit; let inside = 0; for (const p of G.pl.values()) { const x = p.local ? p.x : p.rx, y = p.local ? p.y : p.ry; if (!p.dead && x > (ex.x - 1) * T && x < (ex.x + 2) * T && y > (ex.y - 1) * T && y <= (ex.y + 1) * T + 4) inside++; } Puzzles.exit(ctx, ex, G.t, inside, G.pl.size); }
  const list = [...G.pl.values()].filter(p => !p.dead && !p.out && p.init).sort((a, b) => a.local - b.local);
  for (const p of list) drawPlayer(ctx, { x: p.local ? p.x : p.rx, y: p.local ? p.y : p.ry, ci: p.ci, f: p.f, vx: p.vx, vy: p.vy, ground: p.ground, t: p.t, sq: p.sq, name: p.name, local: p.local, emote: p.emote });
  if (G.lava != null) {
    const y0 = G.lava, g = ctx.createLinearGradient(0, y0, 0, y0 + 300); g.addColorStop(0, '#ffd166'); g.addColorStop(0.15, '#ff6b35'); g.addColorStop(1, '#a4161a'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-50, w.h * T + 400);
    for (let x = -50; x <= w.w * T + 50; x += 12) ctx.lineTo(x, y0 + Math.sin(x * 0.05 + G.t * 3) * 5); ctx.lineTo(w.w * T + 50, w.h * T + 400); ctx.fill();
  }
  for (const q of G.parts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, q.life / (q.max * 0.5))); ctx.fillStyle = q.color;
    if (q.type === 'conf') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2); ctx.restore(); }
    else if (q.type === 'star') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); const s = q.size; ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.3, -s * 0.3); ctx.lineTo(s, 0); ctx.lineTo(s * 0.3, s * 0.3); ctx.lineTo(0, s); ctx.lineTo(-s * 0.3, s * 0.3); ctx.lineTo(-s, 0); ctx.lineTo(-s * 0.3, -s * 0.3); ctx.fill(); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * Math.max(0.3, q.life / q.max), 0, 6.3); ctx.fill(); }
  }
  ctx.globalAlpha = 1; ctx.font = '800 18px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#0007';
  for (const t of G.texts) { ctx.globalAlpha = Math.min(1, t.t * 2); ctx.fillStyle = '#ffd43b'; ctx.strokeText(t.s, t.x, t.y); ctx.fillText(t.s, t.x, t.y); } ctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); hud();
}
const fmt = s => Math.floor(s / 60) + ':' + (s % 60).toFixed(1).padStart(4, '0');
function hud() {
  const me = G.pl.get(myId), tot = G.world.coins.length;
  $('#h-time').textContent = G.mode === 'coinrush' ? '⏱ ' + (G.left == null ? 45 : G.left) + 's' : '⏱ ' + fmt(G.time) + (G.mode === 'coop' ? '  (mốc ' + fmt(G.par) + ')' : '');
  $('#h-coins').textContent = G.mode === 'coop' ? '🪙 ' + G.taken.size + '/' + tot : me ? '⭐ ' + me.score : '';
  const rows = [...G.pl.values()].sort((a, b) => b.score - a.score);
  $('#score').innerHTML = rows.map(p => `<span style="color:${CHAR_COLORS[p.ci]}">${p.done ? '🏁 ' : p.out ? '💀 ' : p.dead ? '😵 ' : ''}${esc(p.name)}${G.mode === 'coop' ? '' : ' – ' + p.score}</span>`).join('');
  const cd = $('#cdown'); cd.innerHTML = G.cd > 0 ? '<div style="text-align:center">' + Math.ceil(G.cd) + '<div style="font-size:1.5rem">' + Puzzles.hint(G.mode) + '</div></div>' : G.goT > 0 ? 'GO!' : (me && me.out && G.mode === 'lava' ? '<div style="font-size:2rem">💀 Bạn đã bị loại – đang xem tiếp…</div>' : '');
}
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; try { update(dt); render(); } catch (e) { console.error(e); } requestAnimationFrame(frame); }
requestAnimationFrame(frame);

/* ===== Kết quả ===== */
function showResult(r) {
  if (G) { G.over = true; } const host = room && room.hostId === myId;
  const medal = i => ['🥇', '🥈', '🥉'][i] || (i + 1) + '.';
  let h;
  if (r.mode === 'coop') h = `<h1>🎉 Hoàn thành!</h1><div class="stars">${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)}</div><p>${esc(r.name)} • ${r.time.toFixed(1)}s (mốc 3 sao: ${r.par}s)</p><table>${r.rows.map(x => `<tr><td style="color:${CHAR_COLORS[x.ci]}">${esc(x.name)}</td><td>🪙 ${x.coins}</td><td>💀 ${x.deaths}</td><td>+${x.pts}</td></tr>`).join('')}</table>`;
  else { const unit = r.mode === 'coinrush' ? ' xu' : r.mode === 'lava' ? ' giây' : ' giây'; h = `<h1>🏆 ${esc(r.name)}</h1><table>${r.rows.map((x, i) => `<tr><td>${medal(i)}</td><td style="color:${CHAR_COLORS[x.ci]}">${esc(x.name)}</td><td>${x.value == null ? 'chưa về đích' : x.value + unit}</td><td>+${x.pts}</td></tr>`).join('')}</table>`; }
  h += '<div class="row" style="justify-content:center;margin-top:14px">' + (host ? (r.next ? '<button class="g" data-a="next">▶ Màn kế tiếp</button>' : '') + '<button class="y" data-a="retry">↻ Chơi lại</button><button class="w" data-a="lobby">Về sảnh</button>' : '<span class="muted">Chờ chủ phòng chọn tiếp…</span>') + '<button class="w s" data-a="menu">Menu</button></div>';
  $('#rbox').innerHTML = h; $('#result').classList.remove('hidden');
}
$('#rbox').onclick = e => { const a = e.target.dataset.a; if (!a) return; if (a === 'menu') location.href = 'index.html'; else net.send({ t: a }); };
