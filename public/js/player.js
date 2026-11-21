/* TOGETHER! - player.js : điều khiển + vẽ nhân vật hoạt hình */
const CHAR_COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ff922b', '#38d9a9', '#f783ac'];
const EMOTES = ['😀', '😂', '👍', '😭', '❤️', '🆘'];
class Input {
  constructor() {
    this.k = {}; this.jp = false; this.onKey = null;
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      const c = e.code; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      if (!this.k[c] && (c === 'Space' || c === 'ArrowUp' || c === 'KeyW')) this.jp = true;
      this.k[c] = true; if (this.onKey && !e.repeat) this.onKey(c);
    });
    addEventListener('keyup', e => { this.k[e.code] = false; });
    addEventListener('blur', () => { this.k = {}; });
  }
  get() { const k = this.k; return { left: k.ArrowLeft || k.KeyA, right: k.ArrowRight || k.KeyD, jump: k.Space || k.ArrowUp || k.KeyW, jumpPressed: this.jp }; }
  clear() { this.jp = false; }
}
function drawAccessory(c, ci) {
  c.lineWidth = 2.5; c.strokeStyle = '#0004';
  if (ci === 1) { c.fillStyle = CHAR_COLORS[1]; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 8, -34, 4, 9, s * 0.2, 0, 6.3); c.fill(); c.stroke(); } }
  else if (ci === 2) { c.strokeStyle = '#444'; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, -40); c.stroke(); c.fillStyle = '#fff27a'; c.beginPath(); c.arc(0, -41, 4, 0, 6.3); c.fill(); c.stroke(); }
  else if (ci === 3) { c.fillStyle = '#333'; c.fillRect(-9, -36, 18, 8); c.fillRect(-13, -30, 26, 3); }
  else if (ci === 4) { c.fillStyle = '#fff'; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 11, -28); c.lineTo(s * 14, -38); c.lineTo(s * 5, -31); c.fill(); c.stroke(); } }
  else if (ci === 5) { c.fillStyle = '#ff4d94'; c.beginPath(); c.moveTo(0, -30); c.lineTo(-10, -37); c.lineTo(-10, -25); c.closePath(); c.moveTo(0, -30); c.lineTo(10, -37); c.lineTo(10, -25); c.closePath(); c.fill(); }
  else if (ci === 6) { c.fillStyle = '#ffd43b'; c.strokeStyle = '#b8860b'; c.beginPath(); c.moveTo(-10, -29); c.lineTo(-8, -38); c.lineTo(-4, -32); c.lineTo(0, -40); c.lineTo(4, -32); c.lineTo(8, -38); c.lineTo(10, -29); c.closePath(); c.fill(); c.stroke(); }
  else if (ci === 7) { c.fillStyle = '#40c057'; c.strokeStyle = '#2b8a3e'; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 5, -34, 3.5, 7, s * 0.9, 0, 6.3); c.fill(); c.stroke(); } }
}
/* o: {x,y(chân),ci,f,vx,vy,ground,t,sq,name,local,emote:{e,t}} */
function drawPlayer(c, o) {
  const col = CHAR_COLORS[o.ci % 8], run = o.ground && Math.abs(o.vx) > 20, ph = Math.sin(o.t * 16) * (run ? 1 : 0);
  let sy = 1 + Math.min(0.28, Math.abs(o.vy) / 2800) - (o.sq > 0 ? 0.22 * Math.min(1, o.sq / 0.12) : 0);
  const sx = 1 / sy; c.save(); c.translate(o.x, o.y); c.scale(sx, sy);
  c.fillStyle = '#0002'; c.beginPath(); c.ellipse(0, 0, 11, 3, 0, 0, 6.3); c.fill();
  c.fillStyle = col; c.strokeStyle = '#0004'; c.lineWidth = 2.5;
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 6 + (run ? s * ph * 3 : 0), -2 - (run && s * ph > 0 ? 3 : 0), 6, 3.5, 0, 0, 6.3); c.fill(); c.stroke(); }
  c.translate(0, run ? Math.abs(ph) * -1.5 : 0);
  c.beginPath(); c.ellipse(0, -16, 13.5, 15.5, 0, 0, 6.3); c.fill(); c.stroke();
  c.fillStyle = '#fff5'; c.beginPath(); c.ellipse(-5, -24, 5, 3, -0.4, 0, 6.3); c.fill();
  drawAccessory(c, o.ci);
  const ex = (o.f || 1) * 1.5, ey = Math.max(-1.5, Math.min(1.5, o.vy / 300));
  for (const s of [-1, 1]) { c.fillStyle = '#fff'; c.beginPath(); c.arc(s * 5, -18, 4.6, 0, 6.3); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(s * 5 + ex, -18 + ey, 2.4, 0, 6.3); c.fill(); }
  c.strokeStyle = '#222'; c.lineWidth = 1.8; c.beginPath();
  if (o.ground) c.arc(0 + ex * 0.4, -11, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); else c.ellipse(ex * 0.4, -9, 2, 2.6, 0, 0, 6.3); c.stroke();
  c.restore();
  c.font = '700 11px sans-serif'; c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = '#0008'; c.fillStyle = '#fff';
  c.strokeText(o.name, o.x, o.y - 46); c.fillText(o.name, o.x, o.y - 46);
  if (o.local) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(o.x - 5, o.y - 62 + Math.sin(o.t * 6) * 2); c.lineTo(o.x + 5, o.y - 62 + Math.sin(o.t * 6) * 2); c.lineTo(o.x, o.y - 55 + Math.sin(o.t * 6) * 2); c.fill(); }
  if (o.emote && o.emote.t > 0) { c.globalAlpha = Math.min(1, o.emote.t * 2); c.font = '26px serif'; c.fillText(EMOTES[o.emote.e] || '😀', o.x, o.y - 70 - (2 - Math.min(2, o.emote.t)) * 6); c.globalAlpha = 1; }
}
