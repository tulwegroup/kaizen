import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Sparkles, RefreshCw, Check, Users, Instagram, Music } from "lucide-react";
import { Button } from "@/components/ui/button";

const NICHES = ["fashion", "beauty", "lifestyle", "tech", "fitness", "home", "pet", "baby", "gaming", "outdoor", "kitchen", "wellness", "viral", "digital"];
const REGIONS = ["USA", "UK", "UAE", "Australia", "Canada", "Germany", "France", "Netherlands", "Saudi Arabia", "Egypt", "Pakistan", "India", "South Africa", "Nigeria", "Mexico", "Brazil", "Singapore", "Malaysia", "Philippines"];
const COUNTS = [25, 50, 100, 500, 1000];

export default function GenerateInfluencers() {
  const [selectedNiches, setSelectedNiches] = useState(["beauty", "fashion", "lifestyle", "fitness"]);
  const [selectedRegions, setSelectedRegions] = useState(["USA", "UK", "UAE", "Australia"]);
  const [platform, setPlatform] = useState("both");
  const [count, setCount] = useState(50);
  const [existingCount, setExistingCount] = useState(null);

  useEffect(() => {
    base44.entities.InfluencerProfile.list('-created_date', 1).then(data => {
      // Get total by listing all (we just need count hint)
      base44.entities.InfluencerProfile.filter({}, '-created_date', 2000).then(all => setExistingCount(all.length)).catch(() => {});
    }).catch(() => {});
  }, []);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const toggle = (arr, setArr, val) =>
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);

  const generate = async () => {
    if (!selectedNiches.length || !selectedRegions.length) return;
    setLoading(true);
    setResult(null);
    // For large counts, run in batches to avoid timeout
    const batchSize = count > 100 ? 100 : count;
    const batches = Math.ceil(count / batchSize);
    let totalSaved = 0;
    const allResults = [];
    for (let i = 0; i < batches; i++) {
      const res = await base44.functions.invoke('bulkGenerateInfluencers', {
        niches: selectedNiches,
        regions: selectedRegions,
        platform,
        count: batchSize,
      });
      if (res.data?.total_saved) totalSaved += res.data.total_saved;
      if (res.data?.results) allResults.push(...res.data.results);
    }
    setResult({ total_saved: totalSaved, results: allResults });
    setExistingCount(prev => (prev || 0) + totalSaved);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-bold text-slate-800 mb-1">Generate Influencer Database</h2>
        <div className="flex items-center gap-3 mb-5">
          <p className="text-sm text-slate-500 flex-1">AI generates realistic influencer profiles for your target niches and regions. Existing handles are automatically skipped to avoid duplicates.</p>
          {existingCount !== null && (
            <div className="shrink-0 bg-slate-100 rounded-xl px-3 py-2 text-center">
              <p className="text-lg font-bold text-slate-700">{existingCount.toLocaleString()}</p>
              <p className="text-xs text-slate-400">in database</p>
            </div>
          )}
        </div>

        {/* Platform */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Platform</p>
          <div className="flex gap-2">
            {[{ v: "both", l: "Both Platforms", icon: "✨" }, { v: "instagram", l: "Instagram only", icon: "📸" }, { v: "tiktok", l: "TikTok only", icon: "🎵" }].map(({ v, l, icon }) => (
              <button key={v} onClick={() => setPlatform(v)}
                className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border font-medium transition-colors
                  ${platform === v ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                {icon} {l}
              </button>
            ))}
          </div>
        </div>

        {/* Niches */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Niches</p>
          <div className="flex flex-wrap gap-2">
            {NICHES.map(n => (
              <button key={n} onClick={() => toggle(selectedNiches, setSelectedNiches, n)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors capitalize
                  ${selectedNiches.includes(n) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Regions */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Regions</p>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map(r => (
              <button key={r} onClick={() => toggle(selectedRegions, setSelectedRegions, r)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors
                  ${selectedRegions.includes(r) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">How many profiles to generate?</p>
          <div className="flex gap-2">
            {COUNTS.map(c => (
              <button key={c} onClick={() => setCount(c)}
                className={`text-sm px-4 py-2 rounded-lg border font-medium transition-colors
                  ${count === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                {c >= 1000 ? '1,000' : c} profiles
              </button>
            ))}
          </div>
        </div>

        <Button onClick={generate} disabled={loading || !selectedNiches.length || !selectedRegions.length}
          className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white h-11">
          {loading ? <><RefreshCw className="w-4 h-4 animate-spin" />Generating influencer profiles…</> : <><Sparkles className="w-4 h-4" />Generate {count} Influencer Profiles</>}
        </Button>
      </div>

      {result && (
        <div className="bg-white rounded-xl border border-emerald-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Check className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-800">Generation Complete!</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-emerald-50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{result.total_saved}</p>
              <p className="text-xs text-emerald-600 mt-1">Total Saved</p>
            </div>
            {result.results?.map(r => (
              <div key={r.platform} className="bg-slate-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-slate-700">{r.saved}</p>
                <p className="text-xs text-slate-500 mt-1 capitalize">{r.platform} profiles</p>
              </div>
            ))}
          </div>
          {result.skipped_duplicates > 0 && (
            <p className="text-xs text-amber-600 mt-2">⚠️ {result.skipped_duplicates} duplicate handles were automatically skipped.</p>
          )}
          <p className="text-sm text-slate-500">Profiles saved to your InfluencerProfile database. Go to <strong>Bulk Email Blast</strong> tab to start outreach.</p>
        </div>
      )}
    </div>
  );
}