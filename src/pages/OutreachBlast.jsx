import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Send, CheckCircle, AlertTriangle, RefreshCw, Sparkles, Mail, Filter, X, ChevronDown, ChevronUp, ShieldCheck, Zap, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import GenerateInfluencers from "@/components/outreach/GenerateInfluencers";
import BulkSendPanel from "@/components/outreach/BulkSendPanel";
import ResearchValidator from "@/components/outreach/ResearchValidator";

const TABS = [
  { id: "generate", label: "Generate Database", icon: Sparkles, color: "text-violet-600" },
  { id: "blast", label: "Bulk Email Blast", icon: Send, color: "text-blue-600" },
  { id: "validate", label: "Validate Research", icon: ShieldCheck, color: "text-emerald-600" },
];

export default function OutreachBlast() {
  const [tab, setTab] = useState("generate");

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
          <Mail className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Influencer Outreach Blast</p>
          <p className="text-xs text-slate-400">Generate influencer database · Personalized bulk email · Research validation</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-100 px-6">
        <div className="flex gap-0 max-w-4xl">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${tab === t.id ? `border-violet-600 text-violet-700` : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Icon className={`w-4 h-4 ${tab === t.id ? t.color : ''}`} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto p-6">
        {tab === "generate" && <GenerateInfluencers />}
        {tab === "blast" && <BulkSendPanel />}
        {tab === "validate" && <ResearchValidator />}
      </div>
    </div>
  );
}