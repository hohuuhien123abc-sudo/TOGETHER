/* TOGETHER! - physics.js : vật lý nền tảng 2D (client) */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.Physics = f(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const T = 32, W = 24, H = 30, GRAV = 2300, RUN = 270, JUMP = 770, MAXF = 950;
  const solid = (world, doors, tx, ty) => { const c = world.at(tx, ty); return c === '#' || (c >= 'A' && c <= 'C' && !doors[c]); };
  function hit(world, doors, x, y) {
    const l = Math.floor((x - W / 2) / T), r = Math.floor((x + W / 2 - 0.001) / T), t = Math.floor((y - H) / T), b = Math.floor((y - 0.001) / T);
    for (let ty = t; ty <= b; ty++) for (let tx = l; tx <= r; tx++) if (solid(world, doors, tx, ty)) return true;
    return false;
  }
  /* p: {x (giữa), y (chân), vx, vy, f, ground, coy, buf}; inp: {left,right,jump,jumpPressed}; others: [{x,y}] (đứng lên đầu nhau được) */
  function step(p, inp, dt, world, doors, others) {
    const ev = [], dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), wasG = p.ground;
    if (dir) {
      const turn = Math.sign(p.vx) === -dir ? 2 : 1;
      p.vx += dir * (p.ground ? 3000 : 1800) * turn * dt;
      if (Math.abs(p.vx) > RUN) p.vx = RUN * Math.sign(p.vx);
      p.f = dir;
    } else { const fr = (p.ground ? 3200 : 700) * dt; p.vx = Math.abs(p.vx) <= fr ? 0 : p.vx - Math.sign(p.vx) * fr; }
    p.coy = p.ground ? 0.1 : (p.coy || 0) - dt;
    p.buf = inp.jumpPressed ? 0.12 : (p.buf || 0) - dt;
    if (p.buf > 0 && p.coy > 0) { p.vy = -JUMP; p.buf = 0; p.coy = 0; p.ground = false; ev.push('jump'); }
    if (p.vy < 0 && !inp.jump) p.vy += GRAV * 1.2 * dt;
    const fallV = p.vy; p.vy = Math.min(MAXF, p.vy + GRAV * dt);
    p.x += p.vx * dt;
    if (hit(world, doors, p.x, p.y)) {
      if (p.vx > 0) p.x = Math.floor((p.x + W / 2) / T) * T - W / 2 - 0.002;
      else if (p.vx < 0) p.x = (Math.floor((p.x - W / 2) / T) + 1) * T + W / 2 + 0.002;
      p.vx = 0;
    }
    const prevB = p.y; p.y += p.vy * dt; let onO = false;
    if (hit(world, doors, p.x, p.y)) {
      if (p.vy > 0) p.y = Math.floor((p.y - 0.001) / T) * T;
      else { p.y = (Math.floor((p.y - H) / T) + 1) * T + H + 0.002; }
      p.vy = 0;
    }
    if (p.vy >= 0 && others) for (const o of others) {
      const top = o.y - H;
      if (Math.abs(p.x - o.x) < W - 4 && prevB <= top + 6 && p.y >= top && p.y <= top + 14) { p.y = top; p.vy = 0; onO = true; break; }
    }
    p.ground = p.vy >= 0 && (onO || hit(world, doors, p.x, p.y + 1));
    if (p.ground && !wasG && fallV > 300) ev.push('land');
    return ev;
  }
  return { T, W, H, RUN, JUMP, GRAV, hit, step };
});
