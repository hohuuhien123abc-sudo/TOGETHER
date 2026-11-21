/* TOGETHER! - menu.js : menu chính, phòng công khai, đăng nhập, BXH, trình tạo bản đồ */
const $ = s => document.querySelector(s), COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ff922b', '#38d9a9', '#f783ac'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
'TOGETHER!'.split('').forEach((c, i) => { const s = document.createElement('span'); s.textContent = c; s.style.color = COLORS[i % 8]; s.style.animationDelay = i * 0.12 + 's'; $('#logo').appendChild(s); });
for (let i = 0; i < 8; i++) { const im = document.createElement('img'); im.src = 'assets/characters/char_' + i + '.svg'; im.style.left = (4 + i * 12.5) + '%'; im.style[i % 2 ? 'top' : 'bottom'] = '4%'; im.style.animationDelay = i * 0.4 + 's'; $('#floaters').appendChild(im); }
const nick = $('#nick'); nick.value = localStorage.getItem('together_name') || '';
const nm = () => { const v = nick.value.trim(); localStorage.setItem('together_name', v); return v; };
const go = q => { q.name = nm(); location.href = 'game.html?' + new URLSearchParams(q); };
function refreshWho() { $('#who').textContent = Auth.name ? '👤 ' + Auth.name : 'Khách'; $('#b-auth').textContent = Auth.name ? 'Đăng xuất' : 'Đăng nhập'; if (Auth.name) nick.value = Auth.name, nick.disabled = true; else nick.disabled = false; }
refreshWho();
const modal = html => { $('#mbox').innerHTML = html; $('#modal').classList.remove('hidden'); };
const closeModal = () => { $('#modal').classList.add('hidden'); clearInterval(window._poll); };
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal') closeModal(); });

$('#b-quick').onclick = () => go({ action: 'quick' });
$('#b-solo').onclick = () => go({ action: 'solo' });
$('#b-create').onclick = () => { modal('<h2>🏠 Tạo phòng</h2><div class="row"><label><input type="checkbox" id="pubchk"> Công khai (ai cũng thấy trong danh sách)</label></div><div class="row"><button class="g" id="ok">Tạo phòng</button><button class="w" onclick="closeModal()">Hủy</button></div>'); $('#ok').onclick = () => go({ action: 'create', pub: $('#pubchk').checked ? 1 : '' }); };
$('#b-join').onclick = () => { modal('<h2>🔑 Nhập mã phòng</h2><div class="row"><input id="code" maxlength="4" placeholder="ABCD" style="font-size:2rem;text-align:center;text-transform:uppercase;letter-spacing:6px"></div><div class="row"><button class="g" id="ok">Vào phòng</button><button class="w" onclick="closeModal()">Hủy</button></div>'); const c = $('#code'); c.focus(); const j = () => c.value.trim().length === 4 && go({ action: 'join', code: c.value.trim().toUpperCase() }); $('#ok').onclick = j; c.onkeydown = e => { if (e.key === 'Enter') j(); }; };
$('#b-public').onclick = () => {
  modal('<h2>🌍 Phòng công khai</h2><div id="rl" class="muted">Đang tải…</div><div class="row"><button class="w" onclick="closeModal()">Đóng</button></div>');
  const load = async () => { try { const r = await api('rooms'); $('#rl').innerHTML = r.length ? '<table>' + r.map(x => `<tr><td><b>${x.code}</b></td><td>${x.count}/${x.max} người</td><td>${x.state === 'lobby' ? 'Đang chờ' : 'Đang chơi'}</td><td>${esc(x.host || '')}</td><td><button class="s g" data-c="${x.code}">Vào</button></td></tr>`).join('') + '</table>' : 'Chưa có phòng công khai nào. Hãy tạo phòng đầu tiên!'; document.querySelectorAll('[data-c]').forEach(b => b.onclick = () => go({ action: 'join', code: b.dataset.c })); } catch (e) { /* bỏ qua */ } };
  load(); window._poll = setInterval(load, 2500);
};
$('#b-help').onclick = () => modal(`<h2>❓ Cách chơi</h2><p>🎯 Mục tiêu: <b>tất cả</b> người chơi phải cùng đứng ở cổng đích 🌀.</p><p>⌨️ <b>A/D</b> hoặc <b>←/→</b> di chuyển • <b>Space/W/↑</b> nhảy (giữ để nhảy cao) • <b>R</b> hồi sinh nếu kẹt • <b>1-6</b> biểu cảm • <b>Enter</b> chat • <b>M</b> tắt tiếng</p><p>🔘 Giẫm lên <b>nút</b> để mở <b>cửa</b> cùng màu – cửa đóng lại sau vài giây!</p><p>🧍 Nhảy lên đầu đồng đội để lên chỗ cao.</p><p>⚠️ Gai và hố sẽ đưa bạn về checkpoint 🚩.</p><p>🎲 Mini-game: Săn xu, Dung nham dâng, Đua tốc độ.</p><div class="row"><button onclick="closeModal()">Đã hiểu</button></div>`);

