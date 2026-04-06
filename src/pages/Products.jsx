import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Package, RefreshCw, Search } from "lucide-react";
import ProductsAnalytics from "@/components/products/ProductsAnalytics";
import ProductsGrid from "@/components/products/ProductsGrid";

const TABS = [
  { id: "all",        label: "All Products", emoji: "📦" },
  { id: "aliexpress", label: "AliExpress",   emoji: "🛒" },
  { id: "alibaba",    label: "Alibaba",      emoji: "🏭" },
  { id: "temu",       label: "Temu",         emoji: "🔥" },
  { id: "cj",         label: "CJ Drop",      emoji: "📬" },
  { id: "digital",    label: "Digital / AI", emoji: "💻" },
];

export default function Products() {
  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    // Aggregate all products from every ImportJob
    const jobs = await base44.entities.ImportJob.list('-created_date', 100);
    const seen = new Set();
    const products = [];

    for (const job of jobs) {
      if (!job.products_raw) continue;
      const raw = JSON.parse(job.products_raw);
      const enrichedMap = job.enriched_map ? JSON.parse(job.enriched_map) : {};
      raw.forEach((p, i) => {
        // Deduplicate by product name (case-insensitive)
        const key = (p.product_name || '').toLowerCase().trim();
        if (seen.has(key)) return;
        seen.add(key);
        products.push({ ...p, _enriched: !!enrichedMap[i], _jobId: job.id, _jobTitle: job.title });
      });
    }
    setAllProducts(products);
    setLoading(false);
  };

  const filtered = allProducts.filter(p => {
    const matchesTab =
      activeTab === "all" ? true :
      activeTab === "digital" ? (p.product_type === 'digital' || p.estimated_cogs === 0) :
      p.best_source === activeTab;

    const q = search.toLowerCase();
    const matchesSearch = !q ||
      (p.product_name || '').toLowerCase().includes(q) ||
      (p.niche || '').toLowerCase().includes(q) ||
      (p.region || '').toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  const countFor = (tabId) => {
    if (tabId === "all") return allProducts.length;
    if (tabId === "digital") return allProducts.filter(p => p.product_type === 'digital' || p.estimated_cogs === 0).length;
    return allProducts.filter(p => p.best_source === tabId).length;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <Package className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Product Catalog</p>
          <p className="text-xs text-slate-400">All products discovered by AI research — sourced from AliExpress, Alibaba, Temu, CJ & Digital</p>
        </div>
        <button onClick={loadProducts} disabled={loading} className="text-slate-400 hover:text-slate-600">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading product catalog…
          </div>
        ) : allProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Package className="w-14 h-14 text-slate-200 mb-4" />
            <p className="text-slate-500 font-semibold text-lg">No products yet</p>
            <p className="text-sm text-slate-400 mt-1">Run the AI Research Agent to discover products — they'll all appear here.</p>
          </div>
        ) : (
          <>
            <ProductsAnalytics products={allProducts} />

            {/* Tabs + Search */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1.5 flex-1">
                {TABS.map(tab => {
                  const count = countFor(tab.id);
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                        ${activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {tab.emoji} {tab.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-white text-slate-900' : 'bg-white text-slate-500'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products…"
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 w-44"
                />
              </div>
            </div>

            <ProductsGrid products={filtered} />
          </>
        )}
      </div>
    </div>
  );
}