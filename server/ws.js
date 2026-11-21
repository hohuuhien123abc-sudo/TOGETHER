/* TOGETHER! - ws.js : WebSocket (RFC 6455) tự cài đặt, không cần thư viện ngoài */
const crypto = require('crypto'), EventEmitter = require('events');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11', MAX = 64 * 1024;
class WS extends EventEmitter {
  constructor(socket) {
    super(); this.socket = socket; this.alive = true; this.buf = Buffer.alloc(0); this.frag = [];
    socket.setNoDelay(true);
    socket.on('data', d => this.onData(d));
    socket.on('close', () => this.end()); socket.on('error', () => this.end());
  }
  end() { if (!this.alive) return; this.alive = false; this.emit('close'); }
  onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      const b = this.buf; if (b.length < 2) return;
      const fin = !!(b[0] & 128), op = b[0] & 15, masked = !!(b[1] & 128); let len = b[1] & 127, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      if (len > MAX) return this.close();
      const need = off + (masked ? 4 : 0) + len; if (b.length < need) return;
      const payload = Buffer.from(b.subarray(off + (masked ? 4 : 0), need));
      if (masked) { const m = b.subarray(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      this.buf = b.subarray(need);
      if (op === 8) return this.close();
      if (op === 9) { this.raw(0x8A, payload); continue; }
      if (op === 10) continue;
      if (op === 1 || op === 0) {
        this.frag.push(payload);
        if (fin) { const s = Buffer.concat(this.frag).toString('utf8'); this.frag = []; this.emit('message', s); }
      }
    }
  }
  raw(first, data) {
    if (!this.alive) return; const len = data.length; let h;
    if (len < 126) h = Buffer.from([first, len]);
    else if (len < 65536) { h = Buffer.alloc(4); h[0] = first; h[1] = 126; h.writeUInt16BE(len, 2); }
    else { h = Buffer.alloc(10); h[0] = first; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); }
    this.socket.write(Buffer.concat([h, data]));
  }
  send(str) { this.raw(0x81, Buffer.from(str)); }
  close() { if (this.alive) { try { this.raw(0x88, Buffer.alloc(0)); this.socket.end(); } catch (e) { /* bỏ qua */ } } this.end(); }
}
function accept(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return null; }
  const acc = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + acc + '\r\n\r\n');
  return new WS(socket);
}
module.exports = { accept, WS };
