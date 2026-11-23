import { importPKCS8, SignJWT } from 'jose';

export interface MessagingCredentials {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_CLIENT_EMAIL: string;
  FIREBASE_PRIVATE_KEY: string;
}

const tokenEndpoint = 'https://oauth2.googleapis.com/token';
const tokenCache = new WeakMap<MessagingCredentials, Promise<{ token: string; expiresAt: number }>>();

async function requestAccessToken(credentials: MessagingCredentials) {
  const key = await importPKCS8(credentials.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/firebase.messaging' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(credentials.FIREBASE_CLIENT_EMAIL)
    .setAudience(tokenEndpoint)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!response.ok) throw new Error('Google rejected the FCM service account');
  const { access_token, expires_in } = await response.json() as Record<string, unknown>;
  if (typeof access_token !== 'string' || typeof expires_in !== 'number') {
    throw new Error('Invalid Google access token response');
  }
  return { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
}

export async function mintGoogleAccessToken(credentials: MessagingCredentials): Promise<string> {
  const existing = tokenCache.get(credentials);
  if (existing) {
    const cached = await existing;
    if (cached.expiresAt > Date.now() + 60_000) return cached.token;
    if (tokenCache.get(credentials) !== existing) return mintGoogleAccessToken(credentials);
  }
  const pending = requestAccessToken(credentials);
  tokenCache.set(credentials, pending);
  try {
    return (await pending).token;
  } catch (error) {
    if (tokenCache.get(credentials) === pending) tokenCache.delete(credentials);
    throw error;
  }
}

export async function sendHighPriorityFcm(
  credentials: MessagingCredentials, token: string, data: { familyId: string; messageId: string },
): Promise<void> {
  const accessToken = await mintGoogleAccessToken(credentials);
  const project = encodeURIComponent(credentials.FIREBASE_PROJECT_ID);
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${project}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { token, data, android: { priority: 'HIGH' } } }),
  });
  if (!response.ok) throw new Error('FCM rejected the wake-up message');
}
