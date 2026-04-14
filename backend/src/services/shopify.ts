/**
 * Shopify Admin API helper — used by multiple routes.
 */
import { config } from '../config.js';
import { prisma } from '../db.js';

const API_VERSION = config.shopify.apiVersion;

function shopifyHeaders(accessToken: string): Record<string, string> {
  return {
    'X-Shopify-Access-Token': accessToken,
    'Content-Type': 'application/json',
  };
}

export async function shopifyFetch(accessToken: string, path: string, options?: RequestInit) {
  const url = `https://${config.shopify.storeDomain}/admin/api/${API_VERSION}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...shopifyHeaders(accessToken),
      ...(options?.headers as Record<string, string> || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error [${res.status}]: ${text}`);
  }
  return res.json();
}

/** Get a valid Shopify access token from DB */
export async function getShopifyToken(): Promise<{ token: string; domain: string }> {
  const session = await prisma.shopifySession.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  if (!session?.accessToken) {
    throw new Error('No Shopify session found. Configure OAuth first.');
  }
  return { token: session.accessToken, domain: session.shopDomain };
}

/** Store/renew a Shopify session */
export async function persistShopifySession(domain: string, accessToken: string, scope: string) {
  const existing = await prisma.shopifySession.findUnique({ where: { shopDomain: domain } });
  if (existing) {
    return prisma.shopifySession.update({
      where: { shopDomain: domain },
      data: { accessToken, scope },
    });
  }
  return prisma.shopifySession.create({
    data: { shopDomain: domain, accessToken, scope },
  });
}
