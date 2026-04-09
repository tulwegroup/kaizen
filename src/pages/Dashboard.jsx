import { Link } from "react-router-dom";
import { Sparkles, Users, FlaskConical, ShoppingBag, Zap, Mail, Send, Globe, Tag } from "lucide-react";

const REGIONS_BY_GROUP = {
  "Middle East": ["🇦🇪 UAE","🇸🇦 Saudi Arabia","🇪🇬 Egypt","🇶🇦 Qatar","🇰🇼 Kuwait","🇧🇭 Bahrain","🇴🇲 Oman","🇯🇴 Jordan","🇱🇧 Lebanon","🇮🇶 Iraq"],
  "Europe": ["🇬🇧 United Kingdom","🇩🇪 Germany","🇫🇷 France","🇮🇹 Italy","🇪🇸 Spain","🇳🇱 Netherlands","🇸🇪 Sweden","🇵🇱 Poland","🇵🇹 Portugal","🇧🇪 Belgium","🇨🇭 Switzerland","🇦🇹 Austria","🇩🇰 Denmark","🇳🇴 Norway","🇫🇮 Finland","🇬🇷 Greece","🇨🇿 Czech Republic","🇷🇴 Romania","🇭🇺 Hungary","🇮🇪 Ireland"],
  "Americas": ["🇺🇸 United States","🇨🇦 Canada","🇧🇷 Brazil","🇲🇽 Mexico","🇦🇷 Argentina","🇨🇴 Colombia","🇨🇱 Chile","🇵🇪 Peru"],
  "Asia Pacific": ["🇮🇳 India","🇨🇳 China","🇯🇵 Japan","🇰🇷 South Korea","🇦🇺 Australia","🇳🇿 New Zealand","🇸🇬 Singapore","🇲🇾 Malaysia","🇮🇩 Indonesia","🇹🇭 Thailand","🇵🇭 Philippines","🇻🇳 Vietnam","🇹🇼 Taiwan","🇭🇰 Hong Kong"],
  "South Asia": ["🇵🇰 Pakistan","🇧🇩 Bangladesh","🇱🇰 Sri Lanka"],
  "Africa": ["🇿🇦 South Africa","🇳🇬 Nigeria","🇰🇪 Kenya","🇬🇭 Ghana","🇲🇦 Morocco","🇪🇹 Ethiopia"],
  "Other": ["🇹🇷 Turkey","🇷🇺 Russia","🇮🇱 Israel"],
};

const NICHES = [
  "👗 Fashion","💄 Beauty","🏡 Lifestyle","📱 Tech","💪 Fitness","🛋️ Home",
  "🎨 Digital Products","🔥 Viral / TikTok","🧘 Wellness","🎮 Gaming",
  "🐾 Pet Products","👶 Baby & Kids","🏕️ Outdoor & Travel","🍳 Kitchen","🚗 Auto Accessories",
];

const MENU_ITEMS = [
  {
    to: "/automated-pipeline",
    icon: Zap,
    color: "bg-slate-900 text-white",
    border: "border-slate-300 hover:border-slate-500",
    title: "🚀 Full Automated Pipeline",
    description: "One click: AI research → Shopify import → influencer outreach. Fully hands-off.",
    badge: "Auto",
    badgeColor: "bg-slate-900 text-white",
  },
  {
    to: "/agent-research",
    icon: Sparkles,
    color: "bg-violet-100 text-violet-600",
    border: "border-violet-200 hover:border-violet-400",
    title: "AI Research Agent",
    description: "Discover trending products by region with profit projections and influencer landscape analysis.",
    badge: "Core Feature",
    badgeColor: "bg-violet-100 text-violet-700",
  },
  {
    to: "/influencer-crm",
    icon: Users,
    color: "bg-blue-100 text-blue-600",
    border: "border-blue-200 hover:border-blue-400",
    title: "Influencer CRM",
    description: "Manage your influencer pipeline, track outreach status, discount codes and conversions.",
    badge: "CRM",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    to: "/influencer-engine",
    icon: Zap,
    color: "bg-amber-100 text-amber-600",
    border: "border-amber-200 hover:border-amber-400",
    title: "Influencer Engine",
    description: "Test discovery, scoring, outreach generation and conversion tracking workflows.",
    badge: "Engine",
    badgeColor: "bg-amber-100 text-amber-700",
  },
  {
    to: "/pipeline-test",
    icon: FlaskConical,
    color: "bg-emerald-100 text-emerald-600",
    border: "border-emerald-200 hover:border-emerald-400",
    title: "Pipeline Test",
    description: "Validate the end-to-end CJ Dropshipping → Shopify product sync pipeline.",
    badge: "Dev Tools",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    to: "/outreach-tester",
    icon: Send,
    color: "bg-violet-100 text-violet-600",
    border: "border-violet-200 hover:border-violet-400",
    title: "🧪 Outreach Tester",
    description: "Preview AI-generated influencer pitches on test accounts (TikTok & Instagram) before going live.",
    badge: "Test Mode",
    badgeColor: "bg-violet-100 text-violet-700",
  },
  {
    to: "/outreach-center",
    icon: Mail,
    color: "bg-blue-100 text-blue-600",
    border: "border-blue-200 hover:border-blue-400",
    title: "Outreach Center",
    description: "Send influencer outreach emails automatically. Track sent campaigns and manage pending messages.",
    badge: "Email",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    to: "/shopify-oauth",
    icon: ShoppingBag,
    color: "bg-green-100 text-green-600",
    border: "border-green-200 hover:border-green-400",
    title: "Shopify Connect",
    description: "Authorize your Shopify store and manage the OAuth connection for product imports.",
    badge: "Setup",
    badgeColor: "bg-green-100 text-green-700",
  },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <div className="p-2 bg-slate-900 rounded-xl">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Automated Research Agent</h1>
            <p className="text-xs text-slate-500">E-commerce research, influencer outreach & Shopify automation</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-6">All Modules</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`bg-white rounded-2xl border ${item.border} p-5 flex flex-col gap-3 transition-all hover:shadow-md`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2.5 rounded-xl ${item.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                </div>
                <div>
                  <h2 className="font-semibold text-slate-800 mb-1">{item.title}</h2>
                  <p className="text-sm text-slate-500 leading-relaxed">{item.description}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Research Coverage */}
        <div className="mt-14 space-y-8">
          {/* Niches */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Tag className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Product Categories Covered</p>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{NICHES.length} categories</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {NICHES.map(n => (
                <span key={n} className="px-3 py-1.5 rounded-full text-sm font-medium bg-white border border-slate-200 text-slate-700">{n}</span>
              ))}
            </div>
          </div>

          {/* Regions */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Countries & Regions Covered</p>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{Object.values(REGIONS_BY_GROUP).flat().length} countries</span>
            </div>
            <div className="space-y-4">
              {Object.entries(REGIONS_BY_GROUP).map(([group, countries]) => (
                <div key={group}>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{group}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {countries.map(c => (
                      <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-600">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}