/**
 * Agent Research — Automated Market Intelligence
 * Fast, reliable product research without live internet calls (avoids timeouts)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

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
  const monthYear = today.slice(0, 7); // e.g. 2026-04

  // Run both LLM calls in parallel
  const [productResearch, influencerResearch] = await Promise.all([
    base44.integrations.Core.InvokeLLM({
      prompt: `You are a world-class e-commerce trend analyst. Today is ${today} (${monthYear}).

Based on your knowledge of TikTok Shop viral products, Amazon Best Sellers & Movers/Shakers, AliExpress Hot Products, Google Trends, Instagram/TikTok Reels trends, and Shopify trending stores — identify the HOTTEST products selling RIGHT NOW in: ${regionsStr}.
Niches to cover: ${nichesStr}.

ONLY return products with real current sales momentum. No evergreen basics. Think: what are people impulse-buying this month in ${regionsStr}?

Return AT LEAST 20 products (aim for 25), mixing across:
1. PHYSICAL VIRAL — things blowing up on TikTok/Reels, trending on Amazon/AliExpress this month
2. DIGITAL — AI prompt packs, Notion/Canva templates, planners, ebooks, social media templates (COGS = $0)
3. SEASONAL — tied to ${monthYear}, upcoming holidays, or trending events in ${regionsStr}
4. AI / TECH — software tools, presets, filters, apps riding AI hype
5. NICHE COMMUNITY — dominating specific niches or subcultures right now

Rules:
- DIGITAL: estimated_cogs = 0, product_type = "digital"
- PHYSICAL: product_type = "physical"
- Be SPECIFIC with product names (e.g. "Rose Quartz Gua Sha Facial Tool" not just "beauty tool")
- why_it_works must cite a REAL signal (e.g. "50M+ TikTok views", "#2 Amazon Beauty Mover April 2026")

Return ALL these fields per product:
- product_name (specific)
- product_type: "physical" or "digital"
- niche: fashion|beauty|lifestyle|tech|fitness|home|viral|digital|pet|baby|gaming|outdoor|kitchen|wellness|auto
- region: which region it sells best in
- estimated_cogs (USD, 0 for digital)
- recommended_sell_price (USD)
- gross_margin_pct (0-100)
- search_trend: "rising"|"peak"|"stable"
- why_it_works (2 sentences, cite specific trend signal)
- cj_search_keywords (array of 3)
- target_audience
- top_platforms (array)
- image_url (Unsplash or Pexels direct .jpg/.png URL only)
- prevailing_price_low (USD)
- prevailing_price_high (USD)
- price_source (e.g. "Amazon US, TikTok Shop")
- price_strategy (1 sentence on competitive edge)
- price_type: "competitive" or "projected"
- market_summary: overall 2-3 sentence summary of trends across all regions`,
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
                prevailing_price_low: { type: 'number' },
                prevailing_price_high: { type: 'number' },
                price_source: { type: 'string' },
                price_strategy: { type: 'string' },
                price_type: { type: 'string' },
              }
            }
          },
          market_summary: { type: 'string' }
        }
      }
    }),

    base44.integrations.Core.InvokeLLM({
      prompt: `You are an influencer marketing expert. For regions: ${regionsStr} and niches: ${nichesStr}, provide recommended influencer types and regional strategies.`,
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
    }),
  ]);

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