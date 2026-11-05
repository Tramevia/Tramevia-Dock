// Alert history and remote control for the alerts overlays (id=alerts). The last 30 events that alert are kept in memory
// (TikTok likes left out: they come in floods) and any of them can be replayed; the alert on screen can be skipped and the
// queue paused (alerts keep waiting, at most 20, until it resumes). Topic 'alert:control' { action, event? } to the
// overlays; 'alerts' { paused, history } to the dashboard. A replay never counts again (goals, live recap): it is not an
// 'event' frame. SPEC.md §7.9.
import { HttpError } from './http.js';
import { alertCategory } from '../public/assets/overlay-settings.js';

const KEEP = 30, PUBLISH_EVERY = 1000;

export function createAlerts(ctx) {
  const history = []; // newest first
  let paused = false;
  let publishTimer = 0;

  const state = () => ({ paused, history });
  function publish() {
    clearTimeout(publishTimer);
    publishTimer = 0;
    ctx.hub.publish('alerts', state());
  }

  function onEvent(evt) {
    if (!evt || evt.test || !alertCategory(evt.type) || evt.type === 'like') return;
    // The same id again (YouTube Jewels combo, webhook retry): the newer copy takes its place.
    const i = evt.id ? history.findIndex(e => e.id === evt.id && e.accountId === evt.accountId) : -1;
    if (i >= 0) history.splice(i, 1);
    history.unshift(evt);
    if (history.length > KEEP) history.length = KEEP;
    publishTimer ||= setTimeout(publish, PUBLISH_EVERY); // a raid of gifted subs = one frame, not twenty
    publishTimer.unref?.();
  }

  const control = d => ctx.hub.publish('alert:control', d);
  function replay(key) {
    const evt = history.find(e => `${e.accountId}:${e.id}` === key);
    if (!evt) return false;
    control({ action: 'replay', event: { ...evt, replay: true } });
    return true;
  }
  function setPaused(on) {
    paused = Boolean(on);
    control({ action: paused ? 'pause' : 'resume' });
    publish();
  }

  ctx.hub.on((t, d) => { if (t === 'event') onEvent(d); });

  return { state, paused: () => paused, onEvent, replay, skip: () => control({ action: 'skip' }), setPaused };
}

export function register(router, ctx) {
  ctx.alerts = createAlerts(ctx);
  router.get('/api/alerts', () => ctx.alerts.state());
  router.post('/api/alerts/replay', ({ body }) => {
    if (!ctx.alerts.replay(String(body?.key || ''))) throw new HttpError(404, ctx.t('Cette alerte n’est plus dans l’historique.', 'This alert is no longer in the history.'), 'unknown_alert');
    return { ok: true };
  });
  router.post('/api/alerts/skip', () => { ctx.alerts.skip(); return { ok: true }; });
  router.put('/api/alerts/pause', ({ body }) => {
    if (typeof body?.paused !== 'boolean') throw new HttpError(400, ctx.t('Valeur invalide : paused', 'Invalid paused'), 'invalid');
    ctx.alerts.setPaused(body.paused);
    return ctx.alerts.state();
  });
}
