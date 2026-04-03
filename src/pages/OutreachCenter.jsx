import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Mail, ChevronLeft, Send, CheckCircle, Clock, AlertCircle, Loader, RefreshCw } from "lucide-react";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-600",
  outreach_sent: "bg-blue-100 text-blue-700",
  accepted: "bg-emerald-100 text-emerald-700",
  active: "bg-green-100 text-green-700",
  completed: "bg-violet-100 text-violet-700",
  declined: "bg-red-100 text-red-600",
};

export default function OutreachCenter() {
  const [campaigns, setCampaigns] = useState([]);
  const [influencers, setInfluencers] = useState({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState({});
  const [sendingAll, setSendingAll] = useState(false);
  const [results, setResults] = useState(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [camps, infs] = await Promise.all([
      base44.entities.InfluencerCampaign.list('-created_date', 100),
      base44.entities.InfluencerProfile.list(),
    ]);
    const infMap = {};
    infs.forEach(inf => { infMap[inf.id] = inf; });
    setCampaigns(camps);
    setInfluencers(infMap);
    setLoading(false);
  };

  const sendOne = async (campaign) => {
    setSending(s => ({ ...s, [campaign.id]: true }));
    const res = await base44.functions.invoke('sendOutreachMessages', { action: 'send_campaign', campaign_id: campaign.id });
    setSending(s => ({ ...s, [campaign.id]: false }));
    setResults(res.data);
    await loadData();
  };

  const sendAll = async () => {
    const unsent = campaigns.filter(c => {
      const inf = influencers[c.influencer_id];
      return inf?.contact_email && !c.metadata?.email_sent;
    });
    if (!unsent.length) return;
    setSendingAll(true);
    const res = await base44.functions.invoke('sendOutreachMessages', {
      action: 'send_bulk',
      campaign_ids: unsent.map(c => c.id),
    });
    setResults(res.data);
    setSendingAll(false);
    await loadData();
  };

  const unsentWithEmail = campaigns.filter(c => {
    const inf = influencers[c.influencer_id];
    return inf?.contact_email && !c.metadata?.email_sent;
  });
  const sentCount = campaigns.filter(c => c.metadata?.email_sent).length;
  const noEmailCount = campaigns.filter(c => {
    const inf = influencers[c.influencer_id];
    return !inf?.contact_email;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/" className="text-slate-400 hover:text-slate-600"><ChevronLeft className="w-5 h-5" /></Link>
          <div className="p-2 bg-blue-600 rounded-xl"><Mail className="w-5 h-5 text-white" /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Outreach Center</h1>
            <p className="text-sm text-slate-500">Send influencer outreach emails automatically</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{sentCount}</p>
            <p className="text-xs text-slate-500 mt-1">Emails Sent</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{unsentWithEmail.length}</p>
            <p className="text-xs text-slate-500 mt-1">Ready to Send</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-2xl font-bold text-slate-400">{noEmailCount}</p>
            <p className="text-xs text-slate-500 mt-1">Missing Email</p>
          </div>
        </div>

        {/* Bulk send */}
        {unsentWithEmail.length > 0 && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-blue-800">{unsentWithEmail.length} campaign{unsentWithEmail.length !== 1 ? 's' : ''} ready to send</p>
              <p className="text-xs text-blue-600">All influencers with a contact email on file</p>
            </div>
            <Button onClick={sendAll} disabled={sendingAll} className="bg-blue-600 hover:bg-blue-700 text-white">
              {sendingAll ? <><Loader className="w-4 h-4 animate-spin mr-2" />Sending…</> : <><Send className="w-4 h-4 mr-2" />Send All</>}
            </Button>
          </div>
        )}

        {/* Last result toast */}
        {results && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${results.sent > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
            ✓ {results.sent} sent · {results.skipped} skipped · {results.failed} failed
          </div>
        )}

        {/* Missing email notice */}
        {noEmailCount > 0 && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>{noEmailCount} influencer{noEmailCount !== 1 ? 's' : ''} have no contact email — <Link to="/influencer-crm" className="underline font-medium">add emails in the CRM</Link> to enable email outreach for them.</p>
          </div>
        )}

        {/* Campaign list */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">All Campaigns</CardTitle>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8"><Loader className="w-6 h-6 animate-spin text-slate-400" /></div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No campaigns yet. Run the <Link to="/automated-pipeline" className="underline text-blue-500">Automated Pipeline</Link> to create some.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {campaigns.map(campaign => {
                  const inf = influencers[campaign.influencer_id];
                  const emailSent = campaign.metadata?.email_sent;
                  const hasEmail = !!inf?.contact_email;
                  return (
                    <div key={campaign.id} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{campaign.campaign_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-500">@{inf?.platform_username || '—'}</span>
                          {inf?.contact_email && <span className="text-xs text-slate-400">{inf.contact_email}</span>}
                          {!hasEmail && <span className="text-xs text-amber-600 font-medium">No email</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[campaign.status] || 'bg-slate-100 text-slate-600'}`}>
                          {campaign.status?.replace(/_/g, ' ')}
                        </span>
                        {emailSent ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> Sent
                          </span>
                        ) : hasEmail ? (
                          <Button size="sm" variant="outline"
                            disabled={sending[campaign.id]}
                            onClick={() => sendOne(campaign)}
                            className="h-7 text-xs px-2.5">
                            {sending[campaign.id] ? <Loader className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3 mr-1" />Send</>}
                          </Button>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock className="w-3.5 h-3.5" /> Pending email
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}