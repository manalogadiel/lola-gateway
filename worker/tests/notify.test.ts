import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorker } from '../src/index.ts';

const origin = 'http://localhost:5173';
const env = {
  FIREBASE_PROJECT_ID: 'demo-lola-gateway',
  FIREBASE_CLIENT_EMAIL: '',
  FIREBASE_PRIVATE_KEY: '',
  ALLOWED_ORIGINS: origin,
};
const payload = { familyId: 'family1', messageId: 'message1' };
const field = (stringValue: string) => ({ stringValue });

function fixture({ membership = 200, status = 'ONLINE', sender = 'member', token = 'gateway-token' } = {}) {
  const pushes: unknown[] = [];
  const worker = createWorker({
    async verifyFirebaseIdToken(token) {
      if (token !== 'valid') throw new Error('Invalid token');
      return 'member';
    },
    async fetch(input, init) {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer valid');
      const path = String(input);
      if (path.endsWith('/members/member')) return new Response(null, { status: membership });
      if (path.endsWith('/messages/message1')) return Response.json({ fields: {
        direction: field('OUTBOUND'), status: field('QUEUED'), senderUid: field(sender),
      } });
      assert.ok(path.endsWith('/families/family1'));
      return Response.json({ fields: { gateway: { mapValue: { fields: {
        status: field(status), fcmToken: field(token),
      } } } } });
    },
    async sendHighPriorityFcm(_env, token, data) { pushes.push({ token, data }); },
  });
  return { worker, pushes };
}

function notify(worker: ReturnType<typeof createWorker>, authorization = 'Bearer valid') {
  return worker.fetch(new Request('https://worker.example/notify', {
    method: 'POST', headers: { Authorization: authorization, Origin: origin }, body: JSON.stringify(payload),
  }), env);
}

test('requires a valid Firebase ID token', async () => {
  const { worker } = fixture();
  assert.equal((await notify(worker, '')).status, 401);
  assert.equal((await notify(worker, 'Bearer invalid')).status, 401);
});

test('rejects callers outside the family and messages queued by someone else', async () => {
  assert.equal((await notify(fixture({ membership: 403 }).worker)).status, 403);
  assert.equal((await notify(fixture({ sender: 'someone-else' }).worker)).status, 403);
});

test('skips paused or unregistered gateways', async () => {
  const paused = fixture({ status: 'PAUSED' });
  const unregistered = fixture({ token: '' });
  assert.deepEqual(await (await notify(paused.worker)).json(), { ok: true, skipped: 'PAUSED' });
  assert.deepEqual(await (await notify(unregistered.worker)).json(), { ok: true, skipped: 'NO_TOKEN' });
  assert.deepEqual([...paused.pushes, ...unregistered.pushes], []);
});

test('sends the requested queued message ID to the family gateway', async () => {
  const { worker, pushes } = fixture();
  assert.deepEqual(await (await notify(worker)).json(), { ok: true });
  assert.deepEqual(pushes, [{ token: 'gateway-token', data: payload }]);
});

test('allows CORS preflight only for configured origins', async () => {
  const { worker } = fixture();
  const preflight = (origin: string) => worker.fetch(new Request('https://worker.example/notify', {
    method: 'OPTIONS', headers: { Origin: origin },
  }), env);
  const accepted = await preflight(origin);
  assert.equal(accepted.status, 204);
  assert.equal(accepted.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal((await preflight('https://other.example')).status, 403);
});
