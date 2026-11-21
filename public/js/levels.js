/* TOGETHER! - levels.js : sinh 120 màn chơi, đấu trường mini-game, phân tích bản đồ (dùng chung client + server) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.Levels = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TILE = 32, TOTAL = 120;
  const THEMES = [
    { name: 'Đồng cỏ vui vẻ', sky: ['#6ec6ff', '#d6f3ff'], ground: '#74d65b', dirt: '#9b6a43', acc: '#ffe066', far: '#a8e6a1', dark: false },
    { name: 'Sa mạc nắng', sky: ['#ffd27a', '#fff1c9'], ground: '#f0c36a', dirt: '#c98d45', acc: '#ff8a5c', far: '#f7b267', dark: false },
    { name: 'Băng giá', sky: ['#9fd8ff', '#eefaff'], ground: '#d9f3ff', dirt: '#7fb8d8', acc: '#5ec8ff', far: '#bfe5f7', dark: false },
    { name: 'Rừng đêm', sky: ['#2b2d6e', '#6a5acd'], ground: '#3fae6a', dirt: '#3a2f4f', acc: '#ffe96b', far: '#4a4a9a', dark: true },
    { name: 'Núi lửa', sky: ['#5a1f2e', '#ff7a45'], ground: '#6b5555', dirt: '#2d2222', acc: '#ffb347', far: '#7a2d36', dark: true },
    { name: 'Xứ kẹo ngọt', sky: ['#ffb3e6', '#fff0fa'], ground: '#ff8fcf', dirt: '#c2579a', acc: '#7affd9', far: '#ffc9ec', dark: false },
    { name: 'Đại dương', sky: ['#3aa6d9', '#aef0ff'], ground: '#f2d79a', dirt: '#c9a465', acc: '#ff7a8a', far: '#6cc3e6', dark: false },
    { name: 'Thành phố neon', sky: ['#14143a', '#3b1a6e'], ground: '#2de2e6', dirt: '#1b1b4d', acc: '#ff3df2', far: '#2a2a7a', dark: true },
    { name: 'Ngoài vũ trụ', sky: ['#05051a', '#2a1a5e'], ground: '#8a8aff', dirt: '#3a3a7a', acc: '#fff27a', far: '#1a1a55', dark: true },
    { name: 'Lâu đài mây', sky: ['#c9e7ff', '#ffffff'], ground: '#ffffff', dirt: '#b9c9e6', acc: '#ffd166', far: '#e3f1ff', dark: false }
  ];
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const themeOf = n => Math.min(THEMES.length - 1, Math.floor((n - 1) / 12));
  const blank = (w, h) => { const g = []; for (let y = 0; y < h; y++) g.push(new Array(w).fill('.')); return g; };

  function generate(n, o) {
    o = o || {};
    const r = rng(o.seed != null ? o.seed : n * 7919 + 13), d = Math.min(1, n / TOTAL);
    const w = o.w || Math.min(110, 48 + Math.floor(n * 0.5)), h = 20, g = blank(w, h);
    let gy = 14, x = 0, lastK = 0, doorCd = 2;
    const col = (cx, top) => { for (let y = top; y < h; y++) g[y][cx] = '#'; };
    const flat = len => {
      for (let i = 0; i < len && x < w - 12; i++) {
        col(x, gy);
        if (x > 8 && x - lastK >= 24 && g[gy - 1][x] === '.') { g[gy - 1][x] = 'K'; lastK = x; }
        else if (r() < 0.1) g[gy - (r() < 0.5 ? 2 : 3)][x] = 'o';
        x++;
      }
    };
    flat(6); g[gy - 1][2] = 'S';
    while (x < w - 12) {
      const t = r(); doorCd--;
      if (!o.noDoors && n >= 4 && doorCd <= 0 && t < 0.16 + 0.14 * d && x > 12 && x < w - 24) {
        flat(3); const idx = (n >= 20 && r() < 0.5) ? 1 : 0;
        g[gy - 1][x] = String(idx + 1); flat(6);
        const L = String.fromCharCode(65 + idx);
        for (let y = 1; y < gy; y++) g[y][x] = L;
        g[0][x] = '#'; col(x, gy); x++; flat(3); doorCd = 5;
      } else if (t < 0.42) {
        flat(2);
        const gw = Math.min(4, 2 + Math.floor(r() * (1.8 + 2.2 * d)));
        if (x + gw < w - 12) x += gw;
        flat(2);
      } else if (t < 0.52 && n >= 8 && x + 12 < w - 12) {
        flat(2); const L = 1 + Math.floor(r() * 2), py = gy - (r() < 0.5 ? 1 : 0);
        x += 3; for (let i = 0; i < L; i++) g[py][x + i] = '#';
        if (r() < 0.7) g[py - 1][x] = 'o';
        x += L + 3; flat(2);
      } else if (t < 0.67) {
        const dy = (r() < 0.5 ? -1 : 1) * (1 + (r() < 0.4 ? 1 : 0));
        gy = Math.max(9, Math.min(16, gy + dy)); flat(3);
      } else if (t < 0.85 && n >= 2) {
        flat(3);
        const cnt = 1 + (d > 0.3 && r() < 0.5 ? 1 : 0) + (d > 0.7 && r() < 0.4 ? 1 : 0);
        for (let i = 0; i < cnt && x < w - 12; i++) { g[gy - 1][x] = '^'; col(x, gy); x++; }
        flat(3);
      } else flat(4 + Math.floor(r() * 4));
    }
    for (; x < w; x++) col(x, gy);
    g[gy - 1][w - 4] = 'E';
    return { id: n, name: 'Màn ' + n, theme: themeOf(n), w, h, par: Math.round(w * 0.22 + 12), tiles: g.map(a => a.join('')) };
  }

  function arena(kind, seed) {
    seed = (seed | 0) || 1;
    if (kind === 'race') { const l = generate(30, { seed: seed * 31 + 7, w: 72, noDoors: true }); l.id = 'race'; l.name = 'Đua tốc độ'; l.theme = 7; return l; }
    if (kind === 'coinrush') {
      const w = 44, h = 22, g = blank(w, h);
      for (let y = 19; y < h; y++) g[y].fill('#');
      [[16, [4, 19, 34]], [13, [11, 26]], [10, [4, 19, 34]], [7, [11, 26]]].forEach(a => a[1].forEach(x => { for (let i = 0; i < 7; i++) g[a[0]][x + i] = '#'; }));
      g[18][3] = 'S';
      return { id: 'coinrush', name: 'Săn xu', theme: 5, w, h, par: 45, tiles: g.map(a => a.join('')) };
    }
    const w = 26, h = 34, g = blank(w, h), rr = rng(seed);
    for (let y = 31; y < h; y++) g[y].fill('#');
    let px = 10;
    for (let row = 28; row >= 4; row -= 3) { px = Math.max(1, Math.min(w - 7, px + Math.floor(rr() * 13) - 6)); for (let k = 0; k < 6; k++) g[row][px + k] = '#'; }
    g[30][13] = 'S';
    return { id: 'lava', name: 'Dung nham dâng', theme: 4, w, h, par: 100, tiles: g.map(a => a.join('')) };
  }

  function parse(level) {
    const rows = level.tiles, h = rows.length, w = rows[0].length;
    const W = { w, h, rows, level, spawn: { x: 2, y: h - 2 }, exit: null, buttons: [], doors: [], coins: [], checks: [] };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = rows[y][x];
      if (c === 'S') W.spawn = { x, y };
      else if (c === 'E') W.exit = { x, y };
      else if (c >= '1' && c <= '3') W.buttons.push({ x, y, id: String.fromCharCode(64 + (+c)) });
      else if (c >= 'A' && c <= 'C') W.doors.push({ x, y, id: c });
      else if (c === 'o') W.coins.push({ id: W.coins.length, x: x * TILE + 16, y: y * TILE + 16 });
      else if (c === 'K') W.checks.push({ x, y });
    }
    W.at = (tx, ty) => { if (tx < 0 || tx >= w || ty < 0) return '#'; if (ty >= h) return '.'; return rows[ty][tx]; };
    return W;
  }

  function validate(tiles) {
    if (!Array.isArray(tiles)) return 'Dữ liệu bản đồ không hợp lệ';
    const h = tiles.length; if (h < 12 || h > 40) return 'Chiều cao phải từ 12 đến 40 ô';
    const w = (tiles[0] || '').length; if (w < 20 || w > 200) return 'Chiều rộng phải từ 20 đến 200 ô';
    let s = 0, e = 0;
    for (const row of tiles) {
      if (typeof row !== 'string' || row.length !== w) return 'Các hàng phải cùng độ dài';
      if (!/^[.#^SEoK123ABC]+$/.test(row)) return 'Có ký tự không hợp lệ';
      for (const c of row) { if (c === 'S') s++; if (c === 'E') e++; }
    }
    if (s !== 1) return 'Cần đúng 1 điểm xuất phát (S)';
    if (e !== 1) return 'Cần đúng 1 cổng đích (E)';
    return null;
  }

  function get(n) { return generate(Math.max(1, Math.min(TOTAL, n | 0))); }
  return { TILE, TOTAL, THEMES, rng, generate, arena, parse, validate, get, themeOf };
});
