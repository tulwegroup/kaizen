/**
 * Global singleton research store.
 * All async work (LLM calls) runs here at module level — outside React.
 * This means navigation CANNOT stop the research. The JS runtime keeps going.
 */
import { base44 } from "@/api/base44Client";

const state = {
  regions: [],
  niches: [],
  period: '1month',
  loading: false,
  researchProgress: 0,
  result: null,
  error: null,
  enrichedMap: {},
  selected: new Set(),
  bulkEnriching: false,
  bulkEnrichProgress: { current: 0, total: 0 },
  bulkImporting: false,
  bulkImportProgress: { current: 0, total: 0 },
  bulkImportResult: null,
  savedJobId: null,
  jobSaved: false,
  savingJob: false,
};

const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn({ ...state, selected: new Set(state.selected), enrichedMap: { ...state.enrichedMap } }));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getState() {
  return { ...state, selected: new Set(state.selected), enrichedMap: { ...state.enrichedMap } };
}

export function setState(patch) {
  Object.assign(state, patch);
  notify();
}

export function setEnrichedForIndex(i, data) {
  state.enrichedMap = { ...state.enrichedMap, [i]: data };
  notify();
}

export function toggleSelected(i) {
  const next = new Set(state.selected);
  next.has(i) ? next.delete(i) : next.add(i);
  state.selected = next;
  notify();
}

export function selectAll(count) {
  state.selected = new Set(Array.from({ length: count }, (_, i) => i));
  notify();
}

export function clearSelected() {
  state.selected = new Set();
  notify();
}

// ─── Core research logic runs here — directly in the browser JS engine ────────
// base44.integrations.Core.InvokeLLM is designed for frontend use.
// Because this runs at MODULE level (not in a React component), React Router
// navigation cannot interrupt it.

export async function runResearch(regions, niches, period) {
  if (state.loading) return;

  const nichesStr = niches && niches.length > 0
    ? niches.join(', ')
    : 'fashion, beauty, lifestyle, tech, fitness, home, viral, digital, pet, baby, gaming, outdoor, kitchen, wellness';
  const regionsStr = regions.join(', ');
  const today = new Date().toISOString().split('T')[0];
  const monthYear = today.slice(0, 7);

  Object.assign(state, {
    loading: true, result: null, error: null,
    researchProgress: 5, bulkImportResult: null,
    savedJobId: null, jobSaved: false,
    selected: new Set(), enrichedMap: {},
    regions, niches, period,
  });
  notify();

  // Fake progress ticker
  const interval = setInterval(() => {
    if (state.researchProgress < 90) {
      state.researchProgress = Math.min(90, state.researchProgress + Math.random() * 3);
      notify();
    }
  }, 900);

  const PERIOD_LABELS = { '24h': '24 Hours', '1week': '1 Week', '1month': '1 Month', '3month': '3 Months', '6month': '6 Months', '1year': '1 Year' };
  const PERIOD_MULTIPLIERS = { '24h': 1/30, '1week': 7/30, '1month': 1, '3month': 3, '6month': 6, '1year': 12 };
  const periodLabel = PERIOD_LABELS[period] || '1 Month';
  const periodMultiplier = PERIOD_MULTIPLIERS[period] || 1;

  // Run both LLM calls in parallel — runs entirely in the browser
  const [productResearch, influencerResearch] = await Promise.all([
    base44.integrations.Core.InvokeLLM({
      prompt: `You are a world-class e-commerce trend analyst. Today is ${today} (${monthYear}).

You have deep knowledge of: TikTok Shop viral products, Amazon Best Sellers & Movers/Shakers, AliExpress Hot Products (via AliDrop), Alibaba trending wholesale items, Temu bestsellers, Google Trends, Instagram/TikTok Reels viral content, and Shopify trending stores.

Identify the HOTTEST products selling RIGHT NOW in: ${regionsStr}.
For each product, identify the BEST sourcing platform: AliExpress (via AliDrop), Alibaba, Temu, CJDropshipping, or digital (self-made).
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
- product_name, product_type, niche, region, estimated_cogs, recommended_sell_price, gross_margin_pct
- search_trend: "rising"|"peak"|"stable"
- why_it_works, cj_search_keywords (array 3), aliexpress_keywords (array 3), alibaba_keywords (array 3), temu_keywords (array 3)
- best_source: "aliexpress"|"alibaba"|"temu"|"cj"|"digital"
- source_reason, target_audience, top_platforms (array), image_url
- prevailing_price_low, prevailing_price_high, price_source, price_strategy, price_type
- market_summary`,
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
                aliexpress_keywords: { type: 'array', items: { type: 'string' } },
                alibaba_keywords: { type: 'array', items: { type: 'string' } },
                temu_keywords: { type: 'array', items: { type: 'string' } },
                best_source: { type: 'string' },
                source_reason: { type: 'string' },
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

  clearInterval(interval);

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

  Object.assign(state, {
    loading: false,
    researchProgress: 100,
    result: {
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
    },
  });
  notify();

  setTimeout(() => { state.researchProgress = 0; notify(); }, 1000);
}

export async function runBulkEnrich() {
  const s = getState();
  const indices = [...s.selected].filter(i => !s.enrichedMap[i]);
  if (!indices.length || state.bulkEnriching) return;
  state.bulkEnriching = true;
  state.bulkEnrichProgress = { current: 0, total: indices.length };
  notify();

  for (let idx = 0; idx < indices.length; idx++) {
    const i = indices[idx];
    state.bulkEnrichProgress = { current: idx + 1, total: indices.length };
    notify();
    const product = state.result.products[i];
    const enriched = await base44.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      prompt: `You are an expert Shopify e-commerce copywriter. Enrich this product for Shopify listing.
Product: ${product.product_name}
Type: ${product.product_type || 'physical'}
Niche: ${product.niche}
Why it works: ${product.why_it_works}
Target audience: ${product.target_audience}
Cost: $${product.estimated_cogs} | Sell: $${product.recommended_sell_price}
Region: ${product.region}

Generate: title (60-80 chars SEO), short_description (2-3 sentences), body_html (400-600 words HTML with h3/p/ul), 
bullet_points (5-7, benefit-first), tags (8-12), compare_at_price (20-40% above sell price),
seo_title (<70 chars), seo_description (<160 chars), product_type (Shopify type), vendor_name,
aliexpress_keywords (3), alibaba_keywords (3), temu_keywords (3).`,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          short_description: { type: 'string' },
          body_html: { type: 'string' },
          bullet_points: { type: 'array', items: { type: 'string' } },
          tags: { type: 'array', items: { type: 'string' } },
          compare_at_price: { type: 'number' },
          seo_title: { type: 'string' },
          seo_description: { type: 'string' },
          product_type: { type: 'string' },
          vendor_name: { type: 'string' },
          aliexpress_keywords: { type: 'array', items: { type: 'string' } },
          alibaba_keywords: { type: 'array', items: { type: 'string' } },
          temu_keywords: { type: 'array', items: { type: 'string' } },
        }
      }
    });
    state.enrichedMap = { ...state.enrichedMap, [i]: enriched };
    notify();
  }

  state.bulkEnriching = false;
  state.bulkEnrichProgress = { current: 0, total: 0 };
  notify();
}

