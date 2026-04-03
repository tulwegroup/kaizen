/**
 * Agent Research — Automated Market Intelligence
 * Returns 20-25 diverse trending products (physical + digital + viral)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const { regions, niches, budget = 5000, period = '1month' } = await req.json();

  const PERIOD_MULTIPLIERS = { '24h': 1/30, '1week': 7/30, '1month': 1, '3month': 3, '6month': 6, '1year': 12 };
  const PERIOD_LABELS = { '24h': '24 Hours', '1week': '1 Week', '1month': '1 Month', '3month': '3 Months', '6month': '6 Months', '1year': '1 Year' };
  const periodMultiplier = PERIOD_MULTIPLIERS[period] || 1;
  const periodLabel = PERIOD_LABELS[period] || '1 Month';

  if (!regions || regions.length === 0) {
    return Response.json({ error: 'regions array required' }, { status: 400 });
  }

  const existingProfiles = await base44.asServiceRole.entities.InfluencerProfile.list();
  const profileSummary = existingProfiles.map(p =>
    `@${p.platform_username} (${p.platform}, ${p.niche}, ${p.follower_count} followers)`
  ).join('\n');

  const nichesStr = niches && niches.length > 0
    ? niches.join(', ')
    : 'fashion, beauty, lifestyle, tech, fitness, home, viral, digital, pet, baby, gaming, outdoor, kitchen, wellness';
  const regionsStr = regions.join(', ');

  // Phase 1: Research trending products — request 20-25 diverse items
  const productResearch = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a top-tier e-commerce market research agent. Research CURRENT trending products in these regions: ${regionsStr}.
Niches to cover: ${nichesStr}.

CRITICAL: Return AT LEAST 20 products. Aim for 25. Mix them across:

1. PHYSICAL VIRAL PRODUCTS — Things blowing up on TikTok Shop, Amazon, AliExpress RIGHT NOW (e.g. gadgets, beauty tools, home organizers, fashion accessories, LED items, massage tools, kitchen gadgets)
2. DIGITAL PRODUCTS — Zero COGS, 90%+ margin. Examples: AI prompt packs, Notion templates, Canva templates, digital planners, ebooks on trending topics, ChatGPT guides, aesthetic wallpaper packs, social media templates
3. TRENDING CONTENT / AI TOOLS — Products riding viral content trends: AI photo editors, viral filter tools, aesthetic presets, journaling kits, manifestation products, astrology content
4. SEASONAL / HOT RIGHT NOW — Products tied to current season, upcoming holidays, trending events
5. DIGITAL COURSES & GUIDES — "How to make money with X", skincare routines, fitness plans, trading guides — anything trending in the self-improvement/financial space

For DIGITAL products: estimated_cogs = 0, product_type = "digital"
For PHYSICAL products: product_type = "physical"

For EACH product return:
- product_name (specific brand/type, not generic)
- product_type: "physical" or "digital"  
- niche: fashion|beauty|lifestyle|tech|fitness|home|viral|digital|pet|baby|gaming|outdoor|kitchen|wellness|auto
- region: which regions this sells best in
- estimated_cogs: USD (0 for digital)
- recommended_sell_price: USD
- gross_margin_pct: number
- search_trend: "rising"|"peak"|"stable"
- why_it_works: 2 sentences — WHY it's hot right now, what's driving demand
- cj_search_keywords: 3 keywords (for digital: where to sell e.g. "Gumroad, Etsy, Shopify digital")
- target_audience: who buys this
- top_platforms: best social platforms
- image_url: real accessible .jpg/.png/.webp URL`,
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
              product_type: { type: 'string' },
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

  // Phase 2: Influencer landscape (parallel)
  const influencerResearch = await base44.integrations.Core.InvokeLLM({
    prompt: `You are an influencer marketing research agent. For regions: ${regionsStr} and niches: ${nichesStr}, research the influencer landscape.

Existing influencers: 
${profileSummary || 'None yet'}

Provide recommended influencer types and regional strategies.`,
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

  // Phase 3: Profit projections
  const products = productResearch.products || [];

  const NUM_INFLUENCERS = 5;
  const AVG_FOLLOWERS = 50000;
  const BASE_COMMISSION_PCT = 0.15;

  const profitProjections = products.map(product => {
    const isDigital = product.product_type === 'digital' || product.estimated_cogs === 0;
    const sampleCostPerInfluencer = isDigital ? 0 : product.estimated_cogs * 2;
    const totalSampleCost = sampleCostPerInfluencer * NUM_INFLUENCERS;

    const avgEngagement = 0.04;
    const conversionRate = 0.015;
    const estimatedReach = AVG_FOLLOWERS * NUM_INFLUENCERS;
    const estimatedConversions = Math.round(estimatedReach * avgEngagement * conversionRate);

    const commissionPct = BASE_COMMISSION_PCT;
    const scaledConversions = Math.round(estimatedConversions * periodMultiplier);
    const scaledRevenue = scaledConversions * product.recommended_sell_price;
    const scaledCogs = scaledConversions * (product.estimated_cogs || 0);
    const scaledCommission = scaledRevenue * commissionPct;
    const netProfit = scaledRevenue - scaledCogs - totalSampleCost - scaledCommission;
    const totalInvestment = totalSampleCost || 1;
    const roi = ((netProfit / totalInvestment) * 100).toFixed(1);

    return {
      product_name: product.product_name,
      product_type: product.product_type || 'physical',
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
      priority_score: Math.round(
        (product.gross_margin_pct * 0.4) +
        (Number(roi) * 0.3) +
        (product.search_trend === 'rising' ? 20 : product.search_trend === 'peak' ? 12 : 5) +
        (isDigital ? 15 : 0) // bonus for digital (no inventory risk)
      ),
    };
  });

  profitProjections.sort((a, b) => b.priority_score - a.priority_score);

  return Response.json({
    status: 'success',
    regions,
    period,
    period_label: periodLabel,
    niches: nichesStr.split(', '),
    research_date: new Date().toISOString(),
    market_summary: productResearch.market_summary,
    products,
    influencer_landscape: influencerResearch,
    profit_projections: profitProjections,
    top_opportunity: profitProjections[0] || null,
    total_projected_net_profit: profitProjections.reduce((s, p) => s + p.net_profit, 0),
  });
});