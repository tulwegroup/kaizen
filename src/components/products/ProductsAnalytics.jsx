import { TrendingUp, DollarSign, Package, Sparkles, ShoppingBag } from "lucide-react";

const SOURCE_CONFIG = {
  aliexpress: { label: 'AliExpress 🛒', badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-400' },
  alibaba:    { label: 'Alibaba 🏭',    badge: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' },
  temu:       { label: 'Temu 🔥',       badge: 'bg-red-100 text-red-700',    bar: 'bg-red-400' },
  cj:         { label: 'CJ Drop 📦',    badge: 'bg-blue-100 text-blue-700',  bar: 'bg-blue-400' },
  digital:    { label: 'Digital 💻',    badge: 'bg-purple-100 text-purple-700', bar: 'bg-purple-400' },
  shopify:    { label: 'Other 🏪',      badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' },
};

export default function ProductsAnalytics({ products }) {
  if (!products.length) return null;

  // For Shopify-sourced products, only show 'shopify' bucket for those we couldn't detect a real source
  const bySource = products.reduce((acc, p) => {
    let s = p.best_source || 'shopify';
    // If a Shopify product has a detectable marketplace source, use it; otherwise 'shopify' = Other
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const byNiche = products.reduce((acc, p) => {
    acc[p.niche] = (acc[p.niche] || 0) + 1;
    return acc;
  }, {});
  const topNiches = Object.entries(byNiche).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const withMargin = products.filter(p => p.gross_margin_pct != null);
  const avgMargin = withMargin.length ? Math.round(withMargin.reduce((s, p) => s + p.gross_margin_pct, 0) / withMargin.length) : null;
  const avgPrice = (products.filter(p => p.recommended_sell_price).reduce((s, p) => s + p.recommended_sell_price, 0) / (products.filter(p => p.recommended_sell_price).length || 1)).toFixed(2);
  const digitalCount = products.filter(p => p.product_type === 'digital' || p.estimated_cogs === 0).length;
  const risingCount = products.filter(p => p.search_trend === 'rising').length;
  const shopifyCount = products.filter(p => p._source === 'shopify').length;
  const activeCount = products.filter(p => p._source === 'shopify' && p.status === 'active').length;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-violet-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Products</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">{products.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Avg Margin</span>
          </div>
          <p className="text-3xl font-bold text-emerald-700">{avgMargin != null ? avgMargin + '%' : '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingBag className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Avg Sell Price</span>
          </div>
          <p className="text-3xl font-bold text-blue-700">${avgPrice}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-rose-500" />
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Trending Rising</span>
          </div>
          <p className="text-3xl font-bold text-rose-600">{risingCount}</p>
        </div>
      </div>

      {/* Source breakdown + niche breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By source */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-slate-400" /> Products by Source
          </h3>
          <div className="space-y-2">
            {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([src, count]) => {
              const cfg = SOURCE_CONFIG[src] || { label: src, badge: 'bg-slate-100 text-slate-600', bar: 'bg-slate-400' };
              return (
                <div key={src} className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full w-32 text-center truncate ${cfg.badge}`}>
                    {cfg.label}
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${cfg.bar}`} style={{ width: `${(count / products.length) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-600 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs text-slate-500"><strong className="text-purple-600">{digitalCount}</strong> digital/zero-COGS products</span>
          </div>
        </div>

        {/* By niche */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-slate-400" /> Top Niches
          </h3>
          <div className="space-y-2">
            {topNiches.map(([niche, count]) => (
              <div key={niche} className="flex items-center gap-2">
                <span className="text-xs text-slate-600 w-24 capitalize truncate">{niche}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-400 rounded-full" style={{ width: `${(count / products.length) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-slate-600 w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}