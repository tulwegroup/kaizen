import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const SECTIONS = ['discovery', 'outreach', 'tracking'];

function ResultBox({ data }) {
  if (!data) return null;
  return (
    <pre className="mt-4 p-4 bg-slate-900 text-green-400 rounded text-xs overflow-auto max-h-64 whitespace-pre-wrap">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
      {error}
    </div>
  );
}

export default function InfluencerEngine() {
  const [activeSection, setActiveSection] = useState('discovery');
  const [loading, setLoading] = useState('');
  const [results, setResults] = useState({});
  const [errors, setErrors] = useState({});

  // Form state
  const [influencerId, setInfluencerId] = useState('');
  const [messageTemplate, setMessageTemplate] = useState(
    "Hey {name}! We'd love to partner with you. Earn 15% commission on every sale with your exclusive code!"
  );
  const [commissionRate, setCommissionRate] = useState('15');
  const [orderId, setOrderId] = useState('');
  const [orderValue, setOrderValue] = useState('');
  const [discountUsed, setDiscountUsed] = useState('');

  const run = async (key, fn, functionName, payload) => {
    setLoading(key);
    setErrors(e => ({ ...e, [key]: '' }));
    try {
      const res = await base44.functions.invoke(functionName, payload);
      setResults(r => ({ ...r, [key]: res.data }));
    } catch (e) {
      setErrors(er => ({ ...er, [key]: e?.response?.data?.error || e.message }));
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-1">Influencer Engine</h1>
        <p className="text-slate-500 mb-6 text-sm">Test discovery, outreach, and tracking end-to-end.</p>

        {/* Nav */}
        <div className="flex gap-2 mb-6">
          {SECTIONS.map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                activeSection === s
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── DISCOVERY ─────────────────────────────────────────────────── */}
        {activeSection === 'discovery' && (
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="font-semibold text-slate-800">Filter by Follower Size</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Returns profiles in 10k–200k follower range</p>
                </div>
                <Badge variant="secondary">10k–200k</Badge>
              </div>
              <Button
                size="sm"
                onClick={() => run('filter', null, 'influencerDiscovery', { action: 'filter_by_size', min_followers: 10000, max_followers: 200000 })}
                disabled={loading === 'filter'}
              >
                {loading === 'filter' ? 'Filtering…' : 'Run Filter'}
              </Button>
              <ResultBox data={results.filter} />
              <ErrorBox error={errors.filter} />
            </Card>

            <Card className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="font-semibold text-slate-800">Score Engagement</h2>
                  <p className="text-slate-500 text-xs mt-0.5">Computes 0–100 quality score for all profiles</p>
                </div>
                <Badge variant="secondary">0–100</Badge>
              </div>
              <Button
                size="sm"
                onClick={() => run('score', null, 'influencerDiscovery', { action: 'score_engagement' })}
                disabled={loading === 'score'}
              >
                {loading === 'score' ? 'Scoring…' : 'Score All'}
              </Button>
              <ResultBox data={results.score} />
              <ErrorBox error={errors.score} />
            </Card>
          </div>
        )}

        {/* ── OUTREACH ──────────────────────────────────────────────────── */}
        {activeSection === 'outreach' && (
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Influencer ID</h2>
              <Input
                placeholder="Paste influencer ID from discovery results above"
                value={influencerId}
                onChange={e => setInfluencerId(e.target.value)}
                className="mb-1 font-mono text-xs"
              />
              <p className="text-slate-400 text-xs">Used for all outreach actions below</p>
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-slate-800 mb-1">Generate Discount Code</h2>
              <p className="text-slate-500 text-xs mb-3">Creates a unique discount code and saves it to the profile</p>
              <Button
                size="sm"
                onClick={() => run('discount', null, 'influencerOutreach', { action: 'generate_discount', influencer_id: influencerId })}
                disabled={!influencerId || loading === 'discount'}
              >
                {loading === 'discount' ? 'Generating…' : 'Generate Code'}
              </Button>
              <ResultBox data={results.discount} />
              <ErrorBox error={errors.discount} />
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-slate-800 mb-1">Generate Referral Link</h2>
              <p className="text-slate-500 text-xs mb-3">Builds a UTM tracking link (requires discount code first)</p>
              <Button
                size="sm"
                onClick={() => run('referral', null, 'influencerOutreach', { action: 'generate_referral', influencer_id: influencerId })}
                disabled={!influencerId || loading === 'referral'}
              >
                {loading === 'referral' ? 'Generating…' : 'Generate Link'}
              </Button>
              <ResultBox data={results.referral} />
              <ErrorBox error={errors.referral} />
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Send Outreach</h2>
              <Textarea
                className="mb-3 text-sm font-mono"
                rows={3}
                value={messageTemplate}
                onChange={e => setMessageTemplate(e.target.value)}
              />
              <div className="flex gap-2 mb-1">
                <Input
                  type="number"
                  placeholder="Commission %"
                  value={commissionRate}
                  onChange={e => setCommissionRate(e.target.value)}
                  className="w-36"
                />
                <Button
                  size="sm"
                  onClick={() => run('outreach', null, 'influencerOutreach', {
                    action: 'send_outreach',
                    influencer_id: influencerId,
                    message_template: messageTemplate,
                    commission_rate: Number(commissionRate),
                  })}
                  disabled={!influencerId || !messageTemplate || loading === 'outreach'}
                >
                  {loading === 'outreach' ? 'Sending…' : 'Send Outreach'}
                </Button>
              </div>
              <ResultBox data={results.outreach} />
              <ErrorBox error={errors.outreach} />
            </Card>
          </div>
        )}

        {/* ── TRACKING ──────────────────────────────────────────────────── */}
        {activeSection === 'tracking' && (
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Leaderboard</h2>
              <div className="flex gap-2 flex-wrap mb-3">
                {['engagement', 'conversions', 'commission'].map(sort => (
                  <Button
                    key={sort}
                    size="sm"
                    variant="outline"
                    onClick={() => run(`leader_${sort}`, null, 'influencerTracking', { action: 'leaderboard', limit: 10, sort_by: sort })}
                    disabled={!!loading}
                  >
                    {loading === `leader_${sort}` ? '…' : `Sort by ${sort}`}
                  </Button>
                ))}
              </div>
              <ResultBox data={results[`leader_engagement`] || results[`leader_conversions`] || results[`leader_commission`]} />
              <ErrorBox error={errors[`leader_engagement`] || errors[`leader_conversions`] || errors[`leader_commission`]} />
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Get Influencer Metrics</h2>
              <div className="flex gap-2 mb-1">
                <Input
                  placeholder="Influencer ID"
                  value={influencerId}
                  onChange={e => setInfluencerId(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => run('metrics', null, 'influencerTracking', { action: 'get_metrics', influencer_id: influencerId })}
                  disabled={!influencerId || loading === 'metrics'}
                >
                  {loading === 'metrics' ? '…' : 'Get Metrics'}
                </Button>
              </div>
              <ResultBox data={results.metrics} />
              <ErrorBox error={errors.metrics} />
            </Card>

            <Card className="p-5">
              <h2 className="font-semibold text-slate-800 mb-3">Track Conversion</h2>
              <div className="space-y-2 mb-3">
                <Input placeholder="Influencer ID" value={influencerId} onChange={e => setInfluencerId(e.target.value)} className="font-mono text-xs" />
                <Input placeholder="Shopify Order ID" value={orderId} onChange={e => setOrderId(e.target.value)} />
                <Input placeholder="Order Value (e.g. 49.99)" type="number" value={orderValue} onChange={e => setOrderValue(e.target.value)} />
                <Input placeholder="Discount Code Used (optional)" value={discountUsed} onChange={e => setDiscountUsed(e.target.value)} />
              </div>
              <Button
                size="sm"
                onClick={() => run('conversion', null, 'influencerTracking', {
                  action: 'track_conversion',
                  influencer_id: influencerId,
                  shopify_order_id: orderId,
                  conversion_value: Number(orderValue),
                  discount_code_used: discountUsed || undefined,
                })}
                disabled={!influencerId || !orderId || !orderValue || loading === 'conversion'}
              >
                {loading === 'conversion' ? 'Tracking…' : 'Track Conversion'}
              </Button>
              <ResultBox data={results.conversion} />
              <ErrorBox error={errors.conversion} />
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}