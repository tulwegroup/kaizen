/**
 * Fast influencer email finder — scrape only, no AI calls, completes in <5s
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmails(text) {
  const found = text.match(EMAIL_REGEX) || [];
  return found.filter(e =>
    !e.includes('.png') && !e.includes('.jpg') && !e.includes('.gif') &&
    !e.startsWith('noreply') && !e.startsWith('no-reply') &&
    !e.includes('example.com') && !e.includes('wixpress') &&
    !e.includes('sentry') && !e.includes('@2x') && !e.includes('domain')
  );
}

async function scrape(url, source) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, ' ');
    const emails = extractEmails(text);
    if (emails.length > 0) return { email: emails[0], source, method: 'scrape' };
  } catch {
    // timeout or blocked — skip silently
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { handle, platform } = await req.json();
  if (!handle) return Response.json({ error: 'handle required' }, { status: 400 });

  const profileUrl = platform === 'instagram'
    ? `https://www.instagram.com/${handle}/`
    : `https://www.tiktok.com/@${handle}`;

  const linktreeUrl = `https://linktr.ee/${handle}`;
  const beaconUrl = `https://beacons.ai/${handle}`;

  // All scrapes in parallel — whichever finds an email first wins
  const results = await Promise.all([
    scrape(profileUrl, platform === 'instagram' ? 'Instagram bio' : 'TikTok bio'),
    scrape(linktreeUrl, 'Linktree'),
    scrape(beaconUrl, 'Beacons'),
  ]);

  const found = results.find(r => r !== null);
  if (found) return Response.json(found);

  return Response.json({ email: null, source: null, method: null });
});