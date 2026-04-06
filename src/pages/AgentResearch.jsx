import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import RegionSelector from "@/components/agent/RegionSelector";
import PeriodSelector from "@/components/agent/PeriodSelector";
import NicheSelector from "@/components/agent/NicheSelector";
import ProductCard from "@/components/agent/ProductCard";
import ProfitTable from "@/components/agent/ProfitTable";
import InfluencerLandscape from "@/components/agent/InfluencerLandscape";
import {
  Sparkles, TrendingUp, DollarSign, Users, RefreshCw, AlertTriangle,
  ShoppingBag, CheckSquare, Square, Save, FileStack
} from "lucide-react";
import { Link } from "react-router-dom";
import * as store from "@/lib/researchStore";

// ─── All async work runs at module level so navigation can't kill it ────────

async function runResearch(regions, niches, period) {
  if (store.getState().loading) return;
  store.setState({
    loading: true, result: null, error: null,
    researchProgress: 0, bulkImportResult: null,
    savedJobId: null, jobSaved: false,
    selected: new Set(), enrichedMap: {},
    regions, niches, period,
  });

  let fakeProgress = 0;
  const interval = setInterval(() => {
    fakeProgress += fakeProgress < 80 ? Math.random() * 3 : Math.random() * 0.5;
    if (fakeProgress >= 98) fakeProgress = 98;
    store.setState({ researchProgress: Math.round(fakeProgress) });
  }, 800);

  const res = await base44.functions.invoke('agentResearch', { regions, niches, period });
  clearInterval(interval);
  store.setState({ researchProgress: 100 });
  setTimeout(() => store.setState({ researchProgress: 0 }), 800);

  if (res.data?.status === 'success') {
    store.setState({ result: res.data, loading: false });
  } else {
    store.setState({ error: res.data?.error || 'Research failed', loading: false });
  }
}

async function runBulkEnrich() {
  const s = store.getState();
  const indices = [...s.selected].filter(i => !s.enrichedMap[i]);
  if (!indices.length || s.bulkEnriching) return;
  store.setState({ bulkEnriching: true, bulkEnrichProgress: { current: 0, total: indices.length } });
  for (let idx = 0; idx < indices.length; idx++) {
    const i = indices[idx];
    store.setState({ bulkEnrichProgress: { current: idx + 1, total: indices.length } });
    const res = await base44.functions.invoke('enrichProductWithAI', { product: s.result.products[i] });
    if (res.data?.success) store.setEnrichedForIndex(i, res.data.enriched);
  }
  store.setState({ bulkEnriching: false, bulkEnrichProgress: { current: 0, total: 0 } });
}

async function runBulkImport() {
  const s = store.getState();
  const indices = [...s.selected];
  if (!indices.length || s.bulkImporting) return;
  store.setState({ bulkImporting: true, bulkImportResult: null, bulkImportProgress: { current: 0, total: indices.length } });
  let succeeded = 0, failed = 0;
  for (let idx = 0; idx < indices.length; idx++) {
    const i = indices[idx];
    store.setState({ bulkImportProgress: { current: idx + 1, total: indices.length } });
    const p = store.getState().result.products[i];
    const enriched = store.getState().enrichedMap[i];
    const productToImport = enriched
      ? { ...p, product_name: enriched.title || p.product_name, description: enriched.body_html, tags: enriched.tags?.join(', '), vendor: enriched.vendor_name, product_type_shopify: enriched.product_type, compare_at_price: enriched.compare_at_price, seo_title: enriched.seo_title, seo_description: enriched.seo_description }
      : p;
    const res = await base44.functions.invoke('importResearchProduct', { product: productToImport });
    res.data?.success ? succeeded++ : failed++;
  }
  store.setState({ bulkImporting: false, bulkImportProgress: { current: 0, total: 0 }, bulkImportResult: { succeeded, failed } });
  if (store.getState().savedJobId) {
    await base44.entities.ImportJob.update(store.getState().savedJobId, {
      status: failed === 0 ? 'done' : 'partially_done',
      imported_count: succeeded,
    });
  }
}

