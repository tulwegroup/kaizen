import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

const trendColor = {
  rising: "bg-emerald-100 text-emerald-700",
  peak: "bg-amber-100 text-amber-700",
  stable: "bg-slate-100 text-slate-600",
};

const trendIcon = {
  rising: TrendingUp,
  peak: TrendingUp,
  stable: Minus,
};

const nicheColor = {
  fashion: "bg-pink-100 text-pink-700",
  beauty: "bg-rose-100 text-rose-700",
  lifestyle: "bg-violet-100 text-violet-700",
  tech: "bg-blue-100 text-blue-700",
  fitness: "bg-green-100 text-green-700",
  home: "bg-amber-100 text-amber-700",
};

export default function ProductCard({ product, rank }) {
  const TrendIcon = trendIcon[product.search_trend] || Minus;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-bold text-slate-400">#{rank}</span>
        <div className="flex gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trendColor[product.search_trend] || 'bg-slate-100 text-slate-600'}`}>
            <TrendIcon className="w-3 h-3 inline mr-0.5" />{product.search_trend}
          </span>
        </div>
      </div>

      <h3 className="font-semibold text-slate-800 text-sm mb-1">{product.product_name}</h3>
      <p className="text-xs text-slate-500 mb-3">{product.region}</p>

      <div className="flex gap-1 flex-wrap mb-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${nicheColor[product.niche] || 'bg-slate-100 text-slate-600'}`}>
          {product.niche}
        </span>
        {(product.top_platforms || []).map(p => (
          <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{p}</span>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-xs text-slate-500">Cost</p>
          <p className="text-sm font-bold text-slate-800">${product.estimated_cogs}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-2">
          <p className="text-xs text-emerald-600">Sell</p>
          <p className="text-sm font-bold text-emerald-700">${product.recommended_sell_price}</p>
        </div>
        <div className="bg-violet-50 rounded-lg p-2">
          <p className="text-xs text-violet-600">Margin</p>
          <p className="text-sm font-bold text-violet-700">{product.gross_margin_pct}%</p>
        </div>
      </div>

      <p className="text-xs text-slate-600 italic mb-2">{product.why_it_works}</p>

      {product.cj_search_keywords?.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1">CJ Search Keywords:</p>
          <div className="flex flex-wrap gap-1">
            {product.cj_search_keywords.map(k => (
              <span key={k} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">{k}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}