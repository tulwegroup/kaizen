import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, TrendingUp, DollarSign, Plus, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';
import InfluencerFormModal from '@/components/crm/InfluencerFormModal';
import InfluencerRow from '@/components/crm/InfluencerRow';

const STATUS_ORDER = ['discovered', 'contacted', 'sample_sent', 'content_posted', 'active', 'inactive'];

const STATUS_STYLES = {
  discovered:     'bg-slate-100 text-slate-600',
  contacted:      'bg-blue-100 text-blue-700',
  sample_sent:    'bg-amber-100 text-amber-700',
  content_posted: 'bg-violet-100 text-violet-700',
  active:         'bg-emerald-100 text-emerald-700',
  inactive:       'bg-red-100 text-red-600',
};

export default function InfluencerCRM() {
  const [profiles, setProfiles] = useState([]);
  const [conversions, setConversions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editProfile, setEditProfile] = useState(null);

  const load = async () => {
    setLoading(true);
    const [p, c] = await Promise.all([
      base44.entities.InfluencerProfile.list('-created_date', 200),
      base44.entities.InfluencerConversion.list('-created_date', 500),
    ]);
    setProfiles(p);
    setConversions(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Aggregate conversions per influencer
  const conversionMap = {};
  for (const c of conversions) {
    if (!conversionMap[c.influencer_id]) {
      conversionMap[c.influencer_id] = { total_revenue: 0, total_commission: 0, count: 0 };
    }
    conversionMap[c.influencer_id].total_revenue += c.conversion_value || 0;
    conversionMap[c.influencer_id].total_commission += c.commission_earned || 0;
    conversionMap[c.influencer_id].count += 1;
  }

  const filtered = profiles.filter(p => {
    const matchSearch = !search || p.platform_username?.toLowerCase().includes(search.toLowerCase()) || p.niche?.includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // KPI totals
  const totalRevenue = Object.values(conversionMap).reduce((s, c) => s + c.total_revenue, 0);
  const totalCommission = Object.values(conversionMap).reduce((s, c) => s + c.total_commission, 0);
  const activeCount = profiles.filter(p => ['active', 'content_posted'].includes(p.status)).length;

  const handleSave = async (data) => {
    if (editProfile) {
      await base44.entities.InfluencerProfile.update(editProfile.id, data);
    } else {
      await base44.entities.InfluencerProfile.create(data);
    }
    setShowForm(false);
    setEditProfile(null);
    load();
  };

  const handleStatusChange = async (id, newStatus) => {
    await base44.entities.InfluencerProfile.update(id, { status: newStatus });
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, status: newStatus } : p));
  };

  const handleGenerateCode = async (profile) => {
    const code = `${profile.platform_username.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8)}${Math.floor(Math.random() * 9000) + 1000}`;
    await base44.entities.InfluencerProfile.update(profile.id, { discount_code: code });
    setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, discount_code: code } : p));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Influencer CRM</h1>
            <p className="text-slate-500 text-sm mt-0.5">Track outreach, samples, and sales attribution</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" onClick={() => { setEditProfile(null); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Add Influencer
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="bg-violet-50 border-violet-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-violet-500 font-medium uppercase tracking-wide">Total Influencers</p>
              <p className="text-3xl font-bold text-violet-700 mt-1">{profiles.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 border-blue-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-blue-500 font-medium uppercase tracking-wide">Active / Posting</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">{activeCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-emerald-50 border-emerald-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-emerald-500 font-medium uppercase tracking-wide">Total Revenue</p>
              <p className="text-3xl font-bold text-emerald-700 mt-1">${totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-amber-50 border-amber-100">
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-amber-500 font-medium uppercase tracking-wide">Commission Paid</p>
              <p className="text-3xl font-bold text-amber-700 mt-1">${totalCommission.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Pipeline kanban summary */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_ORDER.map(s => {
            const count = profiles.filter(p => p.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
                className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  filterStatus === s ? 'ring-2 ring-offset-1 ring-slate-400' : ''
                } ${STATUS_STYLES[s] || 'bg-slate-100 text-slate-600'}`}
              >
                <span className="capitalize">{s.replace('_', ' ')}</span>
                <span className="bg-white/60 px-1.5 py-0.5 rounded-full font-bold">{count}</span>
              </button>
            );
          })}
          {filterStatus !== 'all' && (
            <button onClick={() => setFilterStatus('all')} className="flex-shrink-0 text-xs text-slate-400 hover:text-slate-600 px-2">
              Clear filter ×
            </button>
          )}
        </div>

        {/* Search */}
        <Input
          placeholder="Search by username or niche..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm bg-white"
        />

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Influencer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Platform</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Niche</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Discount Code</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sales</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Revenue</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Commission</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400">No influencers found. Add your first one!</td></tr>
                ) : (
                  filtered.map(profile => (
                    <InfluencerRow
                      key={profile.id}
                      profile={profile}
                      stats={conversionMap[profile.id]}
                      onStatusChange={handleStatusChange}
                      onGenerateCode={handleGenerateCode}
                      onEdit={() => { setEditProfile(profile); setShowForm(true); }}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {showForm && (
        <InfluencerFormModal
          profile={editProfile}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditProfile(null); }}
        />
      )}
    </div>
  );
}