/* TOGETHER! - player.js : người chơi phía server */
const COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#da77f2', '#ff922b', '#38d9a9', '#f783ac'];
let nextId = 1;
class Player {
  constructor(ws, name, user) { this.id = nextId++; this.ws = ws; this.name = name; this.user = user || null; this.ci = 0; this.ready = false; this.room = null; this.g = null; }
  send(o) { if (this.ws && this.ws.alive) this.ws.send(JSON.stringify(o)); }
  info(hostId) { return { id: this.id, name: this.name, ci: this.ci, ready: this.ready, host: this.id === hostId, acc: !!this.user }; }
}
module.exports = { Player, COLORS };
