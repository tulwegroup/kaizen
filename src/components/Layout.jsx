import { Link, useLocation, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { subscribe, getState } from "@/lib/researchStore";
import {
  Sparkles, Users, FlaskConical, ShoppingBag, Zap, Mail, Send,
  LayoutDashboard, ChevronLeft, ChevronRight, FileStack, Palette, RefreshCw, Package
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", color: "text-slate-600" },
  { to: "/agent-research", icon: Sparkles, label: "AI Research", color: "text-violet-600" },
  { to: "/automated-pipeline", icon: Zap, label: "Auto Pipeline", color: "text-slate-700" },
  { to: "/import-jobs", icon: FileStack, label: "Drafts & Jobs", color: "text-amber-600" },
  { to: "/products", icon: Package, label: "Product Catalog", color: "text-violet-600" },
  { to: "/influencer-crm", icon: Users, label: "Influencer CRM", color: "text-blue-600" },
  { to: "/influencer-engine", icon: Zap, label: "Influencer Engine", color: "text-amber-600" },
  { to: "/outreach-center", icon: Mail, label: "Outreach Center", color: "text-blue-600" },
  { to: "/outreach-tester", icon: Send, label: "Outreach Tester", color: "text-violet-600" },
  { to: "/shopify-oauth", icon: ShoppingBag, label: "Shopify", color: "text-green-600" },
  { to: "/shopify-theme", icon: Palette, label: "Theme Builder", color: "text-yellow-600" },
  { to: "/pipeline-test", icon: FlaskConical, label: "Pipeline Test", color: "text-emerald-600" },
];

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [researchRunning, setResearchRunning] = useState(getState().loading);

  useEffect(() => {
    return subscribe(s => setResearchRunning(s.loading));
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className={`${collapsed ? 'w-14' : 'w-52'} shrink-0 bg-white border-r border-slate-200 flex flex-col transition-all duration-200 sticky top-0 h-screen overflow-y-auto`}>
        {/* Logo */}
        <div className={`flex items-center gap-2.5 px-3 py-4 border-b border-slate-100 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          {!collapsed && <span className="font-bold text-sm text-slate-900 leading-tight">Research<br/>Agent</span>}
        </div>

        {/* Active research banner */}
        {researchRunning && (
          <Link to="/agent-research"
            className="mx-2 mt-2 flex items-center gap-1.5 bg-violet-600 text-white text-xs font-semibold px-2 py-1.5 rounded-lg animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
            {!collapsed && 'Research running…'}
          </Link>
        )}

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium transition-colors group relative
                  ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? item.color : 'text-slate-400'}`} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && item.badge && (
                  <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-semibold">{item.badge}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-slate-100">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}