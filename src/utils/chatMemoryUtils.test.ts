import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCascadeMessageDeletion,
  shouldFallbackToBuiltInFreeOnExternalError,
} from './chatMemoryUtils.ts';
import { buildChubModelsPayload } from '../../server/chubCompatApi.ts';

test('computeCascadeMessageDeletion removes target user message and ALL subsequent messages including system messages', () => {
  const messages = [
    { id: 1, sender: 'character', content: 'Greeting' },
    { id: 2, sender: 'user', content: 'First user message' },
    { id: 3, sender: 'character', content: 'First reply' },
    { id: 4, sender: 'system', content: 'Palace System notice' },
    { id: 5, sender: 'user', content: 'Second user message' },
    { id: 6, sender: 'character', content: 'Second reply' },
    { id: 7, sender: 'system', content: 'Trailing system tremor' },
  ];

  const result = computeCascadeMessageDeletion({
    messages,
    targetMessageId: 5,
    summary: '',
    unsavedCount: 6,
  });

  assert.equal(result.found, true);
  assert.deepEqual(
    result.remainingMessages.map((m) => m.id),
    [1, 2, 3, 4]
  );
  assert.deepEqual(result.deletedIds, [5, 6, 7]);
  assert.equal(result.deletedCount, 3);
  assert.equal(result.removedSystemCount, 1);
  assert.equal(result.unsavedCount, 3);
});

test('computeCascadeMessageDeletion wipes long-term summary memory when deleting past summarized turns', () => {
  const messages = [
    { id: 1, sender: 'character', content: 'Greeting' },
    { id: 2, sender: 'user', content: 'User turn 1' },
    { id: 3, sender: 'character', content: 'Bot turn 1' },
    { id: 4, sender: 'user', content: 'User turn 2' },
    { id: 5, sender: 'character', content: 'Bot turn 2' },
  ];

  // Summary covered turns up to id 3, then 2 new unsaved messages (4, 5) were sent.
  // Deleting message 2 removes 4 messages (> unsavedCount 2), so stale summary MUST be wiped.
  const wiped = computeCascadeMessageDeletion({
    messages,
    targetMessageId: 2,
    summary: 'User turn 1 happened earlier.',
    unsavedCount: 2,
  });

  assert.equal(wiped.found, true);
  assert.deepEqual(
    wiped.remainingMessages.map((m) => m.id),
    [1]
  );
  assert.equal(wiped.summary, '');
  assert.equal(wiped.unsavedCount, 0);

  // Deleting message 4 only removes 2 unsaved messages (<= unsavedCount 2), keeping earlier summary intact.
  const partial = computeCascadeMessageDeletion({
    messages,
    targetMessageId: 4,
    summary: 'User turn 1 happened earlier.',
    unsavedCount: 2,
  });

  assert.equal(partial.found, true);
  assert.deepEqual(
    partial.remainingMessages.map((m) => m.id),
    [1, 2, 3]
  );
  assert.equal(partial.summary, 'User turn 1 happened earlier.');
  assert.equal(partial.unsavedCount, 0);
});

test('shouldFallbackToBuiltInFreeOnExternalError triggers seamless free fallback for 429 credit limits and 402 payment errors', () => {
  assert.equal(shouldFallbackToBuiltInFreeOnExternalError('RATE_LIMITED', 429), true);
  assert.equal(shouldFallbackToBuiltInFreeOnExternalError('PAYMENT_REQUIRED', 402), true);
  assert.equal(shouldFallbackToBuiltInFreeOnExternalError('CLOUDFLARE_BLOCK', 403), true);
  assert.equal(shouldFallbackToBuiltInFreeOnExternalError('TIMEOUT', 408), true);
  assert.equal(shouldFallbackToBuiltInFreeOnExternalError('UPSTREAM_SERVER_ERROR', 503), true);
  assert.equal(shouldFallbackToBuiltInFreeOnExternalError(undefined, 429), true);
  assert.equal(shouldFallbackToBuiltInFreeOnExternalError('UNAUTHORIZED', 401), false);
});

test('buildChubModelsPayload exposes Chub.ai core models with zero credit cost', () => {
  const payload = buildChubModelsPayload();
  assert.equal(payload.object, 'list');
  assert.ok(Array.isArray(payload.data));
  const ids = payload.data.map((m) => m.id);
  for (const expected of ['mars', 'mercury', 'soji', 'asha', 'mythomax']) {
    assert.ok(ids.includes(expected), `Missing Chub core model ${expected}`);
  }
  for (const item of payload.data) {
    assert.equal(item.object, 'model');
    assert.equal(item.free, true);
    assert.equal(item.credit_cost, 0);
  }
});
