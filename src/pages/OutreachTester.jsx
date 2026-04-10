import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import {
  Send, RefreshCw, Sparkles, Copy, CheckCircle,
  Instagram, X, ChevronDown, ChevronUp, Users, Save, Edit3, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.54V6.79a4.85 4.85 0 0 1-1.06-.1z"/>
    </svg>
  );
}

const PITCH_STYLES = [
  { id: "friendly_casual",  label: "😊 Friendly & Casual",   desc: "Warm, conversational, feels like a DM from a friend" },
  { id: "professional",     label: "💼 Professional",         desc: "Polished, brand-forward, business tone" },
  { id: "bold_fomo",        label: "🔥 Bold / FOMO",          desc: "Urgency-driven, exciting offer, FOMO-inducing" },
  { id: "story_driven",     label: "📖 Story-Driven",         desc: "Narrative hook, connects product to creator's journey" },
  { id: "short_punchy",     label: "⚡ Short & Punchy",       desc: "Ultra-brief, direct ask, under 80 words" },
];

const PITCH_STYLE_PROMPTS = {
  friendly_casual:  "Write in a warm, casual, friendly tone like a genuine DM from a real person. Use first names, feel conversational.",
  professional:     "Write in a polished, professional brand-partnership tone. Structured, clear, confident.",
  bold_fomo:        "Write with urgency and excitement. Make the opportunity sound exclusive and time-sensitive without being pushy.",
  story_driven:     "Open with a short story or narrative hook that connects the influencer's content style to the product naturally.",
  short_punchy:     "Keep it under 80 words total. Every word counts. Direct, punchy, compelling — no fluff.",
};

export default function OutreachTester() {
  // DB influencer picker
  const [dbInfluencers, setDbInfluencers] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbFilter, setDbFilter] = useState("");
  const [selectedInfluencers, setSelectedInfluencers] = useState([]);

  // Product
  const [productName, setProductName] = useState("Rose Quartz Gua Sha Facial Tool");
  const [productPrice, setProductPrice] = useState("29.99");
  const [discountCode, setDiscountCode] = useState("GLOW20");
  const [commission, setCommission] = useState("20");

  // Pitch style
  const [pitchStyle, setPitchStyle] = useState("friendly_casual");

  // Results
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editText, setEditText] = useState("");

  // Saved templates
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [savingIdx, setSavingIdx] = useState(null);

  useEffect(() => {
    loadDbInfluencers();
    loadSavedTemplates();
  }, []);

  const loadDbInfluencers = async () => {
    setDbLoading(true);
    const data = await base44.entities.InfluencerProfile.filter({}, '-follower_count', 300);
    setDbInfluencers(data);
    setDbLoading(false);
  };

  const loadSavedTemplates = async () => {
    const data = await base44.entities.PitchTemplate.list('-created_date', 20);
    setSavedTemplates(data);
  };

  const filteredDb = dbInfluencers.filter(inf =>
    !dbFilter ||
    inf.platform_username?.toLowerCase().includes(dbFilter.toLowerCase()) ||
    inf.niche?.toLowerCase().includes(dbFilter.toLowerCase()) ||
    inf.platform?.toLowerCase().includes(dbFilter.toLowerCase())
  );

  const toggleSelectInfluencer = (inf) => {
    setSelectedInfluencers(prev => {
      const exists = prev.find(x => x.id === inf.id);
      if (exists) return prev.filter(x => x.id !== inf.id);
      return [...prev, inf];
    });
  };

  const runAgent = async () => {
    if (!selectedInfluencers.length || !productName) return;
    setRunning(true);
    setResults(selectedInfluencers.map(inf => ({ ...inf, status: "pending", pitch: null, expanded: false })));

    for (let i = 0; i < selectedInfluencers.length; i++) {
      const inf = selectedInfluencers[i];
      const platformName = inf.platform === "tiktok" ? "TikTok" : "Instagram";
      const stylePrompt = PITCH_STYLE_PROMPTS[pitchStyle];

      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "generating" } : r));

      const pitchRes = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a brand partnership manager writing a personalised influencer pitch.

Style instruction: ${stylePrompt}

