import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Stable Shopify OAuth callback page.
 * URL: https://<app-domain>/shopify-oauth
 *
 * This page's URL never changes between deployments.
 * Configure both fields in Shopify Partner Dashboard to this URL:
 *   - App URL
 *   - Allowed redirect URL
 *
 * On GET ?action=start  → forwards to backend to begin OAuth
 * On GET ?code=...      → forwards callback params to backend for validation + token exchange
 */
export default function ShopifyOAuth() {
  const [status, setStatus] = useState("loading");
  const [result, setResult] = useState(null);
  const [startUrl, setStartUrl] = useState(null);

  const stableUrl = `${window.location.origin}/shopify-oauth`;

  useEffect(() => {
    const rawQuery = window.location.search.slice(1); // strip leading '?'
    const params = new URLSearchParams(window.location.search);

    async function handle() {
      // No params — show setup instructions
      if (!rawQuery) {
        setStatus("setup");
        return;
      }

      // ?action=start — get the Shopify auth redirect URL from backend
      if (params.get("action") === "start") {
        const res = await base44.functions.invoke("shopifyOAuth", {
          action: "get_auth_url",
          stable_callback_url: stableUrl,
        });
        window.location.href = res.data.auth_url;
        return;
      }

      // Shopify callback — has code + hmac
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
      // Extract actual backend response body if available (axios error)
      const detail = e?.response?.data || { error: e.message };
      setResult(detail);
      setStatus("error");
    });
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-mono text-sm">Processing OAuth…</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-lg w-full font-mono">
          <h2 className="text-green-600 text-xl font-bold mb-4">✅ OAuth Complete — Token Stored</h2>
          <pre className="bg-gray-900 text-green-400 p-4 rounded text-xs overflow-auto whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 max-w-lg w-full font-mono">
          <h2 className="text-red-600 text-xl font-bold mb-4">❌ OAuth Failed</h2>
          <pre className="bg-gray-900 text-red-400 p-4 rounded text-xs overflow-auto whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  // Setup instructions
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-xl shadow p-8 max-w-2xl w-full font-mono text-sm">
        <h2 className="text-xl font-bold mb-6">Shopify OAuth — Stable Endpoint</h2>

        <div className="mb-6">
          <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Stable Callback URL (never changes)</p>
          <div className="bg-gray-100 rounded p-3 text-gray-900 break-all">{stableUrl}</div>
        </div>

        <div className="mb-6 border rounded p-4 bg-blue-50">
          <p className="font-semibold mb-2">Set both of these in Shopify Partner Dashboard:</p>
          <table className="w-full text-sm">
            <tbody>
              <tr><td className="py-1 pr-4 text-gray-500">App URL</td><td className="break-all">{stableUrl}</td></tr>
              <tr><td className="py-1 pr-4 text-gray-500">Allowed redirect URL</td><td className="break-all">{stableUrl}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="mb-4">
          <p className="text-gray-500 text-xs uppercase font-semibold mb-1">Start OAuth</p>
          <a
            href={`${stableUrl}?action=start`}
            className="inline-block bg-slate-900 text-white px-4 py-2 rounded hover:bg-slate-700 transition"
          >
            → {stableUrl}?action=start
          </a>
        </div>

        <p className="text-green-600 text-xs mt-6">✅ This URL is tied to your app domain — it will NOT change on redeploy.</p>
      </div>
    </div>
  );
}