/* tài khoản */
$('#b-auth').onclick = async () => {
  if (Auth.name) { try { await api('logout', 'POST'); } catch (e) { /* */ } Auth.clear(); nick.value = ''; return refreshWho(); }
  modal('<h2>👤 Tài khoản</h2><p class="muted">Đăng nhập để lưu tiến trình, mở khóa màn chơi, lên bảng xếp hạng và lưu bản đồ.</p><div class="row"><input id="u" maxlength="14" placeholder="Tên tài khoản" autocomplete="username"></div><div class="row"><input id="p" type="password" placeholder="Mật khẩu" autocomplete="current-password"></div><div class="err" id="e"></div><div class="row"><button class="g" id="li">Đăng nhập</button><button class="y" id="rg">Đăng ký</button><button class="w" onclick="closeModal()">Hủy</button></div>');
  const run = kind => async () => { try { const r = await api(kind, 'POST', { name: $('#u').value, pass: $('#p').value }); Auth.set(r.token, r.name); closeModal(); refreshWho(); } catch (e) { $('#e').textContent = e.message; } };
  setTimeout(() => $('#u').focus(), 50); $('#li').onclick = run('login'); $('#rg').onclick = run('register'); $('#p').onkeydown = e => { if (e.key === 'Enter') run('login')(); };
};

/* bảng xếp hạng */
$('#b-lb').onclick = () => {
  const T = [['score', '⭐ Điểm'], ['stars', '🌟 Sao'], ['levels', '🗺 Màn'], ['mini_coinrush', '🪙 Săn xu'], ['mini_lava', '🌋 Dung nham'], ['mini_race', '🏁 Đua'], ['level', '⏱ Tốc độ màn…']];
  modal('<h2>🏆 Bảng xếp hạng</h2><div class="tabs" id="tb">' + T.map(t => `<button data-t="${t[0]}">${t[1]}</button>`).join('') + '</div><div class="row" id="lvr" style="display:none"><input id="lvn" type="number" min="1" max="120" value="1" style="max-width:100px"> <span class="muted">Màn số (thời gian nhanh nhất)</span></div><div id="lbt">…</div><div class="row"><button class="w" onclick="closeModal()">Đóng</button></div>');
  const show = async t => {
    document.querySelectorAll('#tb button').forEach(b => b.classList.toggle('on', b.dataset.t === t)); $('#lvr').style.display = t === 'level' ? 'flex' : 'none';
    const type = t === 'level' ? 'level_' + (+$('#lvn').value || 1) : t;
    try { const r = await api('leaderboard?type=' + type); const fmt = v => t === 'level' ? v.toFixed(1) + ' giây' : Math.round(v); $('#lbt').innerHTML = r.length ? '<table>' + r.map((x, i) => `<tr><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td>${esc(x.name)}</td><td>${fmt(x.value)}</td><td class="muted">${esc(x.extra || '')}</td></tr>`).join('') + '</table>' : '<p class="muted">Chưa có dữ liệu – hãy là người đầu tiên!</p>'; } catch (e) { $('#lbt').textContent = e.message; }
  };
  document.querySelectorAll('#tb button').forEach(b => b.onclick = () => show(b.dataset.t)); $('#lvn').onchange = () => show('level'); show('score');
};

