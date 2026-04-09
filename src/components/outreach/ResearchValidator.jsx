import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { ShieldCheck, RefreshCw, CheckCircle, AlertTriangle, XCircle, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const VERDICT_CONFIG = {
  VALIDATED:   { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle,    iconColor: "text-emerald-600" },
  PLAUSIBLE:   { color: "bg-blue-100 text-blue-700 border-blue-200",          icon: CheckCircle,    iconColor: "text-blue-500" },
  SUSPECT:     { color: "bg-amber-100 text-amber-700 border-amber-200",       icon: AlertTriangle,  iconColor: "text-amber-500" },
  HALLUCINATED:{ color: "bg-red-100 text-red-700 border-red-200",             icon: XCircle,        iconColor: "text-red-500" },
};

export default function ResearchValidator() {
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [loadingJobs, setLoadingJobs] = useState(true);

  useEffect(() => {
    base44.entities.ImportJob.list('-created_date', 20).then(data => {
      setJobs(data.filter(j => j.products_raw));
      setLoadingJobs(false);
    });
  }, []);

  const validate = async () => {
    if (!selectedJobId) return;
    setLoading(true);
    setResult(null);
    const res = await base44.functions.invoke('validateResearch', { job_id: selectedJobId });
    setResult(res.data);
    setLoading(false);
  };

  const score = result?.overall_quality_score || 0;
  const scoreColor = score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-bold text-slate-800 mb-1">Research Accuracy Validator</h2>
        <p className="text-sm text-slate-500 mb-5">
          Cross-checks AI-generated product research against real internet data to flag hallucinations, verify trend signals, and validate pricing accuracy.
        </p>

        {loadingJobs ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading research sessions…
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400">
            <p className="font-medium">No research sessions found</p>
            <p className="text-sm mt-1">Run the AI Research Agent first, then save the job.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-2">Select Research Session to Validate</label>
              <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300">
                <option value="">— Choose a session —</option>
                {jobs.map(j => {
                  const count = j.products_raw ? JSON.parse(j.products_raw).length : 0;
                  return (
                    <option key={j.id} value={j.id}>{j.title} ({count} products)</option>
                  );
                })}
              </select>
            </div>

            <Button onClick={validate} disabled={loading || !selectedJobId}
              className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white h-11">
              {loading
                ? <><RefreshCw className="w-4 h-4 animate-spin" />Validating with live internet data…</>
                : <><ShieldCheck className="w-4 h-4" />Validate Research Accuracy</>}
            </Button>
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-4">
          {/* Score summary */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800">Validation Report</h3>
              <div className={`text-3xl font-black ${scoreColor}`}>{Math.round(score)}/100</div>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div className={`h-full rounded-full transition-all ${score >= 75 ? 'bg-emerald-500' : score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${score}%` }} />
            </div>
            <p className="text-sm text-slate-600 mb-4 italic">{result.validation_summary}</p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 rounded-xl p-3">
                <p className="text-xl font-bold text-emerald-700">{result.validated_count || 0}</p>
                <p className="text-xs text-emerald-600">Validated</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xl font-bold text-amber-600">{result.suspect_count || 0}</p>
                <p className="text-xs text-amber-500">Suspect</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3">
                <p className="text-xl font-bold text-red-600">{result.hallucinated_count || 0}</p>
                <p className="text-xs text-red-500">Hallucinated</p>
              </div>
            </div>
          </div>

          {/* Per-product results */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-800 mb-4">Product-by-Product Breakdown</h3>
            <div className="space-y-3">
              {(result.products || []).map((p, i) => {
                const cfg = VERDICT_CONFIG[p.verdict] || VERDICT_CONFIG.PLAUSIBLE;
                const Icon = cfg.icon;
                return (
                  <div key={i} className={`rounded-xl border p-4 ${cfg.color}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.iconColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">{p.product_name}</span>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white bg-opacity-60">{p.verdict}</span>
                        </div>
                        <div className="flex gap-3 text-xs opacity-80 mb-1 flex-wrap">
                          <span>{p.real_product ? '✅ Real product' : '❌ Questionable product'}</span>
                          <span>{p.trend_accurate ? '✅ Trend ok' : '⚠️ Trend suspect'}</span>
                          <span>{p.pricing_realistic ? '✅ Pricing ok' : '⚠️ Pricing off'}</span>
                          <span>{p.signal_credible ? '✅ Signal real' : '⚠️ Signal weak'}</span>
                        </div>
                        {p.notes && <p className="text-xs mt-1 opacity-90">{p.notes}</p>}
                        {p.real_examples && <p className="text-xs mt-1 opacity-70 italic">Real: {p.real_examples}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}