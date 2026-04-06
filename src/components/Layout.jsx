import { Link, useLocation, Outlet } from "react-router-dom";
import { useState, useEffect } from "react";
import { subscribe, getState } from "@/lib/researchStore";
import {
  Sparkles, Users, FlaskConical, ShoppingBag, Zap, Mail, Send,
  LayoutDashboard, ChevronLeft, ChevronRight, FileStack, Palette, RefreshCw, Package,
  X, Menu
} from "lucide-react";

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [researchRunning, setResearchRunning] = useState(getState().loading);

  useEffect(() => {
    return subscribe(s => setResearchRunning(s.loading));
  }, []);

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-3 py-4 border-b border-slate-100 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {!collapsed && <span className="font-bold text-sm text-slate-900 leading-tight">Research<br/>Agent</span>}
        {/* Mobile close button */}
        <button onClick={() => setMobileOpen(false)} className="ml-auto md:hidden text-slate-400">
          <X className="w-5 h-5" />
        </button>
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
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle — desktop only */}
      <div className="p-2 border-t border-slate-100 hidden md:block">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setMobileOpen(true)} className="text-slate-500">
          <Menu className="w-5 h-5" />
        </button>
        <div className="w-6 h-6 rounded bg-slate-900 flex items-center justify-center">
          <Sparkles className="w-3 h-3 text-white" />
        </div>
        <span className="font-bold text-sm text-slate-900">Research Agent</span>
        {researchRunning && (
          <span className="ml-auto flex items-center gap-1 text-xs text-violet-600 font-semibold">
            <RefreshCw className="w-3 h-3 animate-spin" /> Running…
          </span>
        )}
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white flex flex-col h-full overflow-y-auto shadow-xl">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className={`${collapsed ? 'w-14' : 'w-52'} shrink-0 bg-white border-r border-slate-200 hidden md:flex flex-col transition-all duration-200 sticky top-0 h-screen overflow-y-auto`}>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  );
}