/* ========== Trình tạo bản đồ ========== */
const TOOLS = [['#', '🟫', 'Đất'], ['^', '🔺', 'Gai'], ['S', '🟢', 'Xuất phát'], ['E', '🌀', 'Đích'], ['o', '🪙', 'Xu'], ['K', '🚩', 'Checkpoint'], ['1', '🔴', 'Nút đỏ→cửa A'], ['2', '🔵', 'Nút xanh→cửa B'], ['A', '🟥', 'Cửa A'], ['B', '🟦', 'Cửa B'], ['.', '🧽', 'Xóa']];
const ed = { w: 60, h: 20, g: [], tool: '#', down: false, id: null };
const ecv = $('#ed-cv'), ectx = ecv.getContext('2d'), CS = 24;
function edNew(w, h) { ed.w = w; ed.h = h; ed.g = Array.from({ length: h }, () => new Array(w).fill('.')); for (let x = 0; x < w; x++) for (let y = h - 4; y < h; y++) ed.g[y][x] = '#'; ed.g[h - 5][2] = 'S'; ed.g[h - 5][w - 4] = 'E'; edDraw(); }
function edDraw() {
  ecv.width = ed.w * CS; ecv.height = ed.h * CS; ectx.fillStyle = '#bfe8ff'; ectx.fillRect(0, 0, ecv.width, ecv.height); ectx.font = (CS - 6) + 'px serif'; ectx.textAlign = 'center'; ectx.textBaseline = 'middle';
  const em = Object.fromEntries(TOOLS.map(t => [t[0], t[1]]));
  for (let y = 0; y < ed.h; y++) for (let x = 0; x < ed.w; x++) { const c = ed.g[y][x]; if (c === '#') { ectx.fillStyle = y > 0 && ed.g[y - 1][x] === '#' ? '#9b6a43' : '#74d65b'; ectx.fillRect(x * CS, y * CS, CS, CS); } else if (c !== '.') ectx.fillText(em[c] || c, x * CS + CS / 2, y * CS + CS / 2 + 1); }
  ectx.strokeStyle = '#0001'; ectx.beginPath(); for (let x = 0; x <= ed.w; x++) { ectx.moveTo(x * CS, 0); ectx.lineTo(x * CS, ecv.height); } for (let y = 0; y <= ed.h; y++) { ectx.moveTo(0, y * CS); ectx.lineTo(ecv.width, y * CS); } ectx.stroke();
}
function paint(e) {
  const r = ecv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) / CS), y = Math.floor((e.clientY - r.top) / CS); if (x < 0 || y < 0 || x >= ed.w || y >= ed.h) return;
  let t = e.buttons & 2 ? '.' : ed.tool;
  if (t === 'S' || t === 'E') for (const row of ed.g) for (let i = 0; i < row.length; i++) if (row[i] === t) row[i] = '.';
  ed.g[y][x] = t; edDraw();
}
ecv.onmousedown = e => { ed.down = true; paint(e); }; ecv.onmousemove = e => { if (ed.down) paint(e); }; window.addEventListener('mouseup', () => ed.down = false); ecv.oncontextmenu = e => e.preventDefault();
const tiles = () => ed.g.map(r => r.join(''));
function edTools() {
  $('#ed-tools').innerHTML = TOOLS.map(t => `<button class="tool${t[0] === ed.tool ? ' on' : ''}" data-k="${t[0]}" title="${t[2]}">${t[1]}</button>`).join('') +
    ' <span class="muted" id="tn">' + TOOLS.find(t => t[0] === ed.tool)[2] + '</span> <button class="s w" id="e-size">📐 Kích thước</button><button class="s w" id="e-imp">📥 Nhập từ màn…</button><button class="s w" id="e-my">📂 Bản đồ của tôi</button><button class="s g" id="e-save">💾 Lưu</button><button class="s y" id="e-test">▶ Lưu & chơi thử</button><button class="s r" id="e-close">✖ Thoát</button> <span class="err" id="e-msg"></span>';
  document.querySelectorAll('.tool').forEach(b => b.onclick = () => { ed.tool = b.dataset.k; edTools(); });
  $('#e-close').onclick = () => $('#editor').classList.add('hidden');
  $('#e-size').onclick = () => { const w = +prompt('Chiều rộng (20-200 ô):', ed.w), h = +prompt('Chiều cao (12-40 ô):', ed.h); if (w >= 20 && w <= 200 && h >= 12 && h <= 40) { edNew(w, h); ed.id = null; } };
  $('#e-imp').onclick = () => { const n = +prompt('Nhập bố cục từ màn số (1-120):', 1); if (n >= 1 && n <= 120) { const l = Levels.get(n); ed.g = l.tiles.map(r => r.split('')); ed.w = l.tiles[0].length; ed.h = l.tiles.length; ed.id = null; edDraw(); } };
  $('#e-my').onclick = async () => { try { const ms = (await api('maps')).filter(m => !Auth.name || m.author === Auth.name); modal('<h2>📂 Bản đồ của tôi</h2>' + (ms.length ? '<table>' + ms.map(m => `<tr><td>${esc(m.name)}</td><td class="muted">${m.w}×${m.h} • ${m.plays} lượt</td><td><button class="s g" data-o="${m.id}">Mở</button> <button class="s r" data-d="${m.id}">Xóa</button></td></tr>`).join('') + '</table>' : '<p class="muted">Chưa có bản đồ nào.</p>') + '<div class="row"><button class="w" onclick="closeModal()">Đóng</button></div>'); document.querySelectorAll('[data-o]').forEach(b => b.onclick = async () => { const m = await api('maps/' + b.dataset.o); ed.g = m.tiles.map(r => r.split('')); ed.w = m.tiles[0].length; ed.h = m.tiles.length; ed.id = m.id; edDraw(); closeModal(); }); document.querySelectorAll('[data-d]').forEach(b => b.onclick = async () => { await api('maps/' + b.dataset.d, 'DELETE'); $('#e-my').click(); }); } catch (e) { $('#e-msg').textContent = e.message; } };
  const save = async () => { const msg = $('#e-msg'); const err = Levels.validate(tiles()); if (err) { msg.textContent = err; return null; } if (!Auth.name) { msg.textContent = 'Hãy đăng nhập ở menu chính để lưu bản đồ'; return null; } const name = prompt('Tên bản đồ:', 'Bản đồ của ' + Auth.name); if (name === null) return null; const pub = confirm('Công khai bản đồ cho mọi người cùng chơi?\n(OK = công khai, Hủy = chỉ mình tôi)'); try { const r = await api('maps', 'POST', { name, tiles: tiles(), pub }); msg.textContent = '✔ Đã lưu! (mã bản đồ ' + r.id + ')'; ed.id = r.id; return r.id; } catch (e) { msg.textContent = e.message; return null; } };
  $('#e-save').onclick = save; $('#e-test').onclick = async () => { const id = await save(); if (id) go({ action: 'solo', sel: 'map:' + id, autostart: 1 }); };
}
$('#b-edit').onclick = () => { $('#editor').classList.remove('hidden'); if (!ed.g.length) edNew(60, 20); edTools(); edDraw(); };
