import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RegionSelector from "@/components/agent/RegionSelector";
import PeriodSelector from "@/components/agent/PeriodSelector";
import NicheSelector from "@/components/agent/NicheSelector";
import ProductCard from "@/components/agent/ProductCard";
import ProfitTable from "@/components/agent/ProfitTable";
import InfluencerLandscape from "@/components/agent/InfluencerLandscape";
import { Sparkles, TrendingUp, DollarSign, Users, RefreshCw, AlertTriangle, ShoppingBag } from "lucide-react";

export default function AgentResearch() {
  const [regions, setRegions] = useState([]);
  const [niches, setNiches] = useState([]);
  const [period, setPeriod] = useState('1month');
  const [importingAll, setImportingAll] = useState(false);
  const [importAllResult, setImportAllResult] = useState(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [researchProgress, setResearchProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const importAll = async () => {
    if (!result?.products?.length) return;
    setImportingAll(true);
    setImportAllResult(null);
    setImportProgress({ current: 0, total: result.products.length });
    let succeeded = 0, failed = 0;
    for (let i = 0; i < result.products.length; i++) {
      setImportProgress({ current: i + 1, total: result.products.length });
      const res = await base44.functions.invoke('importResearchProduct', { product: result.products[i] });
      if (res.data?.success) succeeded++;
      else failed++;
    }
    setImportAllResult({ succeeded, failed });
    setImportingAll(false);
    setImportProgress({ current: 0, total: 0 });
  };

  const run = async () => {
    if (regions.length === 0) return;
    setLoading(true);
    setResult(null);
    setError(null);
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

  const topProfit = result?.profit_projections?.[0];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <Sparkles className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Market Research Agent</h1>
            <p className="text-sm text-slate-500">Select target regions — agents will research trending products, influencers & profit projections</p>
          </div>
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
                    {researchProgress >= 90
                      ? `Almost done… AI is finalising results (${researchProgress}%)`
                      : `Researching trending products… ${researchProgress}%`}
                  </span>
                  <div className="w-full bg-violet-300 rounded-full h-1.5">
                    <div
                      className="bg-white rounded-full h-1.5 transition-all duration-1000"
                      style={{ width: `${researchProgress}%` }}
                    />
                  </div>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Run Research Agent
                </span>
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
        {/* Import All Banner */}
        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-800">Import all {result.products?.length} products to Shopify</p>
            <p className="text-xs text-slate-500">Creates all products as drafts with images, descriptions & inventory</p>
            {importingAll && importProgress.total > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Importing product {importProgress.current} of {importProgress.total}…</span>
                  <span>{Math.round((importProgress.current / importProgress.total) * 100)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5">
                  <div
                    className="bg-slate-800 rounded-full h-1.5 transition-all duration-300"
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 ml-4">
            {importAllResult && (
              <p className="text-xs text-emerald-700 font-medium">
                ✓ {importAllResult.succeeded} imported{importAllResult.failed > 0 ? `, ${importAllResult.failed} failed` : ''}
              </p>
            )}
            <Button
              onClick={importAll}
              disabled={importingAll}
              className="bg-slate-800 hover:bg-slate-700 text-white text-sm"
            >
              {importingAll ? (
                <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" /> Importing…</span>
              ) : (
                <span className="flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Import All to Shopify</span>
              )}
            </Button>
          </div>
        </div>

        {/* Period badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-3 py-1 rounded-full">
            📅 Projection period: {result.period_label}
          </span>
          <span className="text-xs text-slate-400">{result.research_date ? new Date(result.research_date).toLocaleString() : ''}</span>
        </div>
            {/* Summary KPIs */}
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

            {/* Product Recommendations */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-600" /> Recommended Products for Your Store
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.products?.map((product, i) => (
                  <ProductCard key={i} product={product} rank={i + 1} />
                ))}
              </div>
            </div>

            {/* Profit Projections Table */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" /> Profit Projections
              </h2>
              <ProfitTable projections={result.profit_projections} periodLabel={result.period_label} />
            </div>

            {/* Influencer Landscape */}
            <div>
              <h2 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" /> Influencer Landscape
              </h2>
              <InfluencerLandscape data={result.influencer_landscape} />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}