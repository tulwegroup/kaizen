import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ShoppingBag, CheckCircle, XCircle, ChevronLeft, ExternalLink, Copy, Zap, Globe, Package, RefreshCw, ArrowRight, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shopify Integration Hub
 * Stable OAuth callback + store management UI.
 */
export default function ShopifyOAuth() {
  const [status, setStatus] = useState("loading");
  const [result, setResult] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const stableUrl = `${window.location.origin}/shopify-oauth`;
  const shopDomain = "0znmx9-vj.myshopify.com";

  useEffect(() => {
    const rawQuery = window.location.search.slice(1);
    const params = new URLSearchParams(window.location.search);

    async function handle() {
      if (!rawQuery) { setStatus("setup"); return; }

      if (params.get("action") === "start") {
        const res = await base44.functions.invoke("shopifyOAuth", {
          action: "get_auth_url",
          stable_callback_url: stableUrl,
        });
        window.open(res.data.auth_url, "_blank", "noopener,noreferrer");
        setStatus("setup");
        return;
      }

      if (params.get("code")) {
        const res = await base44.functions.invoke("shopifyOAuth", {
          action: "oauth_callback",
          raw_query: rawQuery,
          stable_callback_url: stableUrl,
        });
        setResult(res.data);
        setStatus(res.data?.success ? "success" : "error");
        return;
      }

      setStatus("setup");
    }

    handle().catch((e) => {
      setResult(e?.response?.data || { error: e.message });
      setStatus("error");
    });
  }, []);

  const copyUrl = () => {
    navigator.clipboard.writeText(stableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reauthorize = async () => {
    const res = await base44.functions.invoke("shopifyOAuth", {
      action: "get_auth_url",
      stable_callback_url: stableUrl,
    });
    window.open(res.data.auth_url, "_blank", "noopener,noreferrer");
  };

  const publishAllDrafts = async () => {
    setPublishing(true);
    setPublishResult(null);
    const res = await base44.functions.invoke("publishAllDrafts", {});
    setPublishResult(res.data);
    setPublishing(false);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #f6f8f3 0%, #e8f5e2 100%)" }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#008060" }}>
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <div className="w-6 h-6 border-2 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">Connecting to Shopify…</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(135deg, #f6f8f3 0%, #e8f5e2 100%)" }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-green-100">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Connected!</h2>
          <p className="text-slate-500 text-sm mb-6">Your Shopify store is now linked and ready for automation.</p>
          <div className="bg-slate-50 rounded-xl p-3 mb-6 text-left">
            <p className="text-xs text-slate-400 mb-1 font-medium uppercase tracking-wide">Store</p>
            <p className="text-sm font-semibold text-slate-800">{shopDomain}</p>
          </div>
          <Link to="/">
            <Button className="w-full" style={{ background: "#008060" }}>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "linear-gradient(135deg, #fff8f6 0%, #fee2e2 40%)" }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-red-100">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Connection Failed</h2>
          <p className="text-slate-500 text-sm mb-6">Something went wrong during the OAuth flow.</p>
          <div className="bg-slate-900 rounded-xl p-4 text-left mb-6 overflow-auto max-h-48">
            <pre className="text-red-400 text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
          </div>
          <Button variant="outline" className="w-full" onClick={reauthorize}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Setup / Management hub
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #f6f8f3 0%, #e3f0dc 100%)" }}>
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-4">
        <Link to="/" className="text-slate-400 hover:text-slate-600"><ChevronLeft className="w-5 h-5" /></Link>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#008060" }}>
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Shopify Integration</p>
            <p className="text-xs text-slate-400">{shopDomain}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
          <span className="text-xs text-green-700 font-medium">Connected</span>
          <a href={`https://${shopDomain}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5 ml-2">
              <Globe className="w-3.5 h-3.5" /> View Store <ExternalLink className="w-3 h-3" />
            </Button>
          </a>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* Hero card */}
        <div className="rounded-2xl overflow-hidden shadow-sm border border-green-200" style={{ background: "linear-gradient(135deg, #008060 0%, #004c3f 100%)" }}>
          <div className="p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-white mb-1">Your Shopify Store</h1>
              <p className="text-green-200 text-sm">{shopDomain}</p>
              <div className="flex gap-4 mt-4">
                <div>
                  <p className="text-green-300 text-xs font-medium uppercase tracking-wide">Status</p>
                  <p className="text-white font-semibold text-sm mt-0.5">✅ Active</p>
                </div>
                <div>
                  <p className="text-green-300 text-xs font-medium uppercase tracking-wide">Integration</p>
                  <p className="text-white font-semibold text-sm mt-0.5">✅ OAuth Connected</p>
                </div>
                <div>
                  <p className="text-green-300 text-xs font-medium uppercase tracking-wide">Auto-Publish</p>
                  <p className="text-white font-semibold text-sm mt-0.5">✅ Enabled</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <a href={`https://${shopDomain}/admin`} target="_blank" rel="noreferrer">
                <Button className="bg-white text-slate-900 hover:bg-green-50 gap-2 w-full">
                  <ShoppingBag className="w-4 h-4" /> Shopify Admin <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
              <Button onClick={reauthorize} variant="outline" className="border-green-300 text-green-100 hover:bg-green-700 gap-2 w-full text-sm">
                <RefreshCw className="w-3.5 h-3.5" /> Re-authorize
              </Button>
            </div>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Publish All Drafts */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Publish All Drafts</h3>
                <p className="text-xs text-slate-500">Push existing draft products live</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">Any products previously imported as drafts will be set to <strong>active</strong> and published to your storefront.</p>
            {publishResult && (
              <div className={`rounded-xl px-4 py-3 mb-4 text-sm ${publishResult.published > 0 ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                {publishResult.published > 0
                  ? `✅ ${publishResult.published} product${publishResult.published !== 1 ? 's' : ''} published${publishResult.failed ? ` · ${publishResult.failed} failed` : ''}`
                  : publishResult.message || 'No drafts found'}
              </div>
            )}
            <Button
              onClick={publishAllDrafts}
              disabled={publishing}
              className="w-full gap-2"
              style={{ background: publishing ? undefined : "#008060" }}
            >
              {publishing ? <><RefreshCw className="w-4 h-4 animate-spin" />Publishing…</> : <><Zap className="w-4 h-4" />Publish All Drafts</>}
            </Button>
          </div>

          {/* Theme Builder CTA */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#0d0d0d' }}>
                <Palette className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Kaizen Luxury Theme</h3>
                <p className="text-xs text-slate-500">Custom dark/gold theme builder</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4">Generate and deploy a fully custom luxury theme with product grids, hero banners, cart page and more — one click.</p>
            <Link to="/shopify-theme">
              <Button className="w-full gap-2" style={{ background: '#0d0d0d' }}>
                <Palette className="w-4 h-4 text-yellow-400" /> Open Theme Builder
              </Button>
            </Link>
          </div>

          {/* Quick links */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Globe className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Quick Links</h3>
                <p className="text-xs text-slate-500">Jump to key sections</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: "Storefront", href: `https://${shopDomain}`, desc: "Live store" },
                { label: "Products", href: `https://${shopDomain}/admin/products`, desc: "Manage all products" },
                { label: "Orders", href: `https://${shopDomain}/admin/orders`, desc: "View & fulfill orders" },
                { label: "Analytics", href: `https://${shopDomain}/admin/analytics`, desc: "Sales & traffic" },
              ].map(link => (
                <a key={link.label} href={link.href} target="_blank" rel="noreferrer"
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 border border-slate-100 transition-colors group">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{link.label}</p>
                    <p className="text-xs text-slate-400">{link.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                </a>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}