import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const { niches = [], regions = [], platform = 'both', count = 50 } = await req.json();

  const nichesStr = niches.length ? niches.join(', ') : 'fashion, beauty, lifestyle, tech, fitness, home, pet, baby, gaming, outdoor, kitchen, wellness';
  const regionsStr = regions.length ? regions.join(', ') : 'USA, UK, UAE, Australia, Canada';
  const batchCount = Math.min(count, 1000);

  // Load existing handles to avoid duplicates
  const existingProfiles = await base44.asServiceRole.entities.InfluencerProfile.list('-created_date', 2000);
  const existingHandles = new Set(existingProfiles.map(p => p.platform_username?.toLowerCase().trim()).filter(Boolean));
  const existingCount = existingProfiles.length;
  const sampleExisting = [...existingHandles].slice(0, 30).join(', ');

  const platforms = platform === 'both' ? ['instagram', 'tiktok'] : [platform];
  const perPlatform = Math.ceil(batchCount / platforms.length);

  const results = await Promise.all(platforms.map(async (pl) => {
    const generated = await base44.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: `Generate ${perPlatform} NEW realistic ${pl} micro-influencer profiles for e-commerce outreach.
Niches: ${nichesStr}. Regions: ${regionsStr}.

IMPORTANT: These handles already exist — do NOT reuse them or anything similar: ${sampleExisting || 'none yet'}.
We already have ${existingCount} profiles. Generate completely fresh, unique handles.

Rules:
- Handles must be unique (not similar to existing ones above)
- Follower counts between 8,000 and 500,000
- Engagement rates between 2% and 9%
- Realistic contact email based on handle (e.g. sarah@glowwithsarah.com or handle@gmail.com)
- Spread evenly across niches and regions provided
- Instagram: more lifestyle/fashion/beauty/home
- TikTok: more viral/fitness/trending/entertainment

Each profile: handle, niche, region, follower_count (integer), engagement_rate (float), contact_email, bio (1 sentence).`,
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
    const savedIds = [];

    for (const p of profiles) {
      // Skip if handle already exists
      if (existingHandles.has(p.handle?.toLowerCase().trim())) continue;
      existingHandles.add(p.handle?.toLowerCase().trim()); // prevent duplicates within this batch
      try {
        const record = await base44.asServiceRole.entities.InfluencerProfile.create({
          platform: pl,
          platform_username: p.handle,
          platform_user_id: `${pl}_${p.handle}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          follower_count: Math.round(p.follower_count),
          engagement_rate: Math.round(p.engagement_rate * 10) / 10,
          niche: p.niche?.toLowerCase().trim() || 'lifestyle',
          status: 'discovered',
          contact_email: p.contact_email,
          metadata: { bio: p.bio, region: p.region },
        });
        savedIds.push(record.id);
      } catch (_) {}
    }

    return { platform: pl, generated: profiles.length, saved: savedIds.length };
  }));

  const totalSaved = results.reduce((s, r) => s + r.saved, 0);

  return Response.json({
    success: true,
    results,
    total_saved: totalSaved,
    skipped_duplicates: results.reduce((s, r) => s + (r.generated - r.saved), 0),
    niches: nichesStr,
    regions: regionsStr,
  });
});