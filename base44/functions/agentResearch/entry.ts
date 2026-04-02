/**
 * Agent Research — Automated Market Intelligence
 * Uses LLM + internet context to research trending products & influencer niches
 * by region, then projects profitability for the store.
 *
 * POST / with JSON body:
 *   { regions: string[], niches?: string[], budget?: number }
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const { regions, niches, budget = 5000, period = '1month' } = await req.json();

  // Period multipliers relative to 1-month baseline
  const PERIOD_MULTIPLIERS = { '24h': 1/30, '1week': 7/30, '1month': 1, '3month': 3, '6month': 6, '1year': 12 };
  const PERIOD_LABELS = { '24h': '24 Hours', '1week': '1 Week', '1month': '1 Month', '3month': '3 Months', '6month': '6 Months', '1year': '1 Year' };
  const periodMultiplier = PERIOD_MULTIPLIERS[period] || 1;
  const periodLabel = PERIOD_LABELS[period] || '1 Month';

  if (!regions || regions.length === 0) {
    return Response.json({ error: 'regions array required' }, { status: 400 });
  }

  // Fetch existing influencer profiles to cross-reference
  const existingProfiles = await base44.asServiceRole.entities.InfluencerProfile.list();
  const profileSummary = existingProfiles.map(p =>
    `@${p.platform_username} (${p.platform}, ${p.niche}, ${p.follower_count} followers, engagement ${p.engagement_rate}%)`
  ).join('\n');

  const nichesStr = niches && niches.length > 0 ? niches.join(', ') : 'fashion, beauty, lifestyle, tech, fitness, home';
  const regionsStr = regions.join(', ');

  // Phase 1: Research trending products per region
  const productResearch = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a dropshipping market research agent. Research the current top trending consumer products in these regions: ${regionsStr}.
Focus on these niches: ${nichesStr}.
For each region, identify 3-5 winning products that:
- Are trending now (high search volume, viral on social media)
- Have strong dropshipping margins (typically sourced from CJ Dropshipping or similar)
- Are suitable for influencer marketing campaigns

For each product provide:
- product_name: string
- niche: one of [fashion, beauty, lifestyle, tech, fitness, home]  
- region: which region(s) it's trending in
- estimated_cogs: estimated cost of goods in USD (typical CJ dropship cost)
- recommended_sell_price: USD
- gross_margin_pct: percentage
- search_trend: "rising" | "peak" | "stable"
- why_it_works: 1-2 sentence explanation
- cj_search_keywords: array of 2-3 keywords to search on CJ Dropshipping
- target_audience: brief description
- top_platforms: array of social platforms where this product performs best
- image_url: a real, publicly accessible product image URL (from Amazon, AliExpress, or product sites) ending in .jpg, .jpeg, .png or .webp`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_name: { type: 'string' },
              niche: { type: 'string' },
              region: { type: 'string' },
              estimated_cogs: { type: 'number' },
              recommended_sell_price: { type: 'number' },
              gross_margin_pct: { type: 'number' },
              search_trend: { type: 'string' },
              why_it_works: { type: 'string' },
              cj_search_keywords: { type: 'array', items: { type: 'string' } },
              target_audience: { type: 'string' },
              top_platforms: { type: 'array', items: { type: 'string' } },
              image_url: { type: 'string' },
            }
          }
        },
        market_summary: { type: 'string' }
      }
    }
  });

  // Phase 2: Research influencer landscape per region
  const influencerResearch = await base44.integrations.Core.InvokeLLM({
    prompt: `You are an influencer marketing research agent. For these regions: ${regionsStr} and niches: ${nichesStr}, research the influencer marketing landscape.

Our existing influencers: 
${profileSummary || 'None yet'}

Provide:
1. Recommended influencer profiles to target (realistic micro/macro influencers likely active in these regions/niches)
2. Outreach strategy per region
3. Expected engagement benchmarks

For each recommended influencer type provide realistic details.`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        recommended_influencer_types: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              platform: { type: 'string' },
              niche: { type: 'string' },
              region: { type: 'string' },
              follower_range: { type: 'string' },
              expected_engagement_rate: { type: 'number' },
              avg_cost_per_post: { type: 'number' },
              why_effective: { type: 'string' },
            }
          }
        },
        regional_strategies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              region: { type: 'string' },
              best_platform: { type: 'string' },
              peak_posting_time: { type: 'string' },
              content_style: { type: 'string' },
            }
          }
        }
      }
    }
  });

  // Phase 3: Profit projection — Commission model (no upfront fees, sample + 15% commission)
  const products = productResearch.products || [];
  const influencerTypes = influencerResearch.recommended_influencer_types || [];

  // Commission model config
  const NUM_INFLUENCERS = 5;       // micro-influencers per campaign
  const AVG_FOLLOWERS = 50000;     // mid-point of 10k-200k range
  const BASE_COMMISSION_PCT = 0.15; // 15% sliding scale base

  const profitProjections = products.map(product => {
    // Sample cost: send 2 samples per influencer (1 to keep, 1 to use on camera)
    const sampleCostPerInfluencer = product.estimated_cogs * 2;
    const totalSampleCost = sampleCostPerInfluencer * NUM_INFLUENCERS;

    // Estimate reach & conversions
    // Micro-influencer avg engagement ~4%, conversion rate ~1.5% of engaged
    const avgEngagement = 0.04;
    const conversionRate = 0.015;
    const estimatedReach = AVG_FOLLOWERS * NUM_INFLUENCERS;
    const estimatedConversions = Math.round(estimatedReach * avgEngagement * conversionRate);

    const grossRevenue = estimatedConversions * product.recommended_sell_price;
    const cogs = estimatedConversions * product.estimated_cogs;

    // Sliding commission: base 15%, reduce slightly for higher-volume influencers
    const commissionPct = BASE_COMMISSION_PCT;
    const commissionPaid = grossRevenue * commissionPct;

    // Scale by period
    const scaledConversions = Math.round(estimatedConversions * periodMultiplier);
    const scaledRevenue = scaledConversions * product.recommended_sell_price;
    const scaledCogs = scaledConversions * product.estimated_cogs;
    const scaledCommission = scaledRevenue * commissionPct;
    // Samples are a one-time cost regardless of period
    const netProfit = scaledRevenue - scaledCogs - totalSampleCost - scaledCommission;
    const totalInvestment = totalSampleCost;
    const roi = totalInvestment > 0 ? ((netProfit / totalInvestment) * 100).toFixed(1) : 0;

    return {
      product_name: product.product_name,
      niche: product.niche,
      region: product.region,
      recommended_sell_price: product.recommended_sell_price,
      gross_margin_pct: product.gross_margin_pct,
      num_influencers: NUM_INFLUENCERS,
      estimated_conversions: scaledConversions,
      gross_revenue: Math.round(scaledRevenue),
      cogs_total: Math.round(scaledCogs),
      sample_cost: Math.round(totalSampleCost),
      commission_pct: Math.round(commissionPct * 100),
      commission_paid: Math.round(scaledCommission),
      net_profit: Math.round(netProfit),
      roi_pct: Number(roi),
      search_trend: product.search_trend,
      priority_score: Math.round((product.gross_margin_pct * 0.4) + (Number(roi) * 0.3) + (product.search_trend === 'rising' ? 20 : product.search_trend === 'peak' ? 12 : 5)),
    };
  });

  // Sort by priority score
  profitProjections.sort((a, b) => b.priority_score - a.priority_score);

  return Response.json({
    status: 'success',
    regions,
    period,
    period_label: periodLabel,
    niches: nichesStr.split(', '),
    research_date: new Date().toISOString(),
    market_summary: productResearch.market_summary,
    products: products,
    influencer_landscape: influencerResearch,
    profit_projections: profitProjections,
    top_opportunity: profitProjections[0] || null,
    total_projected_net_profit: profitProjections.reduce((s, p) => s + p.net_profit, 0),
  });
});