Platform: ${platformName}
Influencer handle: @${inf.platform_username}
Niche: ${inf.niche || 'lifestyle'}
Followers: ${inf.follower_count?.toLocaleString() || 'unknown'}
Product: ${productName}
Price: $${productPrice}
Commission: ${commission}% per sale
Their discount code: ${discountCode}

Write the outreach pitch following the style instruction above.
Return: dm_text (full message), dm_preview (first 80 chars), subject_line (max 40 chars), fit_score (1-10), fit_reason (1 sentence)`,
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

      setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "done", pitch: pitchRes, expanded: true } : r));
    }
    setRunning(false);
  };

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditText(results[idx].pitch.dm_text);
  };

  const saveEdit = (idx) => {
    setResults(prev => prev.map((r, i) => i === idx ? { ...r, pitch: { ...r.pitch, dm_text: editText } } : r));
    setEditingIdx(null);
  };

  const saveAsTemplate = async (idx) => {
    setSavingIdx(idx);
    const r = results[idx];
    const styleName = PITCH_STYLES.find(s => s.id === pitchStyle)?.label || pitchStyle;
    const name = `${styleName} — ${productName} — @${r.platform_username}`;
    await base44.entities.PitchTemplate.create({
      template_name: name,
      pitch_style: pitchStyle,
      subject_line: r.pitch.subject_line,
      dm_text: r.pitch.dm_text,
      product_name: productName,
      platform: r.platform || "both",
      fit_score: r.pitch.fit_score,
    });
    await loadSavedTemplates();
    setSavingIdx(null);
  };

  const deleteTemplate = async (id) => {
    await base44.entities.PitchTemplate.delete(id);
    setSavedTemplates(prev => prev.filter(t => t.id !== id));
  };

  const doneCount = results.filter(r => r.status === "done").length;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: Setup */}
        <div className="space-y-4">

          {/* Pick from DB */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" /> Pick from Influencer Database
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                value={dbFilter}
                onChange={e => setDbFilter(e.target.value)}
                placeholder="Filter by handle, niche, platform…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              {dbLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm py-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {filteredDb.slice(0, 50).map(inf => {
                    const sel = selectedInfluencers.find(x => x.id === inf.id);
                    return (
                      <button key={inf.id} onClick={() => toggleSelectInfluencer(inf)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-colors flex items-center gap-2
                          ${sel ? 'bg-violet-50 border-violet-300' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${sel ? 'bg-violet-600 border-violet-600' : 'border-slate-300'}`}>
                          {sel && <CheckCircle className="w-3 h-3 text-white" />}
                        </div>
                        <span className="font-medium text-slate-800">@{inf.platform_username}</span>
                        <span className="text-xs">{inf.platform === 'tiktok' ? '🎵' : '📸'}</span>
                        <span className="text-xs text-slate-400 capitalize">{inf.niche}</span>
                        <span className="ml-auto text-xs text-slate-400">{inf.follower_count?.toLocaleString()}</span>
                      </button>
                    );
                  })}
                  {filteredDb.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No influencers found</p>}
                </div>
              )}
              {selectedInfluencers.length > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-violet-600 font-semibold">{selectedInfluencers.length} selected</span>
                  <button onClick={() => setSelectedInfluencers([])} className="text-slate-400 hover:text-red-400">Clear</button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800">Product Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Product name"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Price ($)</label>
                  <input value={productPrice} onChange={e => setProductPrice(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Discount Code</label>
                  <input value={discountCode} onChange={e => setDiscountCode(e.target.value.toUpperCase())}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Commission %</label>
                  <input value={commission} onChange={e => setCommission(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pitch Style */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-slate-800">Pitch Style</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PITCH_STYLES.map(s => (
                <button key={s.id} onClick={() => setPitchStyle(s.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors
                    ${pitchStyle === s.id ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800">{s.label}</span>
                    {pitchStyle === s.id && <CheckCircle className="w-4 h-4 text-violet-500" />}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Button onClick={runAgent} disabled={running || !selectedInfluencers.length || !productName}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2 h-11">
            {running
              ? <><RefreshCw className="w-4 h-4 animate-spin" />Drafting pitches… ({doneCount}/{selectedInfluencers.length})</>
              : <><Sparkles className="w-4 h-4" />Generate {selectedInfluencers.length} Pitch{selectedInfluencers.length !== 1 ? 'es' : ''}</>}
          </Button>
        </div>

        {/* RIGHT: Results */}
        <div className="space-y-3">
          {results.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center p-16 bg-white rounded-xl border border-dashed border-slate-200">
              <Sparkles className="w-10 h-10 text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">Pick influencers, choose a pitch style,<br />then hit <strong>Generate Pitches</strong></p>
            </div>
          )}

          {results.map((r, idx) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3">
                <span className={`text-xs px-2 py-0.5 rounded font-medium flex items-center gap-1 ${r.platform === "tiktok" ? "bg-black text-white" : "bg-gradient-to-r from-purple-500 to-pink-500 text-white"}`}>
                  {r.platform === "tiktok" ? <TikTokIcon /> : <Instagram className="w-3 h-3" />}
                </span>
                <span className="font-semibold text-sm text-slate-800 flex-1">@{r.platform_username}</span>
                {r.status === "generating" && <span className="text-xs text-amber-600 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Writing…</span>}
                {r.status === "done" && <span className="text-xs text-emerald-600 font-medium">Done</span>}
                {r.status === "done" && (
                  <button onClick={() => setResults(prev => prev.map((x, i) => i === idx ? { ...x, expanded: !x.expanded } : x))} className="text-slate-400 hover:text-slate-600">
                    {r.expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {r.pitch && r.expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
                  {/* Fit score */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${r.pitch.fit_score >= 7 ? 'bg-emerald-400' : r.pitch.fit_score >= 4 ? 'bg-amber-400' : 'bg-red-400'}`}
                        style={{ width: `${r.pitch.fit_score * 10}%` }} />
                    </div>
                    <span className={`text-xs font-bold ${r.pitch.fit_score >= 7 ? 'text-emerald-600' : r.pitch.fit_score >= 4 ? 'text-amber-600' : 'text-red-500'}`}>
                      {r.pitch.fit_score}/10
                    </span>
                    <span className="text-xs text-slate-400 flex-1 truncate">{r.pitch.fit_reason}</span>
                  </div>

                  {/* Preview bubble */}
                  <div className="bg-slate-900 rounded-xl px-3 py-2.5 flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                      {r.platform === "tiktok" ? <TikTokIcon /> : <Instagram className="w-3 h-3 text-white" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white">New message</p>
                      <p className="text-xs text-slate-400 mt-0.5">{r.pitch.dm_preview}</p>
                    </div>
                  </div>

                  {/* Editable pitch */}
                  {editingIdx === idx ? (
                    <div className="space-y-2">
                      <textarea rows={8} value={editText} onChange={e => setEditText(e.target.value)}
                        className="w-full border border-violet-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(idx)} className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white flex-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Save Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingIdx(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{r.pitch.dm_text}</p>
                    </div>
                  )}

                  <p className="text-xs text-slate-400 font-mono px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">📧 {r.pitch.subject_line}</p>

                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => startEdit(idx)} className="gap-1.5 flex-1">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(r.pitch.dm_text); }} className="gap-1.5">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </Button>
                    <Button size="sm"
                      onClick={() => saveAsTemplate(idx)}
                      disabled={savingIdx === idx}
                      className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white flex-1">
                      {savingIdx === idx ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save as Template
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Saved Templates */}
      {savedTemplates.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-slate-800">Saved Pitch Templates</h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{savedTemplates.length} saved</span>
            <p className="text-xs text-slate-400 ml-auto">These appear in Bulk Email Blast for use in campaigns</p>
          </div>
          <div className="space-y-3">
            {savedTemplates.map(t => (
              <div key={t.id} className="flex items-start gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-sm text-slate-800">{t.template_name}</span>
                    {t.pitch_style && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 capitalize">
                        {PITCH_STYLES.find(s => s.id === t.pitch_style)?.label || t.pitch_style}
                      </span>
                    )}
                    {t.fit_score && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${t.fit_score >= 7 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {t.fit_score}/10
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-2">{t.dm_text}</p>
                </div>
                <button onClick={() => deleteTemplate(t.id)} className="text-slate-300 hover:text-red-400 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}