import { ExternalLink, TrendingUp, Minus, Sparkles } from "lucide-react";

const SOURCE_CONFIG = {
  aliexpress: { label: 'AliExpress', color: 'bg-orange-500', emoji: '🛒', searchUrl: (kw) => `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(kw)}` },
  alibaba:    { label: 'Alibaba',    color: 'bg-yellow-500', emoji: '🏭', searchUrl: (kw) => `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(kw)}` },
  temu:       { label: 'Temu',       color: 'bg-red-400',    emoji: '🔥', searchUrl: (kw) => `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(kw)}` },
  cj:         { label: 'CJ',         color: 'bg-blue-500',   emoji: '📦', searchUrl: (kw) => `https://cjdropshipping.com/search?q=${encodeURIComponent(kw)}` },
  digital:    { label: 'Digital',    color: 'bg-purple-500', emoji: '💻', searchUrl: null },
  shopify:    { label: 'Shopify',    color: 'bg-green-500',  emoji: '🏪', searchUrl: null },
};

const trendColor = {
  rising: "bg-emerald-100 text-emerald-700",
  peak:   "bg-amber-100 text-amber-700",
  stable: "bg-slate-100 text-slate-600",
};

const nicheColors = [
  "bg-pink-100 text-pink-700","bg-rose-100 text-rose-700","bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700","bg-green-100 text-green-700","bg-amber-100 text-amber-700",
  "bg-teal-100 text-teal-700","bg-indigo-100 text-indigo-700","bg-orange-100 text-orange-700",
];
const nicheColorMap = {};
let colorIdx = 0;
function getNicheColor(niche) {
  if (!nicheColorMap[niche]) nicheColorMap[niche] = nicheColors[colorIdx++ % nicheColors.length];
  return nicheColorMap[niche];
}

export default function ProductsGrid({ products }) {
  if (!products.length) return (
    <div className="text-center py-16 text-slate-400">
      <p className="text-lg font-medium">No products in this category yet</p>
      <p className="text-sm mt-1">Run the AI Research Agent to discover products</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {products.map((p, i) => {
        const srcKey = p._source === 'shopify' && !SOURCE_CONFIG[p.best_source] ? 'shopify' : (p.best_source || 'cj');
        const src = SOURCE_CONFIG[srcKey] || SOURCE_CONFIG.cj;
        const isDigital = p.product_type === 'digital' || p.estimated_cogs === 0;
        const TrendIcon = p.search_trend === 'rising' || p.search_trend === 'peak' ? TrendingUp : Minus;
        const sourceKeywords = isDigital ? [] :
          (p.best_source === 'aliexpress' ? p.aliexpress_keywords :
           p.best_source === 'alibaba'    ? p.alibaba_keywords :
           p.best_source === 'temu'       ? p.temu_keywords :
           p.cj_search_keywords) || [];

        return (
          <div key={i} className="bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow flex flex-col overflow-hidden">
            {/* Status ribbon for non-active Shopify products */}
            {p._source === 'shopify' && p.status && p.status !== 'active' && (
              <div className={`text-xs text-center py-0.5 font-semibold ${p.status === 'draft' ? 'bg-slate-200 text-slate-600' : 'bg-red-100 text-red-600'}`}>
                {p.status.toUpperCase()}
              </div>
            )}

            {/* Image */}
            {p.image_url && (
              <div className="w-full h-36 bg-slate-100 overflow-hidden">
                <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" onError={e => e.target.style.display = 'none'} />
              </div>
            )}

            <div className="p-3 flex flex-col flex-1">
              {/* Badges */}
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full text-white font-bold ${src.color}`}>
                  {src.emoji} {src.label}
                </span>
                {isDigital && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600 text-white font-bold">DIGITAL</span>}
                {p.search_trend && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trendColor[p.search_trend] || trendColor.stable}`}>
                    <TrendIcon className="w-3 h-3 inline mr-0.5" />{p.search_trend}
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-slate-800 text-sm leading-tight mb-1 line-clamp-2">{p.product_name}</h3>

              {(p.region || p.target_audience) && (
                <p className="text-xs text-slate-500 mb-1">{[p.region, p.target_audience].filter(Boolean).join(' · ')}</p>
              )}

              {p.niche && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit mb-2 ${getNicheColor(p.niche)}`}>{p.niche}</span>
              )}

              {/* Pricing */}
              <div className={`grid gap-1 mb-2 text-center ${p.estimated_cogs != null ? 'grid-cols-3' : 'grid-cols-2'}`}>
                {p.estimated_cogs != null && (
                  <div className="bg-slate-50 rounded-lg p-1.5">
                    <p className="text-xs text-slate-400">Cost</p>
                    <p className="text-xs font-bold text-slate-700">{isDigital ? 'FREE' : '$' + p.estimated_cogs}</p>
                  </div>
                )}
                <div className="bg-emerald-50 rounded-lg p-1.5">
                  <p className="text-xs text-emerald-500">Price</p>
                  <p className="text-xs font-bold text-emerald-700">${p.recommended_sell_price}</p>
                </div>
                {p.gross_margin_pct != null && (
                  <div className="bg-violet-50 rounded-lg p-1.5">
                    <p className="text-xs text-violet-500">Margin</p>
                    <p className="text-xs font-bold text-violet-700">{p.gross_margin_pct}%</p>
                  </div>
                )}
              </div>

              {p.why_it_works && <p className="text-xs text-slate-500 italic mb-2 line-clamp-2">{p.why_it_works}</p>}

              {/* Vendor / variants for Shopify products */}
              {p._source === 'shopify' && (
                <div className="text-xs text-slate-400 mb-1">
                  {p.vendor && <span className="font-medium text-slate-500">{p.vendor}</span>}
                  {p.variants_count > 1 && <span className="ml-1.5">{p.variants_count} variants</span>}
                </div>
              )}

              {/* Enriched badge */}
              {p._enriched && (
                <div className="flex items-center gap-1 text-xs text-violet-600 font-semibold mb-2">
                  <Sparkles className="w-3 h-3" /> AI content ready
                </div>
              )}

              {/* Footer: source link */}
              <div className="mt-auto pt-2 border-t border-slate-100">
                {p._source === 'shopify' ? (
                  <a href={`https://admin.shopify.com/products/${p.shopify_id}`}
                    target="_blank" rel="noreferrer"
                    className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1">
                    View in Shopify Admin <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ) : (!isDigital && sourceKeywords.length > 0 && src.searchUrl) ? (
                  <>
                    <p className="text-xs text-slate-400 mb-1">{src.emoji} Source on {src.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {sourceKeywords.slice(0, 2).map(k => (
                        <a key={k} href={src.searchUrl(k)} target="_blank" rel="noreferrer"
                          className="text-xs bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center gap-0.5">
                          {k} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}