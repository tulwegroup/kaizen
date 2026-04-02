import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RegionSelector from "@/components/agent/RegionSelector";
import NicheSelector from "@/components/agent/NicheSelector";
import ProductCard from "@/components/agent/ProductCard";
import ProfitTable from "@/components/agent/ProfitTable";
import InfluencerLandscape from "@/components/agent/InfluencerLandscape";
import { Sparkles, TrendingUp, DollarSign, Users, RefreshCw, AlertTriangle } from "lucide-react";

export default function AgentResearch() {
  const [regions, setRegions] = useState([]);
  const [niches, setNiches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    if (regions.length === 0) return;
    setLoading(true);
    setResult(null);
    setError(null);
    const res = await base44.functions.invoke('agentResearch', { regions, niches });
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
            <Button
              onClick={run}
              disabled={loading || regions.length === 0}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Agents researching… this takes ~30 seconds
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
              <ProfitTable projections={result.profit_projections} />
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