import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Send, RefreshCw, Filter, Check, X, ChevronDown, Mail, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const NICHES = ["all", "fashion", "beauty", "lifestyle", "tech", "fitness", "home", "pet", "baby", "gaming", "outdoor", "kitchen", "wellness", "viral", "digital"];
const PLATFORMS = [{ v: "all", l: "All" }, { v: "instagram", l: "📸 Instagram" }, { v: "tiktok", l: "🎵 TikTok" }];

export default function BulkSendPanel() {
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterNiche, setFilterNiche] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterStatus, setFilterStatus] = useState("discovered");
  const [selected, setSelected] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Campaign config
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [commissionPct, setCommissionPct] = useState(15);
  const [discountPct, setDiscountPct] = useState(10);
  const [brandName, setBrandName] = useState("Kaizen Store");
  const [senderName, setSenderName] = useState("The Partnerships Team");
  const [customMsg, setCustomMsg] = useState("");

  useEffect(() => { loadInfluencers(); }, [filterNiche, filterPlatform, filterStatus]);

  const loadInfluencers = async () => {
    setLoading(true);
    setSelected(new Set());
    const filter = {};
    if (filterNiche !== "all") filter.niche = filterNiche;
    if (filterPlatform !== "all") filter.platform = filterPlatform;
    if (filterStatus !== "all") filter.status = filterStatus;
    const data = await base44.entities.InfluencerProfile.filter(filter, '-created_date', 200);
    setInfluencers(data);
    setLoading(false);
  };

  const toggleSelect = (id) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const selectAll = () => {
    const withEmail = influencers.filter(i => i.contact_email);
    setSelected(new Set(withEmail.map(i => i.id)));
  };

  const handleSend = async () => {
    if (!selected.size || !productName) return;
    setSending(true);
    setSendResult(null);
    const res = await base44.functions.invoke('bulkSendOutreach', {
      influencer_ids: [...selected],
      product_name: productName,
      product_description: productDesc,
      commission_pct: commissionPct,
      follower_discount_pct: discountPct,
      brand_name: brandName,
      sender_name: senderName,
      custom_message: customMsg,
    });
    setSendResult(res.data);
    setSending(false);
    if (res.data?.sent > 0) {
      setSelected(new Set());
      loadInfluencers();
    }
  };

  const withEmail = influencers.filter(i => i.contact_email);

  return (
    <div className="space-y-5">
      {/* Campaign Config */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-bold text-slate-800 mb-1">Campaign Setup</h2>
        <p className="text-xs text-slate-500 mb-4">Each email will be personalized with the influencer's handle, your product, their unique discount code, and commission details.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Product Name *</label>
            <input value={productName} onChange={e => setProductName(e.target.value)}
              placeholder="e.g. LED Therapy Face Mask"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Brand Name</label>
            <input value={brandName} onChange={e => setBrandName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-slate-600 block mb-1">Product Description (optional, 1 line)</label>
            <input value={productDesc} onChange={e => setProductDesc(e.target.value)}
              placeholder="e.g. the viral at-home LED therapy device with 7 color modes"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Commission for Influencer (%)</label>
            <input type="number" value={commissionPct} onChange={e => setCommissionPct(Number(e.target.value))} min={5} max={50}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Discount for Their Followers (%)</label>
            <input type="number" value={discountPct} onChange={e => setDiscountPct(Number(e.target.value))} min={5} max={50}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Sender Name</label>
            <input value={senderName} onChange={e => setSenderName(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 block mb-1">Custom Note (optional)</label>
            <input value={customMsg} onChange={e => setCustomMsg(e.target.value)}
              placeholder="Any extra personalized message..."
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
          </div>
        </div>
      </div>

      {/* Influencer Selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-800">Select Influencers</h2>
            <p className="text-xs text-slate-500">{withEmail.length} influencers with email · {selected.size} selected</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>Select All ({withEmail.length})</Button>
            {selected.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}><X className="w-3.5 h-3.5" /></Button>}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none">
            {PLATFORMS.map(p => <option key={p.v} value={p.v}>{p.l}</option>)}
          </select>
          <select value={filterNiche} onChange={e => setFilterNiche(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none capitalize">
            {NICHES.map(n => <option key={n} value={n} className="capitalize">{n === 'all' ? 'All Niches' : n}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none">
            <option value="all">All Statuses</option>
            <option value="discovered">Discovered</option>
            <option value="contacted">Contacted</option>
            <option value="accepted">Accepted</option>
          </select>
          <Button variant="outline" size="sm" onClick={loadInfluencers}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /><span className="text-sm">Loading influencers…</span>
          </div>
        ) : influencers.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No influencers yet</p>
            <p className="text-sm mt-1">Use the "Generate Database" tab to create your influencer pool</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {influencers.map(inf => {
              const hasEmail = !!inf.contact_email;
              const isSelected = selected.has(inf.id);
              return (
                <div key={inf.id} onClick={() => hasEmail && toggleSelect(inf.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors cursor-pointer
                    ${isSelected ? 'bg-violet-50 border-violet-300' : hasEmail ? 'hover:bg-slate-50 border-slate-100' : 'opacity-40 cursor-not-allowed border-slate-100'}`}>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">@{inf.platform_username}</span>
                      <span className="text-xs">{inf.platform === 'tiktok' ? '🎵' : '📸'}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">{inf.niche}</span>
                    </div>
                    <p className="text-xs text-slate-400">{inf.follower_count?.toLocaleString()} followers · {inf.engagement_rate}% eng · {inf.metadata?.region || ''}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {hasEmail ? (
                      <span className="text-xs text-emerald-600 font-medium">✉ {inf.contact_email}</span>
                    ) : (
                      <span className="text-xs text-slate-400">no email</span>
                    )}
                    {inf.status !== 'discovered' && (
                      <p className="text-xs text-amber-600 capitalize">{inf.status}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selected.size > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <Button onClick={handleSend} disabled={sending || !productName}
              className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white h-11">
              {sending
                ? <><RefreshCw className="w-4 h-4 animate-spin" />Sending personalized emails…</>
                : <><Send className="w-4 h-4" />Send to {selected.size} Influencers</>}
            </Button>
            {!productName && <p className="text-xs text-red-500 mt-2 text-center">⚠️ Fill in the Product Name above before sending</p>}
          </div>
        )}
      </div>

      {/* Result */}
      {sendResult && (
        <div className={`rounded-xl border p-5 ${sendResult.sent > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            {sendResult.sent > 0 ? <Check className="w-5 h-5 text-emerald-600" /> : <X className="w-5 h-5 text-red-500" />}
            <h3 className="font-bold text-slate-800">Blast Complete</h3>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-emerald-700 font-bold">✅ {sendResult.sent} sent</span>
            {sendResult.failed > 0 && <span className="text-red-600 font-bold">❌ {sendResult.failed} failed</span>}
            {sendResult.skipped > 0 && <span className="text-slate-500">⏭ {sendResult.skipped} skipped (no email)</span>}
          </div>
          {sendResult.sent > 0 && <p className="text-xs text-emerald-700 mt-2">All campaigns saved to your Influencer CRM automatically.</p>}
        </div>
      )}
    </div>
  );
}