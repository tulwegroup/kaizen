import { Card, CardContent } from "@/components/ui/card";

export default function InfluencerLandscape({ data }) {
  if (!data) return null;

  const types = data.recommended_influencer_types || [];
  const strategies = data.regional_strategies || [];

  return (
    <div className="space-y-4">
      {/* Influencer Types */}
      {types.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {types.map((t, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-800">{t.platform}</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t.niche}</span>
              </div>
              <p className="text-xs text-slate-500 mb-3">{t.region}</p>
              <div className="grid grid-cols-2 gap-2 mb-2 text-center">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-xs text-slate-500">Followers</p>
                  <p className="text-xs font-bold text-slate-700">{t.follower_range}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="text-xs text-slate-500">Engagement</p>
                  <p className="text-xs font-bold text-emerald-700">{t.expected_engagement_rate}%</p>
                </div>
              </div>
              <div className="bg-amber-50 rounded-lg p-2 mb-2 text-center">
                <p className="text-xs text-amber-600">Avg Cost/Post</p>
                <p className="text-sm font-bold text-amber-700">${t.avg_cost_per_post}</p>
              </div>
              <p className="text-xs text-slate-600 italic">{t.why_effective}</p>
            </div>
          ))}
        </div>
      )}

      {/* Regional Strategies */}
      {strategies.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Regional Strategies</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {strategies.map((s, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 flex gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 text-sm">{s.region}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Best platform: <span className="font-medium text-blue-600">{s.best_platform}</span></p>
                  <p className="text-xs text-slate-500">Peak time: <span className="font-medium">{s.peak_posting_time}</span></p>
                  <p className="text-xs text-slate-600 mt-1">{s.content_style}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}