import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHub } from '../src/hub.js';

test('clear() empties the backlog and tells pages', () => {
  const hub = createHub();
  const seen = [];
  hub.on(t => seen.push(t));
  hub.publish('chat', { id: 'a', accountId: 'x' });
  hub.publish('event', { id: 'b', accountId: 'x' });
  hub.clear();
  assert.deepEqual(hub.backlog(), []);
  assert.deepEqual(seen, ['chat', 'event', 'chat:clear']);
  hub.publish('chat', { id: 'c', accountId: 'x' });
  assert.equal(hub.backlog().length, 1);
  hub.close();
});
