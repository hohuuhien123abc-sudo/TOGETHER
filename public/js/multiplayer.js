/* TOGETHER! - multiplayer.js : kết nối WebSocket, API REST, tài khoản */
const Auth = {
  get token() { return localStorage.getItem('together_token') || ''; },
  get name() { return localStorage.getItem('together_user') || ''; },
  set(t, n) { localStorage.setItem('together_token', t); localStorage.setItem('together_user', n); },
  clear() { localStorage.removeItem('together_token'); localStorage.removeItem('together_user'); }
};
async function api(path, method, body) {
  const r = await fetch('/api/' + path, { method: method || 'GET', headers: Object.assign({ 'Content-Type': 'application/json' }, Auth.token ? { Authorization: 'Bearer ' + Auth.token } : {}), body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({})); if (!r.ok) throw new Error(data.error || 'Lỗi ' + r.status); return data;
}
class Net {
  constructor() { this.h = {}; this.ws = null; this.open = false; }
  on(t, f) { this.h[t] = f; return this; }
  connect(join) {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    this.ws = new WebSocket(proto + location.host + '/ws');
    this.ws.onopen = () => { this.open = true; this.send(Object.assign({ t: 'join', token: Auth.token }, join)); };
    this.ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (this.h[m.t]) this.h[m.t](m); if (this.h['*']) this.h['*'](m); };
    this.ws.onclose = () => { this.open = false; if (this.h.close) this.h.close(); };
  }
  send(o) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(o)); }
  close() { if (this.ws) this.ws.close(); }
}
