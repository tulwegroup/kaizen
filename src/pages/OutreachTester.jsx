import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { ChevronLeft, Instagram, Send, Eye, RefreshCw, CheckCircle, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Test influencer accounts (replace with real ones once validated) ──────────
const TEST_INFLUENCERS = [
  {
    id: "test_tiktok_1",
    handle: "@glowwithzara",
    platform: "tiktok",
    niche: "beauty",
    followers: 84000,
    engagement_rate: 6.2,
    region: "UAE / GCC",
    avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=80&h=80&fit=crop&crop=face",
    bio: "Skincare & makeup tutorials for Arab women 💄✨",
  },
  {
    id: "test_insta_1",
    handle: "@techwithahmad",
    platform: "instagram",
    niche: "tech",
    followers: 52000,
    engagement_rate: 4.8,
    region: "Saudi Arabia",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
    bio: "Latest gadgets, unboxings & honest reviews 🔧📱",
  },
  {
    id: "test_tiktok_2",
    handle: "@fitlifedubai",
    platform: "tiktok",
    niche: "fitness",
    followers: 130000,
    engagement_rate: 5.5,
    region: "UAE",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80&h=80&fit=crop&crop=face",
    bio: "Daily workouts, healthy recipes & Dubai lifestyle 🏋️‍♀️",
  },
  {
    id: "test_insta_2",
    handle: "@homevibesbylayla",
    platform: "instagram",
    niche: "home",
    followers: 67000,
    engagement_rate: 5.1,
    region: "Egypt / MENA",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
    bio: "Home decor, organization & cozy living inspiration 🏡",
  },
  {
    id: "test_tiktok_3",
    handle: "@viralfindsme",
    platform: "tiktok",
    niche: "viral",
    followers: 198000,
    engagement_rate: 7.3,
    region: "Global / UK",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
    bio: "If it's trending I find it first 🔥 Amazon must-haves daily",
  },
];

const PLATFORM_COLORS = {
  tiktok: "bg-black text-white",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
};

const PLATFORM_LABELS = { tiktok: "TikTok", instagram: "Instagram" };

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.83 1.54V6.79a4.85 4.85 0 0 1-1.06-.1z"/>
    </svg>
  );
}

