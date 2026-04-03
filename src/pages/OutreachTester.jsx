import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import {
  ChevronLeft, Send, RefreshCw, Sparkles, Copy, CheckCircle,
  Instagram, Plus, X, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.54V6.79a4.85 4.85 0 0 1-1.06-.1z"/>
    </svg>
  );
}

function detectPlatform(raw) {
  const h = raw.toLowerCase().replace(/\s/g, "");
  if (h.startsWith("tt:") || h.includes("tiktok.com")) return "tiktok";
  if (h.startsWith("ig:") || h.includes("instagram.com") || h.includes("ig.com")) return "instagram";
  return "tiktok"; // default to TikTok
}

function cleanHandle(raw) {
  return raw.trim().replace(/^@/, "").split("?")[0].split("/").filter(Boolean).pop() || raw.trim();
}

const SAMPLE_PRODUCTS = [
  { name: "Rose Quartz Gua Sha Facial Tool", price: "29.99", code: "GLOW20", commission: "20" },
  { name: "Magnetic Phone Mount Car Holder", price: "19.99", code: "DRIVE15", commission: "15" },
  { name: "LED Scalp Massager", price: "34.99", code: "SCALP25", commission: "20" },
  { name: "Posture Corrector Smart Wearable", price: "39.99", code: "POSTURE20", commission: "20" },
  { name: "Mini Portable Blender Bottle", price: "24.99", code: "BLEND15", commission: "15" },
];

const STATUS_COLORS = {
  pending: "bg-slate-100 text-slate-600",
  generating: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

export default function OutreachTester() {
  const [inputLine, setInputLine] = useState("");
  const [accounts, setAccounts] = useState([
    // pre-filled examples so user knows the format
    { raw: "@glowwithzara", handle: "glowwithzara", platform: "tiktok" },
    { raw: "@techwithahmad", handle: "techwithahmad", platform: "instagram" },
  ]);

  const [product, setProduct] = useState(SAMPLE_PRODUCTS[0]);
  const [useCustomProduct, setUseCustomProduct] = useState(false);
  const [customProduct, setCustomProduct] = useState({ name: "", price: "", code: "", commission: "20" });

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]); // { handle, platform, status, pitch, error, expanded, copied }

  const activeProduct = useCustomProduct ? customProduct : product;

  // ── Handle input ──────────────────────────────────────────────
  const addAccounts = () => {
    const lines = inputLine.split(/[\n,]+/).map(l => l.trim()).filter(Boolean);
    const newAccts = lines.map(raw => {
      const platform = detectPlatform(raw);
      // strip prefix if user typed tt: or ig:
      const stripped = raw.replace(/^(tt:|ig:)/i, "");
      const handle = cleanHandle(stripped);
      return { raw, handle, platform };
    });
    setAccounts(prev => {
      const existing = new Set(prev.map(a => a.handle.toLowerCase()));
      return [...prev, ...newAccts.filter(a => !existing.has(a.handle.toLowerCase()))];
    });
    setInputLine("");
  };

  const removeAccount = (handle) => setAccounts(prev => prev.filter(a => a.handle !== handle));

  const togglePlatform = (handle) => setAccounts(prev =>
    prev.map(a => a.handle === handle
      ? { ...a, platform: a.platform === "tiktok" ? "instagram" : "tiktok" }
      : a)
  );

  // ── Run agent ─────────────────────────────────────────────────
  const runAgent = async () => {
    if (!accounts.length || !activeProduct.name) return;
    setRunning(true);
    setResults(accounts.map(a => ({ ...a, status: "pending", pitch: null, error: null, expanded: false, copied: false })));

    for (let i = 0; i < accounts.length; i++) {
      const acct = accounts[i];
      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "generating" } : r));

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a brand partnership manager writing a short, human, personalised influencer DM.

Platform: ${acct.platform === "tiktok" ? "TikTok" : "Instagram"}
Influencer handle: @${acct.handle}
Product to promote: ${activeProduct.name}
Sell price: $${activeProduct.price}
Commission: ${activeProduct.commission}% per sale
Their discount code: ${activeProduct.code}

