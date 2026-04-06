import { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Minus, ShoppingBag, Check, Loader, Sparkles, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { base44 } from '@/api/base44Client';

const trendColor = {
  rising: "bg-emerald-100 text-emerald-700",
  peak: "bg-amber-100 text-amber-700",
  stable: "bg-slate-100 text-slate-600",
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

const SOURCE_CONFIG = {
  aliexpress: { label: 'AliExpress', color: 'bg-orange-500', emoji: '🛒', searchUrl: (kw) => `https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(kw)}` },
  alibaba: { label: 'Alibaba', color: 'bg-yellow-500', emoji: '🏭', searchUrl: (kw) => `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(kw)}` },
  temu: { label: 'Temu', color: 'bg-orange-400', emoji: '🔥', searchUrl: (kw) => `https://www.temu.com/search_result.html?search_key=${encodeURIComponent(kw)}` },
  cj: { label: 'CJDropshipping', color: 'bg-blue-500', emoji: '📦', searchUrl: (kw) => `https://cjdropshipping.com/search?q=${encodeURIComponent(kw)}` },
  digital: { label: 'Digital', color: 'bg-purple-500', emoji: '💻', searchUrl: null },
};

export default function ProductCard({ product, rank, externalEnriched, onEnriched }) {
  const TrendIcon = product.search_trend === 'rising' || product.search_trend === 'peak' ? TrendingUp : Minus;
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(null);
  const [importError, setImportError] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [enriched, setEnriched] = useState(externalEnriched || null);
  const [showEnriched, setShowEnriched] = useState(false);

  // Sync external enriched data (from bulk enrich)
  if (externalEnriched && !enriched) {
    setEnriched(externalEnriched);
  }

  const displayImage = enriched?.image_url || product.image_url;

  const source = SOURCE_CONFIG[product.best_source] || SOURCE_CONFIG.cj;
  const isDigital = product.product_type === 'digital' || product.estimated_cogs === 0;

  const handleEnrich = async () => {
    setEnriching(true);
    const res = await base44.functions.invoke('enrichProductWithAI', { product });
    if (res.data?.success) {
      setEnriched(res.data.enriched);
      setShowEnriched(true);
      if (onEnriched) onEnriched(res.data.enriched);
    }
    setEnriching(false);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportError('');
    // Merge enriched data into product if available
    const productToImport = enriched
      ? {
          ...product,
          product_name: enriched.title || product.product_name,
          description: enriched.body_html,
          tags: enriched.tags?.join(', '),
          vendor: enriched.vendor_name,
          product_type_shopify: enriched.product_type,
          compare_at_price: enriched.compare_at_price,
          seo_title: enriched.seo_title,
          seo_description: enriched.seo_description,
        }
      : product;
    const res = await base44.functions.invoke('importResearchProduct', { product: productToImport });
    if (res.data?.success) {
      setImported(res.data);
    } else {
      setImportError(res.data?.error || 'Import failed');
    }
    setImporting(false);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 hover:shadow-md transition-shadow flex flex-col">
      {/* Image */}
      <div className="w-full h-40 rounded-t-xl overflow-hidden bg-slate-100">
        {displayImage ? (
          <img src={displayImage} alt={product.product_name} className="w-full h-full object-cover"
            onError={e => { e.target.src = `https://source.unsplash.com/400x400/?${encodeURIComponent(product.niche || 'product')}`; }} />
        ) : (
          <img src={`https://source.unsplash.com/400x400/?${encodeURIComponent((product.product_name || '').split(' ').slice(0,3).join(' '))}`}
            alt={product.product_name} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="p-4 flex flex-col flex-1">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <span className="text-xs font-bold text-slate-400">#{rank}</span>
          <div className="flex gap-1 flex-wrap justify-end">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${trendColor[product.search_trend] || 'bg-slate-100 text-slate-600'}`}>
              <TrendIcon className="w-3 h-3 inline mr-0.5" />{product.search_trend}
            </span>
            {product.best_source && (
              <span className={`text-xs px-2 py-0.5 rounded-full text-white font-bold ${source.color}`}>
                {source.emoji} {source.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-start justify-between gap-1 mb-0.5">
          <h3 className="font-semibold text-slate-800 text-sm leading-tight">{product.product_name}</h3>
          {isDigital && (
            <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-purple-600 text-white font-bold">DIGITAL</span>
          )}
        </div>
        <p className="text-xs text-slate-500 mb-2">{product.region} · {product.target_audience}</p>

        <div className="flex gap-1 flex-wrap mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${nicheColor[product.niche] || 'bg-slate-100 text-slate-600'}`}>{product.niche}</span>
          {(product.top_platforms || []).slice(0, 2).map(p => (
            <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{p}</span>
          ))}
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-3 gap-2 mb-2 text-center">
          <div className="bg-slate-50 rounded-lg p-2">
            <p className="text-xs text-slate-500">Cost</p>
            <p className="text-sm font-bold text-slate-800">{isDigital ? 'FREE' : '$' + product.estimated_cogs}</p>
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

        {/* Source reason */}
        {product.source_reason && (
          <div className={`text-xs px-2 py-1.5 rounded-lg mb-2 ${source.color} bg-opacity-10 text-slate-700 border border-opacity-20`}
            style={{ background: '#f8f9fa', borderLeft: `3px solid` }}>
            <span className="font-semibold">{source.emoji} Source: </span>{product.source_reason}
          </div>
        )}

        {/* Price Intelligence */}
        {(product.prevailing_price_low || product.price_strategy) && (
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${product.price_type === 'competitive' ? 'bg-blue-600 text-white' : 'bg-slate-400 text-white'}`}>
                {product.price_type === 'competitive' ? '📊 SURVEYED' : '📐 PROJECTED'}
              </span>
              {product.prevailing_price_low && (
                <span className="text-xs text-slate-500">Market: ${product.prevailing_price_low}–${product.prevailing_price_high}</span>
              )}
            </div>
            {product.price_strategy && <p className="text-xs text-blue-700 font-medium">{product.price_strategy}</p>}
          </div>
        )}

        {/* Sourcing Keywords */}
        {!isDigital && (
          <div className="space-y-1.5 mb-2">
            {[
              { label: 'AliExpress', keywords: product.aliexpress_keywords, config: SOURCE_CONFIG.aliexpress },
              { label: 'Alibaba', keywords: product.alibaba_keywords, config: SOURCE_CONFIG.alibaba },
              { label: 'Temu', keywords: product.temu_keywords, config: SOURCE_CONFIG.temu },
            ].filter(s => s.keywords?.length).map(({ label, keywords, config }) => (
              <div key={label}>
                <p className="text-xs text-slate-400 mb-0.5">{config.emoji} {label}:</p>
                <div className="flex flex-wrap gap-1">
                  {keywords.map(k => (
                    <a key={k} href={config.searchUrl(k)} target="_blank" rel="noreferrer"
                      className="text-xs bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100 flex items-center gap-1">
                      {k} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI Enriched Content */}
        {enriched && (
          <div className="mb-2">
            <button onClick={() => setShowEnriched(!showEnriched)}
              className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold w-full">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Generated Content Ready
              {showEnriched ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
            </button>
            {showEnriched && (
              <div className="mt-2 space-y-2 bg-violet-50 rounded-lg p-3 border border-violet-100">
                <div>
                  <p className="text-xs font-bold text-violet-700 mb-0.5">Optimized Title</p>
                  <p className="text-xs text-slate-800">{enriched.title}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-violet-700 mb-0.5">Short Description</p>
                  <p className="text-xs text-slate-700 italic">{enriched.short_description}</p>
                </div>
                {enriched.bullet_points?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-violet-700 mb-0.5">Key Features</p>
                    <ul className="text-xs text-slate-700 space-y-0.5 list-disc list-inside">
                      {enriched.bullet_points.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                )}
                {enriched.tags?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-violet-700 mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1">
                      {enriched.tags.map(t => (
                        <span key={t} className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {enriched.compare_at_price && (
                  <p className="text-xs text-slate-600">
                    <span className="font-bold">Compare-at: </span>${enriched.compare_at_price} (shows as sale)
                  </p>
                )}
                {enriched.vendor_name && (
                  <p className="text-xs text-slate-600">
                    <span className="font-bold">Vendor: </span>{enriched.vendor_name} · <span className="font-bold">Type: </span>{enriched.product_type}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto pt-3 border-t border-slate-100 space-y-2">
          {/* Step 1: AI Enrich */}
          {!enriched ? (
            <button
              onClick={handleEnrich}
              disabled={enriching}
              className="w-full flex items-center justify-center gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {enriching ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {enriching ? 'AI is writing title, description, tags…' : '✨ AI Enrich (Title, Description & Tags)'}
            </button>
          ) : (
            <p className="text-xs text-violet-600 font-semibold text-center">✅ AI content ready — will be used on import</p>
          )}

          {/* Step 2: Import */}
          {imported ? (
            <a href={imported.shopify_admin_url} target="_blank" rel="noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs text-emerald-700 font-semibold w-full py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
              <Check className="w-3.5 h-3.5" /> {imported.already_exists ? 'Already in Shopify — View ↗' : 'Imported! View in Shopify ↗'}
            </a>
          ) : (
            <button
              onClick={handleImport}
              disabled={importing}
              className={`w-full flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${enriched ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
            >
              {importing ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
              {importing ? 'Importing to Shopify…' : enriched ? '🚀 Import with AI Content' : 'Import to Shopify'}
            </button>
          )}
          {importError && <p className="text-xs text-red-500 mt-1">{importError}</p>}
        </div>
      </div>
    </div>
  );
}