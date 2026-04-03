import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ChevronLeft, Sparkles, ShoppingBag, CheckCircle, RefreshCw, ExternalLink, Zap, Package, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  "Dense product grid (5-6 columns, AliExpress style)",
  "Orange accent colors with sale badges",
  "Prominent search bar at top",
  "Horizontal category navigation bar",
  "Flash deals scrollable row",
  "Product cards with sold count, ratings, free shipping",
  "Sale % badge, Free badge overlays on images",
  "Trust strip (shipping, secure, returns, global)",
  "Product detail page with variant selector",
  "Add to Cart + Buy Now buttons",
  "Cart page with order summary",
  "Newsletter with coupon offer",
  "Fully mobile responsive",
];

export default function ShopifyThemeBuilder() {
  const [deploying, setDeploying] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activateOnDeploy, setActivateOnDeploy] = useState(false);

  const deploy = async (activate) => {
    setDeploying(true);
    setResult(null);
    setError(null);
    const res = await base44.functions.invoke("deployShopifyTheme", { activate });
    if (res.data?.success) {
      setResult(res.data);
    } else {
      setError(res.data?.error || "Deployment failed");
    }
    setDeploying(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <Link to="/shopify-oauth" className="text-slate-400 hover:text-slate-600">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#008060" }}>
          <Palette className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Kaizen Luxury Theme Builder</p>
          <p className="text-xs text-slate-400">Generate & deploy a custom theme to your Shopify store</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* Preview card */}
        <div className="rounded-2xl overflow-hidden shadow-sm border border-orange-200" style={{ background: '#fff5f0' }}>
          <div className="p-6 border-b border-orange-100">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl font-black text-orange-500">Kaizen</span>
              <div className="flex-1 bg-white border-2 border-orange-400 rounded overflow-hidden flex h-8">
                <div className="flex-1 px-3 text-xs text-slate-400 flex items-center">Search products, brands and categories...</div>
                <div className="bg-orange-500 px-3 flex items-center"><span className="text-white text-xs">🔍</span></div>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {['All Categories','Fashion','Beauty','Tech','Home','🔥 Super Deals'].map(c => (
                <span key={c} className={`text-xs px-3 py-1 whitespace-nowrap border-b-2 ${c.includes('🔥') ? 'text-red-600 font-bold border-red-400' : 'text-slate-600 border-transparent hover:border-orange-400'}`}>{c}</span>
              ))}
            </div>
          </div>
          <div className="p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">Best Sellers — Dense product grid (AliExpress style)</p>
            <div className="grid grid-cols-5 gap-2">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="bg-white border border-slate-200 rounded overflow-hidden">
                  <div className="aspect-square bg-slate-100 relative">
                    <span className="absolute top-0 left-0 bg-red-500 text-white text-[9px] font-bold px-1">-{30+i*8}%</span>
                  </div>
                  <div className="p-1.5">
                    <div className="h-2 bg-slate-200 rounded mb-1 w-full"></div>
                    <div className="h-2 bg-slate-200 rounded mb-1 w-3/4"></div>
                    <div className="text-[11px] font-bold text-red-500">${(9.99 + i).toFixed(2)}</div>
                    <div className="text-[9px] text-green-600">Free shipping</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Features list */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-600" />
              </div>
              <h3 className="font-semibold text-slate-900">Theme Features</h3>
            </div>
            <ul className="space-y-2.5">
              {FEATURES.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Deploy panel */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <Package className="w-4 h-4 text-amber-600" />
                </div>
                <h3 className="font-semibold text-slate-900">Deploy Theme</h3>
              </div>
              <p className="text-sm text-slate-500 mb-5">This will generate all Liquid templates, CSS, and section files and upload them directly to your Shopify store.</p>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-4">
                <input
                  type="checkbox"
                  id="activate"
                  checked={activateOnDeploy}
                  onChange={e => setActivateOnDeploy(e.target.checked)}
                  className="w-4 h-4 accent-slate-900"
                />
                <label htmlFor="activate" className="text-sm font-medium text-slate-700 cursor-pointer">
                  Activate immediately (make it live)
                </label>
              </div>

              {!activateOnDeploy && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
                  ⚠️ Without activating, the theme will be uploaded as a draft. You can preview and activate it manually from Shopify Admin.
                </p>
              )}

              {result && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-green-800 mb-1">
                    ✅ Theme deployed! ({result.assets_uploaded} files uploaded)
                  </p>
                  {result.activated
                    ? <p className="text-xs text-green-700">🎉 Theme is now <strong>live</strong> on your store!</p>
                    : <p className="text-xs text-green-700">Theme is uploaded as a draft. Go to Shopify Admin to activate it.</p>
                  }
                  {result.assets_failed > 0 && (
                    <p className="text-xs text-amber-600 mt-1">{result.assets_failed} files failed — the theme may still work.</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <a href={result.shopify_themes_url} target="_blank" rel="noreferrer">
                      <Button size="sm" className="gap-1.5" style={{ background: "#008060" }}>
                        <ShoppingBag className="w-3.5 h-3.5" /> Open in Shopify <ExternalLink className="w-3 h-3" />
                      </Button>
                    </a>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
                  ❌ {error}
                  {error.toLowerCase().includes('write_themes') || error.toLowerCase().includes('403') || error.toLowerCase().includes('scope') ? (
                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
                      <p className="font-semibold mb-1">⚠️ Missing Shopify Permission</p>
                      <p className="text-xs mb-2">Your Shopify token is missing the <code className="bg-amber-100 px-1 rounded">write_themes</code> scope. You need to re-authorize the app.</p>
                      <Link to="/shopify-oauth">
                        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                          Go to Shopify Connect → Re-authorize
                        </Button>
                      </Link>
                    </div>
                  ) : null}
                </div>
              )}

              <Button
                onClick={() => deploy(activateOnDeploy)}
                disabled={deploying}
                className="w-full gap-2 text-sm"
                style={{ background: deploying ? undefined : "#0d0d0d" }}
              >
                {deploying ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Building & uploading theme… (~30s)</>
                ) : (
                  <><Zap className="w-4 h-4" /> {activateOnDeploy ? "Deploy & Activate Theme" : "Deploy as Draft"}</>
                )}
              </Button>
            </div>

            {/* Quick links */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">After deploying</h4>
              <div className="space-y-2">
                {[
                  { label: "Shopify Themes", href: "https://0znmx9-vj.myshopify.com/admin/themes", desc: "Preview & activate" },
                  { label: "Theme Customizer", href: "https://0znmx9-vj.myshopify.com/admin/themes/current/editor", desc: "Edit sections & content" },
                ].map(l => (
                  <a key={l.label} href={l.href} target="_blank" rel="noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{l.label}</p>
                      <p className="text-xs text-slate-400">{l.desc}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}