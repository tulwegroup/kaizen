/**
 * Multi-strategy influencer email finder
 * Chains: bio scrape → linktree fetch → cross-platform search → pattern matching
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmails(text) {
  if (!text) return [];
  const found = text.match(EMAIL_REGEX) || [];
  // Filter out noise (image filenames, common false positives)
  return found.filter(e =>
    !e.includes('.png') && !e.includes('.jpg') && !e.includes('.gif') &&
    !e.startsWith('noreply') && !e.startsWith('no-reply') &&
    !e.includes('example.com') && !e.includes('sentry')
  );
}

async function fetchPageText(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip tags for cleaner email search
    return html.replace(/<[^>]+>/g, ' ');
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { handle, platform } = await req.json();
  if (!handle) return Response.json({ error: 'handle required' }, { status: 400 });

  const platformName = platform === 'instagram' ? 'Instagram' : 'TikTok';
  const results = { email: null, source: null, method: null };

  // ── Strategy 1: Scrape their actual profile page ──
  const profileUrls = platform === 'instagram'
    ? [`https://www.instagram.com/${handle}/`]
    : [`https://www.tiktok.com/@${handle}`];

  for (const url of profileUrls) {
    const text = await fetchPageText(url);
    if (text) {
      const emails = extractEmails(text);
      if (emails.length > 0) {
        results.email = emails[0];
        results.source = `${platformName} profile`;
        results.method = 'scrape';
        return Response.json(results);
      }
    }
  }

  // ── Strategy 2: AI finds Linktree/website URL, then we fetch & parse it ──
  const linkFinderRes = await base44.integrations.Core.InvokeLLM({
    prompt: `Find the Linktree, personal website, or contact page URL for ${platformName} creator @${handle}.
Search their bio, YouTube channel, Twitter/X, and any public source.
Return the most likely URL to find their business contact email. Return null if nothing found.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        platform_found: { type: 'string' },
      }
    }
  });

  if (linkFinderRes?.url && linkFinderRes.url.startsWith('http')) {
    const pageText = await fetchPageText(linkFinderRes.url);
    if (pageText) {
      const emails = extractEmails(pageText);
      if (emails.length > 0) {
        results.email = emails[0];
        results.source = linkFinderRes.url;
        results.method = 'linktree_fetch';
        return Response.json(results);
      }
    }

    // If page didn't have a raw email, try fetching any linked contact pages
    const contactPageRes = await base44.integrations.Core.InvokeLLM({
      prompt: `This is the content of ${handle}'s website/linktree: "${pageText?.slice(0, 3000)}". 
Extract their business/contact email address. Return null if none found. Do NOT guess.`,
      response_json_schema: {
        type: 'object',
        properties: { email: { type: 'string' } }
      }
    });
    if (contactPageRes?.email?.includes('@')) {
      results.email = contactPageRes.email;
      results.source = linkFinderRes.url;
      results.method = 'page_ai_extract';
      return Response.json(results);
    }
  }

  // ── Strategy 3: Cross-platform deep search (YouTube bio, Twitter, etc.) ──
  const deepSearchRes = await base44.integrations.Core.InvokeLLM({
    prompt: `You must find the real business/contact email for social media creator @${handle} (${platformName}).

Search ALL of these sources:
1. Their YouTube channel "About" page
2. Their Twitter/X bio
3. Their TikTok bio (look for "business" or "collab" emails)  
4. Their Instagram bio
5. Any personal website or blog
6. PR/management contact pages

Look for patterns like: business@, collab@, brand@, pr@, contact@, hello@, [name]@

Return the email if found with HIGH confidence only. Do NOT fabricate or guess.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        email: { type: 'string' },
        source: { type: 'string' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] }
      }
    }
  });

  if (deepSearchRes?.email?.includes('@') && deepSearchRes.confidence !== 'low') {
    results.email = deepSearchRes.email;
    results.source = deepSearchRes.source || 'cross-platform search';
    results.method = 'deep_search';
    return Response.json(results);
  }

  // ── No email found ──
  return Response.json({ email: null, source: null, method: null });
});