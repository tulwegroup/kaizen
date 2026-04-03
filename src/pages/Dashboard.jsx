import { Link } from "react-router-dom";
import { Sparkles, Users, FlaskConical, ShoppingBag, Zap, Mail } from "lucide-react";

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
      </div>
    </div>
  );
}