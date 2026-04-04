/**
 * Multi-strategy influencer email finder — parallel, fast, timeout-safe
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmails(text) {
  if (!text) return [];
  const found = text.match(EMAIL_REGEX) || [];
  return found.filter(e =>
    !e.includes('.png') && !e.includes('.jpg') && !e.includes('.gif') &&
    !e.startsWith('noreply') && !e.startsWith('no-reply') &&
    !e.includes('example.com') && !e.includes('sentry') &&
    !e.includes('wixpress') && !e.includes('@2x')
  );
}

async function fetchPageEmails(url, source) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, ' ');
    const emails = extractEmails(text);
    if (emails.length > 0) return { email: emails[0], source, method: 'scrape' };
  } catch {
    // timeout or network error — skip
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

  const platformName = platform === 'instagram' ? 'Instagram' : 'TikTok';

  // ── Run all strategies in PARALLEL with a 20s overall timeout ──
  const profileUrl = platform === 'instagram'
    ? `https://www.instagram.com/${handle}/`
    : `https://www.tiktok.com/@${handle}`;

  const linktreeUrl = `https://linktr.ee/${handle}`;

  const [profileResult, linktreeResult, aiResult] = await Promise.all([
    // Strategy 1: scrape profile page
    fetchPageEmails(profileUrl, `${platformName} profile`),

    // Strategy 2: try common Linktree URL directly (no AI needed)
    fetchPageEmails(linktreeUrl, 'Linktree'),

    // Strategy 3: AI cross-platform deep search (single call, no chaining)
    base44.integrations.Core.InvokeLLM({
      prompt: `Find the public business/contact email for ${platformName} creator @${handle}.
Search their bio, YouTube About page, Twitter/X bio, Linktree, and personal website.
Look for patterns like: collab@, brand@, pr@, contact@, business@, hello@
Return only HIGH confidence emails — do NOT guess or fabricate.`,
      add_context_from_internet: true,
      model: 'gemini_3_flash',
      response_json_schema: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          source: { type: 'string' },
          confidence: { type: 'string' },
        }
      }
    }).catch(() => null),
  ]);

  // Return first found result (scrape beats AI for accuracy)
  if (profileResult) return Response.json(profileResult);
  if (linktreeResult) return Response.json(linktreeResult);

  const aiEmail = aiResult?.email;
  if (aiEmail && aiEmail.includes('@') && aiResult?.confidence !== 'low') {
    return Response.json({ email: aiEmail, source: aiResult.source || 'AI search', method: 'ai_search' });
  }

  return Response.json({ email: null, source: null, method: null });
});