export async function runBulkImport() {
  const s = getState();
  const indices = [...s.selected];
  if (!indices.length || state.bulkImporting) return;
  state.bulkImporting = true;
  state.bulkImportResult = null;
  state.bulkImportProgress = { current: 0, total: indices.length };
  notify();

  let succeeded = 0, failed = 0;
  for (let idx = 0; idx < indices.length; idx++) {
    const i = indices[idx];
    state.bulkImportProgress = { current: idx + 1, total: indices.length };
    notify();
    const p = state.result.products[i];
    const enriched = state.enrichedMap[i];
    const productToImport = enriched
      ? { ...p, product_name: enriched.title || p.product_name, description: enriched.body_html, tags: enriched.tags?.join(', '), vendor: enriched.vendor_name, product_type_shopify: enriched.product_type, compare_at_price: enriched.compare_at_price, seo_title: enriched.seo_title, seo_description: enriched.seo_description }
      : p;
    const res = await base44.functions.invoke('importResearchProduct', { product: productToImport });
    res.data?.success ? succeeded++ : failed++;
  }

  state.bulkImporting = false;
  state.bulkImportProgress = { current: 0, total: 0 };
  state.bulkImportResult = { succeeded, failed };
  notify();

  if (state.savedJobId) {
    await base44.entities.ImportJob.update(state.savedJobId, {
      status: failed === 0 ? 'done' : 'partially_done',
      imported_count: succeeded,
    });
  }
}

export async function saveJob() {
  const s = getState();
  state.savingJob = true;
  notify();

  const title = `${s.regions.slice(0, 2).join(', ')} — ${s.niches.slice(0, 2).join(', ') || 'All niches'} (${new Date().toLocaleDateString()})`;
  const jobData = {
    title, source: 'research_agent', status: 'draft',
    regions: s.regions, niches: s.niches, period: s.period,
    products_raw: JSON.stringify(s.result.products),
    enriched_map: JSON.stringify(s.enrichedMap),
    selected_indices: JSON.stringify([...s.selected]),
    total_count: s.result.products.length,
    imported_count: s.bulkImportResult?.succeeded || 0,
  };

  if (state.savedJobId) {
    await base44.entities.ImportJob.update(state.savedJobId, jobData);
  } else {
    const created = await base44.entities.ImportJob.create(jobData);
    state.savedJobId = created.id;
  }

  state.savingJob = false;
  state.jobSaved = true;
  notify();
}