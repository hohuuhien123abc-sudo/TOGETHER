/* TOGETHER! - puzzles.js : phần tử câu đố (nút, cửa, checkpoint, cổng đích, xu) và danh mục mini-game */
const Puzzles = {
  DOOR: { A: '#ff5d5d', B: '#4d9bff', C: '#56d364' },
  minis: [
    { id: 'coinrush', name: 'Săn xu', icon: '🪙', desc: 'Nhặt nhiều xu nhất trong 45 giây. Xu vàng = 3 điểm!' },
    { id: 'lava', name: 'Dung nham dâng', icon: '🌋', desc: 'Leo lên cao, sống sót lâu nhất khi dung nham dâng lên.' },
    { id: 'race', name: 'Đua tốc độ', icon: '🏁', desc: 'Ai chạm cổng đích đầu tiên sẽ thắng!' }
  ],
  hint(mode) { return mode === 'coop' ? 'Cả đội phải cùng đứng ở cổng đích 🌀' : mode === 'coinrush' ? 'Nhặt thật nhiều xu 🪙 (vàng = 3 điểm)' : mode === 'lava' ? 'Leo lên! Đừng để dung nham chạm tới bạn' : 'Chạy tới cổng đích trước tiên!'; },
  button(c, b, pressed, t) {
    const x = b.x * 32, y = b.y * 32, col = this.DOOR[b.id];
    c.fillStyle = '#555'; c.beginPath(); c.roundRect(x + 2, y + 26, 28, 6, 3); c.fill();
    c.fillStyle = col; c.beginPath(); c.ellipse(x + 16, y + (pressed ? 28 : 23), 11, pressed ? 3 : 8, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#fff6'; c.beginPath(); c.ellipse(x + 12, y + (pressed ? 27 : 20), 4, 2, 0, 0, 6.3); c.fill();
    if (!pressed) { c.strokeStyle = col; c.globalAlpha = 0.5 + 0.3 * Math.sin(t * 5); c.lineWidth = 2; c.beginPath(); c.arc(x + 16, y + 20, 13 + Math.sin(t * 5) * 2, Math.PI, 0); c.stroke(); c.globalAlpha = 1; }
  },
  door(c, d, open, t, isMid) {
    const x = d.x * 32, y = d.y * 32, col = this.DOOR[d.id];
    if (open) { c.globalAlpha = 0.18; c.strokeStyle = col; c.setLineDash([4, 6]); c.lineWidth = 2; c.strokeRect(x + 6, y, 20, 32); c.setLineDash([]); c.globalAlpha = 1; return; }
    c.fillStyle = col; c.fillRect(x + 4, y, 24, 32); c.fillStyle = '#0003'; c.fillRect(x + 4, y, 5, 32); c.fillStyle = '#fff4'; c.fillRect(x + 23, y, 3, 32);
    c.fillStyle = '#fff5'; for (let i = 6; i < 32; i += 12) c.fillRect(x + 4, y + i, 24, 2);
    if (isMid) { c.font = '18px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🔒', x + 16, y + 16); }
  },
  checkpoint(c, k, on, t) {
    const x = k.x * 32, y = k.y * 32; c.fillStyle = '#ddd'; c.fillRect(x + 14, y + 2, 4, 30);
    c.fillStyle = on ? '#ffd43b' : '#adb5bd'; const w = Math.sin(t * 6) * (on ? 2 : 0.5);
    c.beginPath(); c.moveTo(x + 18, y + 3); c.quadraticCurveTo(x + 26, y + 5 + w, x + 32, y + 8); c.quadraticCurveTo(x + 26, y + 11 - w, x + 18, y + 14); c.fill();
  },
  exit(c, e, t, inside, total) {
    const x = e.x * 32 + 16, y = e.y * 32 + 16;
    c.save(); c.translate(x, y);
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 56); g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#a5d8ff'); g.addColorStop(1, '#a5d8ff00');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 56, 0, 6.3); c.fill();
    for (let i = 0; i < 3; i++) { c.strokeStyle = ['#4dabf7', '#da77f2', '#ffd43b'][i]; c.lineWidth = 4; c.beginPath(); c.ellipse(0, -4, 20 - i * 5, 30 - i * 7, 0, t * (2 + i) + i, t * (2 + i) + i + 4.2); c.stroke(); }
    c.fillStyle = '#fff'; c.font = '800 14px sans-serif'; c.textAlign = 'center'; c.strokeStyle = '#0006'; c.lineWidth = 3;
    const s = inside + '/' + total; c.strokeText(s, 0, -48); c.fillText(s, 0, -48); c.restore();
  },
  coin(c, x, y, t, v) {
    const b = Math.sin(t * 4 + x * 0.05) * 3, sx = Math.abs(Math.cos(t * 3 + x * 0.1)) * 0.8 + 0.2, r = v > 1 ? 11 : 8;
    c.save(); c.translate(x, y + b); c.scale(sx, 1);
    c.fillStyle = v > 1 ? '#ff9f1c' : '#ffd43b'; c.strokeStyle = v > 1 ? '#b45f06' : '#f08c00'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, r, 0, 6.3); c.fill(); c.stroke();
    c.fillStyle = '#fff8'; c.beginPath(); c.arc(-2, -3, r * 0.3, 0, 6.3); c.fill(); c.restore();
  }
};
