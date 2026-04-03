import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import RegionSelector from "@/components/agent/RegionSelector";
import NicheSelector from "@/components/agent/NicheSelector";
import PeriodSelector from "@/components/agent/PeriodSelector";
import { Zap, ChevronLeft, CheckCircle, XCircle, Loader, Clock, ArrowRight, ShoppingBag, Users, Sparkles } from "lucide-react";

const STEPS = [
  { key: "research", icon: Sparkles, label: "AI Research", color: "text-violet-600 bg-violet-100" },
  { key: "shopify", icon: ShoppingBag, label: "Shopify Import", color: "text-emerald-600 bg-emerald-100" },
  { key: "outreach", icon: Users, label: "Influencer Outreach", color: "text-blue-600 bg-blue-100" },
];

const STATUS_ICON = {
  running: <Loader className="w-4 h-4 animate-spin text-amber-500" />,
  done: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  complete: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  failed: <XCircle className="w-4 h-4 text-red-500" />,
  skipped: <Clock className="w-4 h-4 text-slate-400" />,
};

export default function AutomatedPipeline() {
  const [regions, setRegions] = useState([]);
  const [niches, setNiches] = useState([]);
  const [period, setPeriod] = useState("1month");
  const [maxProducts, setMaxProducts] = useState(3);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const run = async () => {
    if (!regions.length) return;
    setRunning(true);
    setResult(null);
    setError(null);
    const res = await base44.functions.invoke("automatedPipeline", {
      regions, niches, period, max_products: maxProducts, max_influencers_per_product: 3,
    });
    if (res.data?.success) {
      setResult(res.data);
    } else {
      setError(res.data?.log?.find(l => l.status === "failed")?.message || "Pipeline failed");
    }
    setRunning(false);
  };

  // Group logs by step for display
  const stepLogs = (stepKey) => (result?.log || []).filter(l => l.step === stepKey);
  const stepStatus = (stepKey) => {
    const logs = stepLogs(stepKey);
    if (!logs.length) return "pending";
    if (logs.some(l => l.status === "failed")) return "failed";
    if (logs.some(l => l.status === "complete" || l.status === "done")) return "done";
    if (logs.some(l => l.status === "skipped")) return "skipped";
    return "running";
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="p-2 bg-slate-900 rounded-xl">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Automated Pipeline</h1>
            <p className="text-sm text-slate-500">Research → Shopify → Influencer Outreach, fully automated</p>
          </div>
        </div>

        {/* Pipeline visual */}
        <div className="flex items-center gap-2">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-2 flex-1">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white flex-1 justify-center`}>
                  <div className={`p-1.5 rounded-lg ${step.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{step.label}</span>
                </div>
                {i < STEPS.length - 1 && <ArrowRight className="w-4 h-4 text-slate-300 flex-shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Config */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Pipeline Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RegionSelector selected={regions} onChange={setRegions} />
            <NicheSelector selected={niches} onChange={setNiches} />
            <PeriodSelector selected={period} onChange={setPeriod} />

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Max Products to Import</p>
              <div className="flex gap-2">
                {[2, 3, 5, 8, 10].map(n => (
                  <button key={n} onClick={() => setMaxProducts(n)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${maxProducts === n ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={run}
              disabled={running || !regions.length}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11"
            >
              {running ? (
                <span className="flex items-center gap-2"><Loader className="w-4 h-4 animate-spin" /> Pipeline running… (this takes ~1 minute)</span>
              ) : (
                <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Launch Full Pipeline</span>
              )}
            </Button>
          </CardContent>
        </Card>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-4 text-red-700 text-sm">{error}</CardContent>
          </Card>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Summary KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Products Found", value: result.summary.products_researched, color: "text-violet-700 bg-violet-50 border-violet-100" },
                { label: "Imported to Shopify", value: result.summary.products_imported, color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
                { label: "Influencers Contacted", value: result.summary.influencers_contacted, color: "text-blue-700 bg-blue-50 border-blue-100" },
                { label: "Campaigns Created", value: result.summary.campaigns_created, color: "text-amber-700 bg-amber-50 border-amber-100" },
              ].map(kpi => (
                <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.color}`}>
                  <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{kpi.label}</p>
                  <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Step logs */}
            {STEPS.map(step => {
              const logs = stepLogs(step.key);
              if (!logs.length) return null;
              const status = stepStatus(step.key);
              const Icon = step.icon;
              return (
                <Card key={step.key}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <div className={`p-1.5 rounded-lg ${step.color}`}><Icon className="w-4 h-4" /></div>
                      {step.label}
                      {STATUS_ICON[status]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {logs.map((entry, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 flex-shrink-0">{STATUS_ICON[entry.status] || <span className="w-4 h-4" />}</span>
                          <span className={entry.status === 'failed' ? 'text-red-600' : 'text-slate-700'}>{entry.message}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Campaigns created */}
            {result.campaigns?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Campaigns Created</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result.campaigns.map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium text-slate-800">{c.product}</span>
                        <span className="text-blue-600">@{c.influencer}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link to="/influencer-crm">
                      <Button variant="outline" size="sm">View in CRM →</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}