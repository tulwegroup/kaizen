import { useState, useEffect } from "react";
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
  ShoppingBag, CheckSquare, Square, Zap, Save, FileStack
} from "lucide-react";
import { Link } from "react-router-dom";

export default function AgentResearch() {
  const [regions, setRegions] = useState([]);
  const [niches, setNiches] = useState([]);
  const [period, setPeriod] = useState('1month');
  const [loading, setLoading] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [savedJobId, setSavedJobId] = useState(null);

  // Multi-select
  const [selected, setSelected] = useState(new Set());
  // Per-product enriched data: { [index]: enrichedObj }
  const [enrichedMap, setEnrichedMap] = useState({});
  // Bulk action states
  const [bulkEnriching, setBulkEnriching] = useState(false);
  const [bulkEnrichProgress, setBulkEnrichProgress] = useState({ current: 0, total: 0 });
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkImportProgress, setBulkImportProgress] = useState({ current: 0, total: 0 });
  const [bulkImportResult, setBulkImportResult] = useState(null);
  const [savingJob, setSavingJob] = useState(false);
  const [jobSaved, setJobSaved] = useState(false);

  // Resume saved job from ImportJobs page
  useEffect(() => {
    const raw = sessionStorage.getItem('resumeJob');
    if (raw) {
      sessionStorage.removeItem('resumeJob');
      const job = JSON.parse(raw);
      setSavedJobId(job.id);
      if (job.regions) setRegions(job.regions);
      if (job.niches) setNiches(job.niches);
      if (job.period) setPeriod(job.period);
      if (job.products_raw) {
        const products = JSON.parse(job.products_raw);
        const enriched = job.enriched_map ? JSON.parse(job.enriched_map) : {};
        const sel = job.selected_indices ? new Set(JSON.parse(job.selected_indices)) : new Set();
        setResult({ products, market_summary: null, profit_projections: [], period_label: job.period, total_projected_net_profit: 0 });
        setEnrichedMap(enriched);
        setSelected(sel);
        setJobSaved(true);
      }
    }
  }, []);

  const run = async () => {
    if (regions.length === 0) return;
    setLoading(true);
    setResult(null);
    setError(null);
    setSelected(new Set());
    setEnrichedMap({});
    setBulkImportResult(null);
    setSavedJobId(null);
    setJobSaved(false);
    setResearchProgress(0);

    let fakeProgress = 0;
    const interval = setInterval(() => {
      fakeProgress += fakeProgress < 80 ? Math.random() * 3 : Math.random() * 0.5;
      if (fakeProgress >= 98) fakeProgress = 98;
      setResearchProgress(Math.round(fakeProgress));
    }, 800);

    const res = await base44.functions.invoke('agentResearch', { regions, niches, period });
    clearInterval(interval);
    setResearchProgress(100);
    setTimeout(() => setResearchProgress(0), 800);

    if (res.data?.status === 'success') {
      setResult(res.data);
    } else {
      setError(res.data?.error || 'Research failed');
    }
    setLoading(false);
  };

  // ── Selection helpers ──
  const toggleSelect = (i) => setSelected(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  const selectAll = () => setSelected(new Set(result.products.map((_, i) => i)));
  const clearAll = () => setSelected(new Set());
  const allSelected = result && selected.size === result.products.length;

  // ── Bulk AI Enrich selected ──
  const bulkEnrich = async () => {
    const indices = [...selected].filter(i => !enrichedMap[i]);
    if (!indices.length) return;
    setBulkEnriching(true);
    setBulkEnrichProgress({ current: 0, total: indices.length });
    for (let idx = 0; idx < indices.length; idx++) {
      const i = indices[idx];
      setBulkEnrichProgress({ current: idx + 1, total: indices.length });
      const res = await base44.functions.invoke('enrichProductWithAI', { product: result.products[i] });
      if (res.data?.success) {
        setEnrichedMap(prev => ({ ...prev, [i]: res.data.enriched }));
      }
    }
    setBulkEnriching(false);
    setBulkEnrichProgress({ current: 0, total: 0 });
  };

  // ── Bulk Import selected ──
  const bulkImport = async () => {
    const indices = [...selected];
    if (!indices.length) return;
    setBulkImporting(true);
    setBulkImportResult(null);
    setBulkImportProgress({ current: 0, total: indices.length });
    let succeeded = 0, failed = 0;
    for (let idx = 0; idx < indices.length; idx++) {
      const i = indices[idx];
      setBulkImportProgress({ current: idx + 1, total: indices.length });
      const p = result.products[i];
      const enriched = enrichedMap[i];
      const productToImport = enriched
        ? { ...p, product_name: enriched.title || p.product_name, description: enriched.body_html, tags: enriched.tags?.join(', '), vendor: enriched.vendor_name, product_type_shopify: enriched.product_type, compare_at_price: enriched.compare_at_price, seo_title: enriched.seo_title, seo_description: enriched.seo_description }
        : p;
      const res = await base44.functions.invoke('importResearchProduct', { product: productToImport });
      res.data?.success ? succeeded++ : failed++;
    }
    setBulkImportResult({ succeeded, failed });
    setBulkImporting(false);
    setBulkImportProgress({ current: 0, total: 0 });
    // Update job if saved
    if (savedJobId) {
      await base44.entities.ImportJob.update(savedJobId, {
        status: failed === 0 ? 'done' : 'partially_done',
        imported_count: succeeded,
        status_note: `${succeeded} imported, ${failed} failed`,
      });
    }
  };

  // ── Save Job ──
  const saveJob = async () => {
    setSavingJob(true);
    const title = `${regions.slice(0, 2).join(', ')} — ${niches.slice(0, 2).join(', ') || 'All niches'} (${new Date().toLocaleDateString()})`;
    const jobData = {
      title,
      source: 'research_agent',
      status: 'draft',
      regions,
      niches,
      period,
      products_raw: JSON.stringify(result.products),
      enriched_map: JSON.stringify(enrichedMap),
      selected_indices: JSON.stringify([...selected]),
      total_count: result.products.length,
      imported_count: bulkImportResult?.succeeded || 0,
    };
    if (savedJobId) {
      await base44.entities.ImportJob.update(savedJobId, jobData);
    } else {
      const created = await base44.entities.ImportJob.create(jobData);
      setSavedJobId(created.id);
    }
    setSavingJob(false);
    setJobSaved(true);
  };

  const topProfit = result?.profit_projections?.[0];
  const enrichedSelectedCount = [...selected].filter(i => enrichedMap[i]).length;
  const unenrichedSelectedCount = selected.size - enrichedSelectedCount;

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
          <Link to="/import-jobs">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FileStack className="w-3.5 h-3.5" /> Drafts & Jobs
            </Button>
          </Link>
        </div>

        {/* Config Panel */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Research Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RegionSelector selected={regions} onChange={setRegions} />
            <NicheSelector selected={niches} onChange={setNiches} />
            <PeriodSelector selected={period} onChange={setPeriod} />
            <Button
              onClick={run}
              disabled={loading || regions.length === 0}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {loading ? (
                <span className="flex items-center gap-2 flex-col w-full">
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    {researchProgress >= 90 ? `Almost done… AI is finalising (${researchProgress}%)` : `Researching trending products… ${researchProgress}%`}
                  </span>
                  <div className="w-full bg-violet-300 rounded-full h-1.5">
                    <div className="bg-white rounded-full h-1.5 transition-all duration-1000" style={{ width: `${researchProgress}%` }} />
                  </div>
                </span>
              ) : (
                <span className="flex items-center gap-2"><Sparkles className="w-4 h-4" /> Run Research Agent</span>
              )}
            </Button>
            {regions.length === 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Select at least one region to start
              </p>
            )}
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4 text-red-700 text-sm">{error}</CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-6">

            {/* Selection + Bulk Action Toolbar */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
              {/* Select controls */}
              <div className="flex items-center gap-2">
                <button onClick={allSelected ? clearAll : selectAll}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-700 hover:text-slate-900">
                  {allSelected ? <CheckSquare className="w-4 h-4 text-violet-600" /> : <Square className="w-4 h-4" />}
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
                {selected.size > 0 && (
                  <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">
                    {selected.size} selected
                  </span>
                )}
              </div>

              <div className="flex-1" />

              {/* Save Job */}
              {result && (
                <Button onClick={saveJob} disabled={savingJob} variant="outline" size="sm" className="gap-1.5">
                  {savingJob ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {jobSaved ? '✓ Saved' : 'Save Session'}
                </Button>
              )}

              {/* Bulk Enrich */}
              {selected.size > 0 && unenrichedSelectedCount > 0 && (
                <div className="flex items-center gap-2">
                  {bulkEnriching && bulkEnrichProgress.total > 0 && (
                    <span className="text-xs text-violet-600">Enriching {bulkEnrichProgress.current}/{bulkEnrichProgress.total}…</span>
                  )}
                  <Button
                    onClick={bulkEnrich}
                    disabled={bulkEnriching}
                    size="sm"
                    className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    {bulkEnriching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    ✨ AI Enrich {unenrichedSelectedCount} Selected
                  </Button>
                </div>
              )}
              {selected.size > 0 && unenrichedSelectedCount === 0 && (
                <span className="text-xs text-violet-600 font-semibold">✅ All selected are enriched</span>
              )}

              {/* Bulk Import */}
              {selected.size > 0 && (
                <div className="flex items-center gap-2">
                  {bulkImporting && bulkImportProgress.total > 0 && (
                    <span className="text-xs text-emerald-600">Importing {bulkImportProgress.current}/{bulkImportProgress.total}…</span>
                  )}
                  {bulkImportResult && (
                    <span className="text-xs text-emerald-700 font-medium">
                      ✓ {bulkImportResult.succeeded} done{bulkImportResult.failed > 0 ? `, ${bulkImportResult.failed} failed` : ''}
                    </span>
                  )}
                  <Button
                    onClick={bulkImport}
                    disabled={bulkImporting}
                    size="sm"
                    className={`gap-1.5 ${enrichedSelectedCount > 0 ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-slate-800 hover:bg-slate-700'} text-white`}
                  >
                    {bulkImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                    🚀 Import {selected.size} to Shopify
                  </Button>
                </div>
              )}
            </div>

            {/* Bulk import progress bar */}
            {bulkImporting && bulkImportProgress.total > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Importing product {bulkImportProgress.current} of {bulkImportProgress.total}…</span>
                  <span>{Math.round((bulkImportProgress.current / bulkImportProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div className="bg-emerald-600 rounded-full h-1.5 transition-all duration-300"
                    style={{ width: `${(bulkImportProgress.current / bulkImportProgress.total) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Period badge */}
            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-3 py-1 rounded-full">
                📅 Projection period: {result.period_label}
              </span>
              <span className="text-xs text-slate-400">{result.research_date ? new Date(result.research_date).toLocaleString() : ''}</span>
            </div>

            {/* Summary KPIs */}
            {result.profit_projections?.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-violet-50 border-violet-100">
                  <CardContent className="pt-4">
                    <p className="text-xs text-violet-500 font-medium uppercase tracking-wide">Products Found</p>
                    <p className="text-3xl font-bold text-violet-700 mt-1">{result.products?.length || 0}</p>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-50 border-emerald-100">
                  <CardContent className="pt-4">
                    <p className="text-xs text-emerald-500 font-medium uppercase tracking-wide">Total Projected Profit</p>
                    <p className="text-3xl font-bold text-emerald-700 mt-1">${result.total_projected_net_profit?.toLocaleString()}</p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-100">
                  <CardContent className="pt-4">
                    <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Top ROI Product</p>
                    <p className="text-lg font-bold text-blue-700 mt-1 leading-tight">{topProfit?.product_name || '—'}</p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50 border-amber-100">
                  <CardContent className="pt-4">
                    <p className="text-xs text-amber-500 font-medium uppercase tracking-wide">Best ROI</p>
                    <p className="text-3xl font-bold text-amber-700 mt-1">{topProfit?.roi_pct || 0}%</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Market Summary */}
            {result.market_summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-600" /> Market Intelligence Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-700 leading-relaxed">{result.market_summary}</p>
                </CardContent>
              </Card>
            )}

            {/* Product Grid with selection */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-600" /> Recommended Products
                <span className="text-sm font-normal text-slate-400">— click checkbox to select for bulk import</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.products?.map((product, i) => (
                  <div key={i} className="relative">
                    {/* Selection overlay checkbox */}
                    <button
                      onClick={() => toggleSelect(i)}
                      className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors shadow-sm
                        ${selected.has(i) ? 'bg-violet-600 border-violet-600' : 'bg-white border-slate-300 hover:border-violet-400'}`}
                    >
                      {selected.has(i) && <CheckSquare className="w-4 h-4 text-white" />}
                    </button>
                    {/* Highlight selected cards */}
                    <div className={`transition-all ${selected.has(i) ? 'ring-2 ring-violet-400 rounded-xl' : ''}`}>
                      <ProductCard
                        product={product}
                        rank={i + 1}
                        externalEnriched={enrichedMap[i]}
                        onEnriched={(data) => setEnrichedMap(prev => ({ ...prev, [i]: data }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Profit Projections Table */}
            {result.profit_projections?.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" /> Profit Projections
                </h2>
                <ProfitTable projections={result.profit_projections} periodLabel={result.period_label} />
              </div>
            )}

            {/* Influencer Landscape */}
            {result.influencer_landscape && (
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" /> Influencer Landscape
                </h2>
                <InfluencerLandscape data={result.influencer_landscape} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}