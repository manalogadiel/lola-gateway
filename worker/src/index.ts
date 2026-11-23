import { verifyFirebaseIdToken } from './auth.ts';
import { sendHighPriorityFcm, type MessagingCredentials } from './fcm.ts';

interface Env extends MessagingCredentials {
  ALLOWED_ORIGINS: string;
}

interface FirestoreValue {
  stringValue?: string;
  mapValue?: { fields?: Record<string, FirestoreValue> };
}

const dependencies = { verifyFirebaseIdToken, sendHighPriorityFcm, fetch: globalThis.fetch.bind(globalThis) };
const documentId = /^[A-Za-z0-9_-]{1,128}$/;

export function createWorker(services = dependencies) {
  return {
    async fetch(request: Request, env: Env): Promise<Response> {
      const headers = new Headers({ Vary: 'Origin', 'Cache-Control': 'no-store' });
      const respond = (status: number, body: object) => Response.json(body, { status, headers });
      if (new URL(request.url).pathname !== '/notify') return respond(404, { error: 'NOT_FOUND' });
      const origin = request.headers.get('Origin');
      if (origin) {
        if (!env.ALLOWED_ORIGINS.split(',').map(value => value.trim()).includes(origin)) {
          return respond(403, { error: 'ORIGIN_NOT_ALLOWED' });
        }
        headers.set('Access-Control-Allow-Origin', origin);
      }
      if (request.method === 'OPTIONS') {
        headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        return new Response(null, { status: 204, headers });
      }
      if (request.method !== 'POST') {
        headers.set('Allow', 'POST, OPTIONS');
        return respond(405, { error: 'METHOD_NOT_ALLOWED' });
      }
      const token = /^Bearer (\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
      if (!token) return respond(401, { error: 'UNAUTHENTICATED' });
      let uid: string;
      try {
        uid = await services.verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
      } catch {
        return respond(401, { error: 'UNAUTHENTICATED' });
      }
      const body: unknown = await request.json().catch(() => null);
      if (!body || typeof body !== 'object' || !('familyId' in body) || !('messageId' in body) ||
          typeof body.familyId !== 'string' || !documentId.test(body.familyId) ||
          typeof body.messageId !== 'string' || !documentId.test(body.messageId)) {
        return respond(400, { error: 'INVALID_REQUEST' });
      }
      const { familyId, messageId } = body;
      const project = encodeURIComponent(env.FIREBASE_PROJECT_ID);
      const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/families/${familyId}`;
      const read = (suffix: string) => services.fetch(base + suffix, {
        headers: { Authorization: `Bearer ${token}` },
      });
      try {
        const member = await read(`/members/${encodeURIComponent(uid)}`);
        if (member.status === 403 || member.status === 404) return respond(403, { error: 'NOT_A_MEMBER' });
        if (!member.ok) throw new Error('Membership lookup failed');
        const [family, message] = await Promise.all([read(''), read(`/messages/${messageId}`)]);
        if (family.status === 403 || message.status === 403) return respond(403, { error: 'FORBIDDEN' });
        if (message.status === 404) return respond(400, { error: 'INVALID_MESSAGE' });
        if (!family.ok || !message.ok) throw new Error('Firestore lookup failed');
        const { fields: messageFields } = await message.json() as { fields?: Record<string, FirestoreValue> };
        if (messageFields?.senderUid?.stringValue !== uid || messageFields.direction?.stringValue !== 'OUTBOUND') {
          return respond(403, { error: 'FORBIDDEN' });
        }
        if (messageFields.status?.stringValue !== 'QUEUED') return respond(200, { ok: true });
        const { fields } = await family.json() as { fields?: Record<string, FirestoreValue> };
        const gateway = fields?.gateway?.mapValue?.fields;
        if (gateway?.status?.stringValue === 'PAUSED') return respond(200, { ok: true, skipped: 'PAUSED' });
        const gatewayToken = gateway?.fcmToken?.stringValue;
        if (!gatewayToken) return respond(200, { ok: true, skipped: 'NO_TOKEN' });
        await services.sendHighPriorityFcm(env, gatewayToken, { familyId, messageId });
        return respond(200, { ok: true });
      } catch {
        return respond(502, { error: 'NOTIFY_UNAVAILABLE' });
      }
    },
  };
}

export default createWorker();
