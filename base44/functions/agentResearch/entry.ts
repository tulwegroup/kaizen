import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const { regions, niches, period = '1month' } = await req.json();

  const PERIOD_MULTIPLIERS = { '24h': 1/30, '1week': 7/30, '1month': 1, '3month': 3, '6month': 6, '1year': 12 };
  const PERIOD_LABELS = { '24h': '24 Hours', '1week': '1 Week', '1month': '1 Month', '3month': '3 Months', '6month': '6 Months', '1year': '1 Year' };
  const periodMultiplier = PERIOD_MULTIPLIERS[period] || 1;
  const periodLabel = PERIOD_LABELS[period] || '1 Month';

  if (!regions || regions.length === 0) {
    return Response.json({ error: 'regions array required' }, { status: 400 });
  }

  const nichesStr = niches && niches.length > 0
    ? niches.join(', ')
    : 'fashion, beauty, lifestyle, tech, fitness, home, viral, digital, pet, baby, gaming, outdoor, kitchen, wellness';
  const regionsStr = regions.join(', ');
  const today = new Date().toISOString().split('T')[0];
  const monthYear = today.slice(0, 7);

  const [productResearch, influencerResearch] = await Promise.all([
    base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: `E-commerce analyst. Date: ${today}. Regions: ${regionsStr}. Niches: ${nichesStr}.

List 12 hot trending products people are impulse-buying RIGHT NOW. Mix physical viral products and digital products (templates, AI packs, COGS=$0).

Return these fields for each: product_name, product_type (physical/digital), niche, region, estimated_cogs, recommended_sell_price, gross_margin_pct, search_trend (rising/peak/stable), why_it_works (1 sentence + trend signal), cj_search_keywords (3 items), aliexpress_keywords (3 items), alibaba_keywords (3 items), temu_keywords (3 items), best_source (aliexpress/alibaba/temu/cj/digital), source_reason (1 sentence), target_audience, top_platforms (array), price_type (competitive/projected). Also return market_summary (2 sentences).`,
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
                aliexpress_keywords: { type: 'array', items: { type: 'string' } },
                alibaba_keywords: { type: 'array', items: { type: 'string' } },
                temu_keywords: { type: 'array', items: { type: 'string' } },
                best_source: { type: 'string' },
                source_reason: { type: 'string' },
                target_audience: { type: 'string' },
                top_platforms: { type: 'array', items: { type: 'string' } },
                price_type: { type: 'string' },
              }
            }
          },
          market_summary: { type: 'string' }
        }
      }
    }),

    base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'gemini_3_flash',
      prompt: `Influencer marketing expert. Regions: ${regionsStr}. Niches: ${nichesStr}. List 5 recommended influencer types and 3 regional strategies.`,
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
    }),
  ]);

  const products = productResearch.products || [];

  const NUM_INFLUENCERS = 5;
  const AVG_FOLLOWERS = 50000;
  const BASE_COMMISSION_PCT = 0.15;

  const profitProjections = products.map(product => {
    const isDigital = product.product_type === 'digital' || product.estimated_cogs === 0;
    const totalSampleCost = isDigital ? 0 : product.estimated_cogs * 2 * NUM_INFLUENCERS;
    const estimatedConversions = Math.round(AVG_FOLLOWERS * NUM_INFLUENCERS * 0.04 * 0.015);
    const scaledConversions = Math.round(estimatedConversions * periodMultiplier);
    const scaledRevenue = scaledConversions * product.recommended_sell_price;
    const scaledCogs = scaledConversions * (product.estimated_cogs || 0);
    const scaledCommission = scaledRevenue * BASE_COMMISSION_PCT;
    const netProfit = scaledRevenue - scaledCogs - totalSampleCost - scaledCommission;
    const roi = ((netProfit / (totalSampleCost || 1)) * 100).toFixed(1);

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
      commission_pct: Math.round(BASE_COMMISSION_PCT * 100),
      commission_paid: Math.round(scaledCommission),
      net_profit: Math.round(netProfit),
      roi_pct: Number(roi),
      search_trend: product.search_trend,
      priority_score: Math.round(
        (product.gross_margin_pct * 0.4) +
        (Number(roi) * 0.3) +
        (product.search_trend === 'rising' ? 20 : product.search_trend === 'peak' ? 12 : 5) +
        (isDigital ? 15 : 0)
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