import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, RefreshCw, Search, ShoppingBag, Sparkles } from "lucide-react";
import ProductsAnalytics from "@/components/products/ProductsAnalytics";
import ProductsGrid from "@/components/products/ProductsGrid";

const TABS = [
  { id: "all",        label: "All Products", emoji: "📦" },
  { id: "aliexpress", label: "AliExpress",   emoji: "🛒" },
  { id: "alibaba",    label: "Alibaba",       emoji: "🏭" },
  { id: "temu",       label: "Temu",          emoji: "🔥" },
  { id: "cj",         label: "CJ Drop",       emoji: "📬" },
  { id: "digital",    label: "Digital / AI",  emoji: "💻" },
  { id: "shopify",    label: "Other Shopify", emoji: "🏪" },
];

export default function Products() {
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [dataSource, setDataSource] = useState("both");
  const [error, setError] = useState(null);

  useEffect(() => { loadProducts(); }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    const products = [];
    const seen = new Set();

    try {
      const shopRes = await base44.functions.invoke('getShopifyProducts', {});
      if (shopRes.data?.success) {
        for (const p of shopRes.data.products) {
          const key = p.product_name.toLowerCase().trim();
          if (!seen.has(key)) { seen.add(key); products.push({ ...p, _source: 'shopify' }); }
        }
      }
    } catch (e) {
      if (e?.response?.status === 401) {
        setError('You must be logged in to view products.');
        setLoading(false);
        return;
      }
    }

    try {
      const jobs = await base44.entities.ImportJob.list('-created_date', 100);
      for (const job of jobs) {
        if (!job.products_raw) continue;
        const raw = JSON.parse(job.products_raw);
        const enrichedMap = job.enriched_map ? JSON.parse(job.enriched_map) : {};
        raw.forEach((p, i) => {
          const key = (p.product_name || '').toLowerCase().trim();
          if (seen.has(key)) return;
          seen.add(key);
          products.push({ ...p, _enriched: !!enrichedMap[i], _jobTitle: job.title, _source: 'research' });
        });
      }
    } catch (_) {}

    setAllProducts(products);
    setLoading(false);
  };

  const baseFiltered = allProducts.filter(p => {
    if (dataSource === 'shopify' && p._source !== 'shopify') return false;
    if (dataSource === 'research' && p._source !== 'research') return false;
    return true;
  });

  const visibleProducts = baseFiltered.filter(p => {
    const matchesTab =
      activeTab === "all" ? true :
      activeTab === "digital" ? (p.product_type === 'digital' || p.estimated_cogs === 0) :
      p.best_source === activeTab;

    const q = search.toLowerCase();
    const matchesSearch = !q ||
      (p.product_name || '').toLowerCase().includes(q) ||
      (p.niche || '').toLowerCase().includes(q) ||
      (p.vendor || '').toLowerCase().includes(q) ||
      (p.region || '').toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  const countFor = (tabId) => {
    if (tabId === "all") return baseFiltered.length;
    if (tabId === "digital") return baseFiltered.filter(p => p.product_type === 'digital' || p.estimated_cogs === 0).length;
    return baseFiltered.filter(p => p.best_source === tabId).length;
  };

  const shopifyCount = allProducts.filter(p => p._source === 'shopify').length;
  const researchCount = allProducts.filter(p => p._source === 'research').length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <Package className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Product Catalog</p>
          <p className="text-xs text-slate-400">Live Shopify store + AI research products</p>
        </div>
        <button onClick={loadProducts} disabled={loading} className="text-slate-400 hover:text-slate-600">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <p className="text-sm">Loading products…</p>
          </div>
        ) : (
          <>
            {/* Source toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'both',     label: 'All',        icon: Package,     count: allProducts.length },
                { id: 'shopify',  label: 'Shopify',    icon: ShoppingBag, count: shopifyCount },
                { id: 'research', label: 'AI Research', icon: Sparkles,   count: researchCount },
              ].map(({ id, label, icon: Icon, count }) => (
                <button key={id} onClick={() => setDataSource(id)}
                  className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border font-medium transition-colors
                    ${dataSource === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'}`}>
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{label.split(' ')[0]}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${dataSource === id ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                </button>
              ))}
            </div>

            <ProductsAnalytics products={visibleProducts.length ? visibleProducts : baseFiltered} />

            {/* Tabs + Search */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2">
              <div className="flex flex-wrap gap-1.5 flex-1 w-full sm:w-auto">
                {TABS.map(tab => {
                  const count = countFor(tab.id);
                  if (count === 0 && tab.id !== 'all') return null;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                        ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                      {tab.emoji}
                      <span className="hidden sm:inline">{tab.label}</span>
                      <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white text-slate-900' : 'bg-white text-slate-500'}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <div className="relative w-full sm:w-auto">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products…"
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 w-full sm:w-44" />
              </div>
            </div>

            {visibleProducts.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <p className="font-medium">No products match your filters</p>
              </div>
            ) : (
              <ProductsGrid products={visibleProducts} />
            )}
          </>
        )}
      </div>
    </div>
  );
}