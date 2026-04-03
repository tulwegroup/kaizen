import { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Minus, ShoppingBag, Check, Loader } from "lucide-react";
import { base44 } from '@/api/base44Client';

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
  digital: "bg-purple-100 text-purple-700",
  viral: "bg-red-100 text-red-700",
  wellness: "bg-teal-100 text-teal-700",
  gaming: "bg-indigo-100 text-indigo-700",
  pet: "bg-orange-100 text-orange-700",
  baby: "bg-yellow-100 text-yellow-700",
  outdoor: "bg-lime-100 text-lime-700",
  kitchen: "bg-amber-100 text-amber-700",
  auto: "bg-slate-100 text-slate-700",
};

export default function ProductCard({ product, rank }) {
  const TrendIcon = trendIcon[product.search_trend] || Minus;
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(null);
  const [importError, setImportError] = useState('');

  const handleImport = async () => {
    setImporting(true);
    setImportError('');
    const res = await base44.functions.invoke('importResearchProduct', { product });
    if (res.data?.success) {
      setImported(res.data);
    } else {
      setImportError(res.data?.error || 'Import failed');
    }
    setImporting(false);
  };

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

      <div className="flex items-start justify-between gap-1 mb-1">
        <h3 className="font-semibold text-slate-800 text-sm">{product.product_name}</h3>
        {product.product_type === 'digital' && (
          <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-purple-600 text-white font-bold">DIGITAL</span>
        )}
      </div>
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
          <p className="text-sm font-bold text-slate-800">{product.estimated_cogs === 0 ? 'FREE' : '$' + product.estimated_cogs}</p>
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

      {/* Price Intelligence */}
      {(product.prevailing_price_low || product.price_strategy) && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-3">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${product.price_type === 'competitive' ? 'bg-blue-600 text-white' : 'bg-slate-400 text-white'}`}>
              {product.price_type === 'competitive' ? '📊 SURVEYED' : '📐 PROJECTED'}
            </span>
            {product.prevailing_price_low && (
              <span className="text-xs text-slate-500">Market: ${product.prevailing_price_low}–${product.prevailing_price_high}</span>
            )}
          </div>
          {product.price_strategy && <p className="text-xs text-blue-700 font-medium">{product.price_strategy}</p>}
          {product.price_source && <p className="text-xs text-slate-400 mt-0.5">Source: {product.price_source}</p>}
        </div>
      )}

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

      {/* Import to Shopify */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        {imported ? (
          <a href={imported.shopify_admin_url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
            <Check className="w-3.5 h-3.5" /> {imported.already_exists ? 'Already in Shopify ↗' : 'Imported to Shopify ↗'}
          </a>
        ) : (
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full flex items-center justify-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {importing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
            {importing ? 'Creating product in Shopify…' : 'Import to Shopify'}
          </button>
        )}
        {importError && <p className="text-xs text-red-500 mt-1">{importError}</p>}
      </div>
    </div>
  );
}