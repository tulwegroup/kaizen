/**
 * CJ Dropshipping API helper.
 */
import { config } from '../config.js';
import { prisma } from '../db.js';

const CJ_BASE = 'https://developers.cjdropshipping.com/api';

let cachedToken: string | null = null;
let tokenExpiry = 0;

export async function getCJToken(email?: string, apiKey?: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const cjEmail = email || config.cj.email;
  const cjApiKey = apiKey || config.cj.apiKey;
  if (!cjEmail || !cjApiKey) throw new Error('CJ_EMAIL and CJ_API_KEY required');

  const res = await fetch(`${CJ_BASE}/v1/authentication/getToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: cjEmail, appKey: cjApiKey }),
  });

  if (!res.ok) throw new Error(`CJ auth failed: ${await res.text()}`);
  const data = await res.json();
  if (!data?.data?.accessToken) throw new Error('CJ returned no access token');

  cachedToken = data.data.accessToken;
  tokenExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24h
  return cachedToken;
}

export async function cjFetch(path: string, token: string, options?: RequestInit) {
  const url = `${CJ_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': token,
      ...(options?.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) throw new Error(`CJ API error [${res.status}]: ${await res.text()}`);
  return res.json();
}

export async function getCJTokenFromDB(email: string): Promise<string> {
  const session = await prisma.cJSession.findFirst({ where: { email } });
  if (session?.token && (!session.tokenExp || new Date(session.tokenExp) > new Date())) {
    return session.token;
  }
  const token = await getCJToken(email);
  await prisma.cJSession.upsert({
    where: { id: session?.id || 'none' },
    create: { email, token, tokenExp: new Date(Date.now() + 86400000) },
    update: { token, tokenExp: new Date(Date.now() + 86400000) },
  });
  return token;
}
