/**
 * bulkGenerateInfluencers
 * Uses AI to generate realistic influencer profiles for the given niches + regions.
 * Saves them to the InfluencerProfile entity as the initial outreach database.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const { niches = [], regions = [], platform = 'both', count = 50 } = await req.json();

  const nichesStr = niches.length ? niches.join(', ') : 'fashion, beauty, lifestyle, tech, fitness, home, pet, baby, gaming, outdoor, kitchen, wellness';
  const regionsStr = regions.length ? regions.join(', ') : 'USA, UK, UAE, Australia, Canada';
  const batchCount = Math.min(count, 100);

  const platforms = platform === 'both' ? ['instagram', 'tiktok'] : [platform];
  const perPlatform = Math.ceil(batchCount / platforms.length);

  const results = await Promise.all(platforms.map(async (pl) => {
    const generated = await base44.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: `Generate ${perPlatform} realistic ${pl} micro-influencer profiles for e-commerce outreach.
Niches: ${nichesStr}. Regions: ${regionsStr}.

Rules:
- Make handles realistic and unique (e.g. glowwithsarah, fitnesswithomar, techreviewsbyalex)
- Follower counts between 8,000 and 250,000
- Engagement rates between 2.5% and 8%
- Generate realistic contact email based on handle (e.g. sarah.glow@gmail.com or collab@glowwithsarah.com)
- Vary niches and regions across the list
- For Instagram: more lifestyle/fashion/beauty
- For TikTok: more viral/trending/entertainment/fitness
- Spread across all provided regions

Return array of profiles. Each profile must have: handle, niche, region, follower_count (integer), engagement_rate (float 0-8), contact_email, bio (1 sentence about their content).`,
      response_json_schema: {
        type: 'object',
        properties: {
          profiles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                handle: { type: 'string' },
                niche: { type: 'string' },
                region: { type: 'string' },
                follower_count: { type: 'number' },
                engagement_rate: { type: 'number' },
                contact_email: { type: 'string' },
                bio: { type: 'string' },
              }
            }
          }
        }
      }
    });

    const profiles = generated.profiles || [];
    const saved = [];

    for (const p of profiles) {
      try {
        const record = await base44.asServiceRole.entities.InfluencerProfile.create({
          platform: pl,
          platform_username: p.handle,
          platform_user_id: `${pl}_${p.handle}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
          follower_count: Math.round(p.follower_count),
          engagement_rate: Math.round(p.engagement_rate * 10) / 10,
          niche: p.niche?.toLowerCase().trim() || 'lifestyle',
          status: 'discovered',
          contact_email: p.contact_email,
          metadata: { bio: p.bio, region: p.region },
        });
        saved.push(record.id);
      } catch (_) {}
    }

    return { platform: pl, generated: profiles.length, saved: saved.length };
  }));

  const totalSaved = results.reduce((s, r) => s + r.saved, 0);

  return Response.json({
    success: true,
    results,
    total_saved: totalSaved,
    niches: nichesStr,
    regions: regionsStr,
  });
});