Instructions:
1. Infer the influencer's likely niche and content style from their handle name
2. Open with a short genuine compliment that sounds personal (not generic)
3. Introduce the product naturally in 1-2 lines
4. State the deal: code ${activeProduct.code} for followers + ${activeProduct.commission}% commission on every sale
5. Simple low-pressure CTA — just reply if interested
6. Friendly sign-off, under 150 words total

Also return:
- dm_preview: first ~80 chars (what shows in notification)
- subject_line: email subject 30 chars max
- fit_score: 1-10
- fit_reason: 1 sentence`,
        response_json_schema: {
          type: "object",
          properties: {
            dm_text: { type: "string" },
            dm_preview: { type: "string" },
            subject_line: { type: "string" },
            fit_score: { type: "number" },
            fit_reason: { type: "string" },
          }
        }
      });

      setResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: "done", pitch: res, expanded: true } : r
      ));
    }

    setRunning(false);
  };

  const copyPitch = (idx) => {
    const r = results[idx];
    if (!r?.pitch?.dm_text) return;
    navigator.clipboard.writeText(r.pitch.dm_text);
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, copied: true } : r));
    setTimeout(() => setResults(prev => prev.map((r, i) => i === idx ? { ...r, copied: false } : r)), 2000);
  };

  const toggleExpand = (idx) => setResults(prev => prev.map((r, i) => i === idx ? { ...r, expanded: !r.expanded } : r));

  const doneCount = results.filter(r => r.status === "done").length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <Link to="/" className="text-slate-400 hover:text-slate-600"><ChevronLeft className="w-5 h-5" /></Link>
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <Send className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Influencer Outreach Agent</p>
          <p className="text-xs text-slate-400">Add handles → agent auto-drafts personalised pitches for each</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT: Setup ── */}
          <div className="space-y-4">

            {/* Handle input */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800">TikTok & Instagram Handles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-500">Paste handles one per line, or separated by commas. Include @, full URLs, or just the username.</p>
                <textarea
                  rows={4}
                  placeholder={"@handle → defaults to TikTok\nig:@handle → Instagram\ntt:@handle → TikTok\nhttps://www.tiktok.com/@viralfindsme"}
                  value={inputLine}
                  onChange={e => setInputLine(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && e.metaKey) addAccounts(); }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none font-mono"
                />
                <Button onClick={addAccounts} disabled={!inputLine.trim()} variant="outline" className="w-full gap-2 text-sm">
                  <Plus className="w-4 h-4" /> Add to Queue
                </Button>

                {/* Account list */}
                {accounts.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-xs text-slate-400 font-medium">{accounts.length} account{accounts.length !== 1 ? 's' : ''} queued</p>
                    {accounts.map(acct => (
                      <div key={acct.handle} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-sm font-mono text-slate-700 flex-1">@{acct.handle}</span>
                        {/* Platform toggle */}
                        <button
                          onClick={() => togglePlatform(acct.handle)}
                          title="Click to switch platform"
                          className={`text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1 transition-all ${
                            acct.platform === "tiktok"
                              ? "bg-black text-white"
                              : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                          }`}
                        >
                          {acct.platform === "tiktok" ? <TikTokIcon /> : <Instagram className="w-3 h-3" />}
                          {acct.platform === "tiktok" ? "TikTok" : "Instagram"}
                        </button>
                        <button onClick={() => removeAccount(acct.handle)} className="text-slate-400 hover:text-red-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Product */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800">Product to Promote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 mb-1">
                  <button
                    onClick={() => setUseCustomProduct(false)}
                    className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-all ${!useCustomProduct ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                  >
                    Quick Select
                  </button>
                  <button
                    onClick={() => setUseCustomProduct(true)}
                    className={`flex-1 text-xs py-1.5 rounded-lg font-medium border transition-all ${useCustomProduct ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                  >
                    Custom Product
                  </button>
                </div>

                {!useCustomProduct ? (
                  <div className="space-y-2">
                    {SAMPLE_PRODUCTS.map(p => (
                      <button
                        key={p.name}
                        onClick={() => setProduct(p)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${
                          product.name === p.name
                            ? 'border-violet-400 bg-violet-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-slate-800">{p.name}</span>
                          {product.name === p.name && <CheckCircle className="w-4 h-4 text-violet-500" />}
                        </div>
                        <div className="flex gap-3 mt-0.5">
                          <span className="text-xs text-slate-500">${p.price}</span>
                          <span className="text-xs text-violet-600 font-mono">{p.code}</span>
                          <span className="text-xs text-emerald-600">{p.commission}% commission</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                      placeholder="Product name"
                      value={customProduct.name}
                      onChange={e => setCustomProduct(p => ({ ...p, name: e.target.value }))}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Price ($)</label>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" value={customProduct.price} onChange={e => setCustomProduct(p => ({ ...p, price: e.target.value }))} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Code</label>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" value={customProduct.code} onChange={e => setCustomProduct(p => ({ ...p, code: e.target.value.toUpperCase() }))} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 mb-1 block">Comm. %</label>
                        <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" value={customProduct.commission} onChange={e => setCustomProduct(p => ({ ...p, commission: e.target.value }))} />
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={runAgent}
              disabled={running || accounts.length === 0 || !activeProduct.name}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2 h-11"
            >
              {running
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Drafting pitches… ({doneCount}/{accounts.length})</>
                : <><Sparkles className="w-4 h-4" /> Run Outreach Agent ({accounts.length} account{accounts.length !== 1 ? 's' : ''})</>}
            </Button>
          </div>

          {/* ── RIGHT: Results ── */}
          <div className="space-y-3">
            {results.length === 0 && (
              <div className="flex flex-col items-center justify-center text-center p-16 bg-white rounded-xl border border-dashed border-slate-200 h-full">
                <Sparkles className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">Add handles and hit <strong>Run Outreach Agent</strong><br />to auto-draft personalised pitches for each account</p>
              </div>
            )}

            {results.map((r, idx) => (
              <div key={r.handle} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Row header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                    r.platform === "tiktok" ? "bg-black text-white" : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                  }`}>
                    {r.platform === "tiktok" ? <TikTokIcon /> : <Instagram className="w-3 h-3" />}
                  </span>
                  <span className="font-semibold text-sm text-slate-800 flex-1">@{r.handle}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>
                    {r.status === "generating" ? <span className="flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Writing…</span> : r.status}
                  </span>
                  {r.status === "done" && (
                    <button onClick={() => toggleExpand(idx)} className="text-slate-400 hover:text-slate-600">
                      {r.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                </div>

                {/* Fit score bar */}
                {r.pitch && (
                  <div className="px-4 pb-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${r.pitch.fit_score >= 7 ? 'bg-emerald-400' : r.pitch.fit_score >= 4 ? 'bg-amber-400' : 'bg-red-400'}`}
                          style={{ width: `${r.pitch.fit_score * 10}%` }}
                        />
                      </div>
                      <span className={`text-xs font-bold ${r.pitch.fit_score >= 7 ? 'text-emerald-600' : r.pitch.fit_score >= 4 ? 'text-amber-600' : 'text-red-500'}`}>
                        {r.pitch.fit_score}/10
                      </span>
                      <span className="text-xs text-slate-400">{r.pitch.fit_reason}</span>
                    </div>
                  </div>
                )}

                {/* Expanded pitch */}
                {r.expanded && r.pitch && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-100 mt-2 pt-3">
                    {/* Notification preview */}
                    <div className="bg-slate-900 rounded-xl px-3 py-2.5 flex items-start gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        {r.platform === "tiktok" ? <TikTokIcon /> : <Instagram className="w-3 h-3 text-white" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">New message</p>
                        <p className="text-xs text-slate-400 mt-0.5">{r.pitch.dm_preview}</p>
                      </div>
                    </div>

                    {/* Full DM */}
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{r.pitch.dm_text}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyPitch(idx)} className="gap-1.5 flex-1">
                        {r.copied ? <><CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy DM</>}
                      </Button>
                      <div className="flex-1 text-xs text-slate-400 flex items-center px-3 bg-slate-50 rounded-lg border border-slate-200 font-mono">
                        📧 {r.pitch.subject_line}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {doneCount > 0 && doneCount === results.length && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-sm text-emerald-800 font-medium text-center">
                ✅ {doneCount} pitch{doneCount !== 1 ? 'es' : ''} ready — copy each DM and send manually, or we'll automate delivery once validated.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}