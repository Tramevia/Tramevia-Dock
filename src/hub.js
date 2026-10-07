// Realtime hub: one WebSocket per page, topics multiplexed as {t, d} frames.
// Server modules subscribe with hub.on(fn); pages get a backlog on connect.
import { WebSocketServer } from 'ws';

// Topics a read-only (overlay) client may receive. Everything else is admin-only.
const READ_TOPICS = new Set(['chat', 'chat:delete', 'event', 'stats', 'feature']);
const BACKLOG_TOPICS = new Set(['chat', 'event']);

export function createHub({ backlogSize = 400 } = {}) {
  const clients = new Set();
  const listeners = new Set();
  const backlog = [];
  let featured = null; // last 'feature' payload, replayed to pages that connect later (overlay)
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });

  /** Does a chat:delete {accountId, messageId?, userId?} hit message m? (no id = whole chat cleared) */
  const hit = (m, d) => m.accountId === d.accountId &&
    (d.messageId ? m.id === d.messageId : d.userId ? String(m.author?.id) === String(d.userId) : true);

  function applyDelete(d) {
    for (const item of backlog) if (item.t === 'chat' && hit(item.d, d)) item.d.deleted = true;
  }

  function publish(t, d) {
    if (BACKLOG_TOPICS.has(t)) {
      backlog.push({ t, d });
      if (backlog.length > backlogSize) backlog.shift();
    }
    if (t === 'chat:delete') {
      applyDelete(d);
      if (featured && hit(featured, d)) publish('feature', null); // never replay a moderated message on stream
    }
    if (t === 'feature') featured = d && d.id && !d.deleted ? d : null;
    for (const fn of listeners) {
      try { fn(t, d); } catch (err) { console.error('[hub] listener failed', err); }
    }
    const frame = JSON.stringify({ t, d });
    for (const ws of clients) {
      if (ws.readyState === 1 && (ws.access === 'admin' || READ_TOPICS.has(t))) ws.send(frame);
    }
  }

  /** Upgrade an HTTP request. `hello()` builds the first frame (state snapshot) for this client. */
  function upgrade(req, socket, head, access, hello, recheck) {
    wss.handleUpgrade(req, socket, head, ws => {
      ws.access = access;
      ws.recheck = recheck;
      ws.alive = true;
      clients.add(ws);
      ws.on('pong', () => { ws.alive = true; });
      ws.on('close', () => clients.delete(ws));
      ws.on('error', () => ws.terminate());
      ws.on('message', () => {}); // clients act through the HTTP API
      const items = backlog.filter(i => access === 'admin' || READ_TOPICS.has(i.t));
      ws.send(JSON.stringify({ t: 'hello', d: { ...hello(access), backlog: items } }));
      if (featured) ws.send(JSON.stringify({ t: 'feature', d: featured }));
    });
  }

  const timer = setInterval(() => {
    for (const ws of clients) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, 30_000);
  timer.unref();

  return {
    publish,
    upgrade,
    on: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    backlog: () => backlog.slice(),
    /** After a key/session rotation: close sockets whose credentials no longer grant the same access. */
    revalidate() {
      for (const ws of clients) {
        let now = 'public';
        try { now = ws.recheck ? ws.recheck() : ws.access; } catch { /* treat as revoked */ }
        if (now !== ws.access) ws.close(4001, 'credentials rotated');
      }
    },
    close: () => { clearInterval(timer); for (const ws of clients) ws.terminate(); wss.close(); },
  };
}
