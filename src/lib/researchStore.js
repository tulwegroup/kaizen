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

// ─── Core research logic — delegates to backend function ────────────────────

export async function runResearch(regions, niches, period) {
  if (state.loading) return;

  Object.assign(state, {
    loading: true, result: null, error: null,
    researchProgress: 5, bulkImportResult: null,
    savedJobId: null, jobSaved: false,
    selected: new Set(), enrichedMap: {},
    regions, niches, period,
  });
  notify();

  // Smooth progress ticker — caps at 88% until backend responds
  const interval = setInterval(() => {
    if (state.researchProgress < 88) {
      state.researchProgress = Math.min(88, state.researchProgress + Math.random() * 4);
      notify();
    }
  }, 800);

  // Hard timeout: 120 seconds
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Research timed out. Please try again.')), 120000)
  );

  try {
    const res = await Promise.race([
      base44.functions.invoke('agentResearch', { regions, niches, period }),
      timeoutPromise,
    ]);

    clearInterval(interval);

    if (!res.data || res.data.error) {
      throw new Error(res.data?.error || 'Research failed — please try again.');
    }

    Object.assign(state, {
      loading: false,
      researchProgress: 100,
      result: res.data,
    });
    notify();
    setTimeout(() => { state.researchProgress = 0; notify(); }, 1000);

  } catch (err) {
    clearInterval(interval);
    Object.assign(state, {
      loading: false,
      researchProgress: 0,
      error: err.message || 'Research failed. Please try again.',
    });
    notify();
  }
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