async function saveJob() {
  const s = store.getState();
  store.setState({ savingJob: true });
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
  if (s.savedJobId) {
    await base44.entities.ImportJob.update(s.savedJobId, jobData);
  } else {
    const created = await base44.entities.ImportJob.create(jobData);
    store.setState({ savedJobId: created.id });
  }
  store.setState({ savingJob: false, jobSaved: true });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AgentResearch() {
  const [s, setS] = useState(store.getState());

  useEffect(() => {
    const unsub = store.subscribe(setS);
    // Resume saved job from ImportJobs page
    const raw = sessionStorage.getItem('resumeJob');
    if (raw) {
      sessionStorage.removeItem('resumeJob');
      const job = JSON.parse(raw);
      const products = job.products_raw ? JSON.parse(job.products_raw) : [];
      const enrichedMap = job.enriched_map ? JSON.parse(job.enriched_map) : {};
      const selected = new Set(job.selected_indices ? JSON.parse(job.selected_indices) : []);
      store.setState({
        regions: job.regions || [],
        niches: job.niches || [],
        period: job.period || '1month',
        result: products.length ? { products, market_summary: null, profit_projections: [], period_label: job.period, total_projected_net_profit: 0 } : null,
        enrichedMap,
        selected,
        savedJobId: job.id,
        jobSaved: true,
      });
    }
    return unsub;
  }, []);

  const topProfit = s.result?.profit_projections?.[0];
  const enrichedSelectedCount = [...s.selected].filter(i => s.enrichedMap[i]).length;
  const unenrichedSelectedCount = s.selected.size - enrichedSelectedCount;
  const allSelected = s.result && s.selected.size === s.result.products.length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <Sparkles className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">AI Market Research Agent</h1>
              <p className="text-sm text-slate-500">Select regions → discover trending products → select, enrich & import</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {s.loading && (
              <span className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-full animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Research running in background…
              </span>
            )}
            <Link to="/import-jobs">
              <Button variant="outline" size="sm" className="gap-1.5">
                <FileStack className="w-3.5 h-3.5" /> Drafts & Jobs
              </Button>
            </Link>
          </div>
        </div>

        {/* Config Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Research Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RegionSelector selected={s.regions} onChange={v => store.setState({ regions: v })} />
            <NicheSelector selected={s.niches} onChange={v => store.setState({ niches: v })} />
            <PeriodSelector selected={s.period} onChange={v => store.setState({ period: v })} />
            <Button
              onClick={() => runResearch(s.regions, s.niches, s.period)}
              disabled={s.loading || s.regions.length === 0}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {s.loading ? (
                <span className="flex items-center gap-2 flex-col w-full">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {s.researchProgress >= 90 ? `Almost done… AI is finalising (${s.researchProgress}%)` : `Researching trending products… ${s.researchProgress}%`}
                  </span>
                  <div className="w-full bg-violet-300 rounded-full h-1.5">
                    <div className="bg-white rounded-full h-1.5 transition-all duration-1000" style={{ width: `${s.researchProgress}%` }} />
                  </div>
                </span>
              ) : (
                <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Run Research Agent</span>
              )}
            </Button>
            {s.regions.length === 0 && !s.loading && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Select at least one region to start
              </p>
            )}
          </CardContent>
        </Card>

        {s.error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4 text-red-700 text-sm">{s.error}</CardContent>
          </Card>
        )}

        {s.result && (
          <div className="space-y-6">
            {/* Toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <button onClick={() => allSelected ? store.clearSelected() : store.selectAll(s.result.products.length)}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900">
                  {allSelected ? <CheckSquare className="w-4 h-4 text-violet-600" /> : <Square className="w-4 h-4" />}
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                {s.selected.size > 0 && (
                  <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">{s.selected.size} selected</span>
                )}
              </div>
              <div className="flex-1" />

              <Button onClick={saveJob} disabled={s.savingJob} variant="outline" size="sm" className="gap-1.5">
                {s.savingJob ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {s.jobSaved ? '✓ Saved' : 'Save Session'}
              </Button>

              {s.selected.size > 0 && unenrichedSelectedCount > 0 && (
                <div className="flex items-center gap-2">
                  {s.bulkEnriching && <span className="text-xs text-violet-600">Enriching {s.bulkEnrichProgress.current}/{s.bulkEnrichProgress.total}…</span>}
                  <Button onClick={runBulkEnrich} disabled={s.bulkEnriching} size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
                    {s.bulkEnriching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    ✨ AI Enrich {unenrichedSelectedCount} Selected
                  </Button>
                </div>
              )}
              {s.selected.size > 0 && unenrichedSelectedCount === 0 && (
                <span className="text-xs text-violet-600 font-semibold">✅ All selected enriched</span>
              )}

              {s.selected.size > 0 && (
                <div className="flex items-center gap-2">
                  {s.bulkImporting && <span className="text-xs text-emerald-600">Importing {s.bulkImportProgress.current}/{s.bulkImportProgress.total}…</span>}
                  {s.bulkImportResult && (
                    <span className="text-xs text-emerald-700 font-medium">
                      ✓ {s.bulkImportResult.succeeded} done{s.bulkImportResult.failed > 0 ? `, ${s.bulkImportResult.failed} failed` : ''}
                    </span>
                  )}
                  <Button onClick={runBulkImport} disabled={s.bulkImporting} size="sm"
                    className={`gap-1.5 ${enrichedSelectedCount > 0 ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-slate-800 hover:bg-slate-700'} text-white`}>
                    {s.bulkImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                    🚀 Import {s.selected.size} to Shopify
                  </Button>
                </div>
              )}
            </div>

            {/* Bulk import progress */}
            {s.bulkImporting && s.bulkImportProgress.total > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Importing {s.bulkImportProgress.current} of {s.bulkImportProgress.total}…</span>
                  <span>{Math.round((s.bulkImportProgress.current / s.bulkImportProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div className="bg-emerald-600 rounded-full h-1.5 transition-all"
                    style={{ width: `${(s.bulkImportProgress.current / s.bulkImportProgress.total) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Period badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-3 py-1 rounded-full">
                📅 {s.result.period_label}
              </span>
              <span className="text-xs text-slate-400">{s.result.research_date ? new Date(s.result.research_date).toLocaleString() : ''}</span>
            </div>

            {/* KPIs */}
            {s.result.profit_projections?.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-violet-50 border-violet-100"><CardContent className="pt-4">
                  <p className="text-xs text-violet-500 font-medium uppercase tracking-wide">Products Found</p>
                  <p className="text-3xl font-bold text-violet-700 mt-1">{s.result.products?.length || 0}</p>
                </CardContent></Card>
                <Card className="bg-emerald-50 border-emerald-100"><CardContent className="pt-4">
                  <p className="text-xs text-emerald-500 font-medium uppercase tracking-wide">Total Projected Profit</p>
                  <p className="text-3xl font-bold text-emerald-700 mt-1">${s.result.total_projected_net_profit?.toLocaleString()}</p>
                </CardContent></Card>
                <Card className="bg-blue-50 border-blue-100"><CardContent className="pt-4">
                  <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Top ROI Product</p>
                  <p className="text-lg font-bold text-blue-700 mt-1 leading-tight">{topProfit?.product_name || '—'}</p>
                </CardContent></Card>
                <Card className="bg-amber-50 border-amber-100"><CardContent className="pt-4">
                  <p className="text-xs text-amber-500 font-medium uppercase tracking-wide">Best ROI</p>
                  <p className="text-3xl font-bold text-amber-700 mt-1">{topProfit?.roi_pct || 0}%</p>
                </CardContent></Card>
              </div>
            )}

            {s.result.market_summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-600" /> Market Intelligence Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700 leading-relaxed">{s.result.market_summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Product Grid */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-600" /> Recommended Products
                <span className="text-sm font-normal text-slate-400">— click checkbox to select</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {s.result.products?.map((product, i) => (
                  <div key={i} className="relative">
                    <button
                      onClick={() => store.toggleSelected(i)}
                      className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shadow-sm
                        ${s.selected.has(i) ? 'bg-violet-600 border-violet-600' : 'bg-white border-slate-300 hover:border-violet-400'}`}
                    >
                      {s.selected.has(i) && <CheckSquare className="w-4 h-4 text-white" />}
                    </button>
                    <div className={`transition-all ${s.selected.has(i) ? 'ring-2 ring-violet-400 rounded-xl' : ''}`}>
                      <ProductCard
                        product={product}
                        rank={i + 1}
                        externalEnriched={s.enrichedMap[i]}
                        onEnriched={(data) => store.setEnrichedForIndex(i, data)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {s.result.profit_projections?.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" /> Profit Projections
                </h2>
                <ProfitTable projections={s.result.profit_projections} periodLabel={s.result.period_label} />
              </div>
            )}

            {s.result.influencer_landscape && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" /> Influencer Landscape
                </h2>
                <InfluencerLandscape data={s.result.influencer_landscape} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}