export default function OutreachTester() {
  const [selectedInfluencer, setSelectedInfluencer] = useState(null);
  const [productName, setProductName] = useState("Rose Quartz Gua Sha Facial Tool");
  const [sellPrice, setSellPrice] = useState("29.99");
  const [discountCode, setDiscountCode] = useState("GLOW20");
  const [commission, setCommission] = useState("20");
  const [generating, setGenerating] = useState(false);
  const [pitch, setPitch] = useState(null);
  const [copied, setCopied] = useState(false);

  const generatePitch = async () => {
    if (!selectedInfluencer) return;
    setGenerating(true);
    setPitch(null);

    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a brand partnership manager writing a SHORT, personal influencer outreach DM.

Platform: ${PLATFORM_LABELS[selectedInfluencer.platform]}
Influencer handle: ${selectedInfluencer.handle}
Niche: ${selectedInfluencer.niche}
Followers: ${selectedInfluencer.followers.toLocaleString()}
Their bio: "${selectedInfluencer.bio}"
Region: ${selectedInfluencer.region}

Product we want them to promote: ${productName}
Sell price: $${sellPrice}
Commission rate: ${commission}% per sale
Their unique discount code: ${discountCode}

Write a DM pitch that:
1. Opens with a genuine compliment about their specific content (reference their niche/bio)
2. Introduces the brand/product in 1-2 sentences — make it feel natural, not corporate
3. Explains the deal clearly: discount code ${discountCode} for their followers + ${commission}% commission on every sale
4. Has a clear, low-pressure CTA (reply to this message, no commitment needed)
5. Ends with a friendly sign-off

Keep it under 150 words. Sound human, warm, and authentic — NOT like a mass template. Use their first name if you can infer it from the handle.

Also generate:
- subject_line: email subject if this were an email (30 chars max)
- dm_preview: first 2 lines of the DM (the part visible in notification preview, ~80 chars)
- fit_score: 1-10 how well this influencer fits the product (10 = perfect)
- fit_reason: 1 sentence why they're a good/bad fit`,
      response_json_schema: {
        type: "object",
        properties: {
          dm_text: { type: "string" },
          subject_line: { type: "string" },
          dm_preview: { type: "string" },
          fit_score: { type: "number" },
          fit_reason: { type: "string" },
        }
      }
    });

    setPitch(res);
    setGenerating(false);
  };

  const copyToClipboard = () => {
    if (!pitch?.dm_text) return;
    navigator.clipboard.writeText(pitch.dm_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <Link to="/" className="text-slate-400 hover:text-slate-600"><ChevronLeft className="w-5 h-5" /></Link>
        <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
          <Send className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Influencer Outreach Tester</p>
          <p className="text-xs text-slate-400">Test pitch previews with sample accounts before going live</p>
        </div>
        <div className="ml-auto">
          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Test Mode</Badge>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">

        {/* Info banner */}
        <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-sm text-violet-800">
          <strong>🧪 Test Mode:</strong> These are sample influencer profiles (10k–200k bracket) to preview how your pitch will look. Once validated, swap these for real micro-influencer handles.
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Config */}
          <div className="space-y-4">

            {/* Product details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800">Product to Promote</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Product Name</label>
                  <input
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                    value={productName}
                    onChange={e => setProductName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Sell Price ($)</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                      value={sellPrice}
                      onChange={e => setSellPrice(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Discount Code</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                      value={discountCode}
                      onChange={e => setDiscountCode(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Commission %</label>
                    <input
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                      value={commission}
                      onChange={e => setCommission(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Influencer picker */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-800">Select Test Influencer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {TEST_INFLUENCERS.map(inf => (
                  <button
                    key={inf.id}
                    onClick={() => { setSelectedInfluencer(inf); setPitch(null); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      selectedInfluencer?.id === inf.id
                        ? 'border-violet-400 bg-violet-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <img src={inf.avatar} alt={inf.handle} className="w-10 h-10 rounded-full object-cover" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-800">{inf.handle}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${PLATFORM_COLORS[inf.platform]}`}>
                          {inf.platform === 'tiktok' ? <TikTokIcon /> : <Instagram className="w-3 h-3" />}
                          {PLATFORM_LABELS[inf.platform]}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{inf.bio}</p>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs text-slate-600">{(inf.followers / 1000).toFixed(0)}K followers</span>
                        <span className="text-xs text-emerald-600">{inf.engagement_rate}% engagement</span>
                        <span className="text-xs text-slate-400">{inf.region}</span>
                      </div>
                    </div>
                    {selectedInfluencer?.id === inf.id && <CheckCircle className="w-4 h-4 text-violet-500 shrink-0" />}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Button
              onClick={generatePitch}
              disabled={!selectedInfluencer || generating || !productName}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
            >
              {generating
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating pitch…</>
                : <><Sparkles className="w-4 h-4" /> Generate Pitch Preview</>}
            </Button>
          </div>

          {/* Right: Pitch Preview */}
          <div>
            {!pitch && !generating && (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-xl border border-dashed border-slate-200">
                <Eye className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm text-slate-500">Select an influencer and click<br /><strong>Generate Pitch Preview</strong> to see how your outreach will look</p>
              </div>
            )}

            {generating && (
              <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-xl border border-slate-200">
                <RefreshCw className="w-8 h-8 text-violet-400 animate-spin mb-3" />
                <p className="text-sm text-slate-500">AI is writing a personalised pitch…</p>
              </div>
            )}

            {pitch && selectedInfluencer && (
              <div className="space-y-4">
                {/* Fit score */}
                <div className={`rounded-xl px-4 py-3 border flex items-center gap-3 ${
                  pitch.fit_score >= 7 ? 'bg-green-50 border-green-200' :
                  pitch.fit_score >= 4 ? 'bg-amber-50 border-amber-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-black ${
                    pitch.fit_score >= 7 ? 'bg-green-100 text-green-700' :
                    pitch.fit_score >= 4 ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>{pitch.fit_score}</div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">Product–Influencer Fit Score / 10</p>
                    <p className="text-xs text-slate-600">{pitch.fit_reason}</p>
                  </div>
                </div>

                {/* DM notification preview */}
                <div className="bg-slate-900 rounded-2xl p-4">
                  <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">📱 Notification Preview</p>
                  <div className="bg-slate-800 rounded-xl px-4 py-3 flex items-start gap-3">
                    <img src={selectedInfluencer.avatar} className="w-8 h-8 rounded-full object-cover" />
                    <div>
                      <p className="text-xs font-semibold text-white">New message from your brand</p>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{pitch.dm_preview}</p>
                    </div>
                  </div>
                </div>

                {/* Subject line (email) */}
                <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
                  <p className="text-xs text-slate-400 mb-1 font-medium">📧 Email Subject Line</p>
                  <p className="text-sm font-semibold text-slate-800">{pitch.subject_line}</p>
                </div>

                {/* Full DM */}
                <div className="bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <img src={selectedInfluencer.avatar} className="w-6 h-6 rounded-full" />
                      <span className="text-sm font-semibold text-slate-800">{selectedInfluencer.handle}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex items-center gap-1 ${PLATFORM_COLORS[selectedInfluencer.platform]}`}>
                        {selectedInfluencer.platform === 'tiktok' ? <TikTokIcon /> : <Instagram className="w-3 h-3" />}
                        {PLATFORM_LABELS[selectedInfluencer.platform]}
                      </span>
                    </div>
                    <Button size="sm" variant="outline" onClick={copyToClipboard} className="gap-1.5 text-xs h-7">
                      <Copy className="w-3 h-3" />{copied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <div className="p-4">
                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{pitch.dm_text}</p>
                    </div>
                  </div>
                </div>

                {/* Deal summary */}
                <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xs text-violet-500 font-medium">Product Price</p>
                    <p className="text-sm font-bold text-violet-800">${sellPrice}</p>
                  </div>
                  <div>
                    <p className="text-xs text-violet-500 font-medium">Their Code</p>
                    <p className="text-sm font-bold text-violet-800">{discountCode}</p>
                  </div>
                  <div>
                    <p className="text-xs text-violet-500 font-medium">Commission</p>
                    <p className="text-sm font-bold text-violet-800">{commission}% / sale</p>
                  </div>
                </div>

                <Button onClick={generatePitch} variant="outline" className="w-full gap-2 text-sm">
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate pitch
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}