import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X } from 'lucide-react';

const PLATFORMS = ['tiktok', 'instagram', 'youtube'];
const NICHES = ['fashion', 'beauty', 'lifestyle', 'tech', 'fitness', 'home', 'digital', 'education', 'gaming', 'pet', 'kids', 'outdoor', 'other'];
const STATUSES = ['discovered', 'contacted', 'sample_sent', 'content_posted', 'active', 'inactive'];

export default function InfluencerFormModal({ profile, onSave, onClose }) {
  const [form, setForm] = useState({
    platform: profile?.platform || 'instagram',
    platform_username: profile?.platform_username || '',
    platform_user_id: profile?.platform_user_id || '',
    follower_count: profile?.follower_count || '',
    engagement_rate: profile?.engagement_rate || '',
    niche: profile?.niche || 'lifestyle',
    status: profile?.status || 'discovered',
    contact_email: profile?.contact_email || '',
    contact_instagram: profile?.contact_instagram || '',
    discount_code: profile?.discount_code || '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...form,
      follower_count: Number(form.follower_count) || 0,
      engagement_rate: Number(form.engagement_rate) || 0,
      platform_user_id: form.platform_user_id || form.platform_username,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-slate-800 text-lg">{profile ? 'Edit Influencer' : 'Add Influencer'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Platform</label>
              <select value={form.platform} onChange={e => set('platform', e.target.value)}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Niche</label>
              <select value={form.niche} onChange={e => set('niche', e.target.value)}
                className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
                {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Username *</label>
            <Input required value={form.platform_username} onChange={e => set('platform_username', e.target.value)} placeholder="@username" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Followers</label>
              <Input type="number" value={form.follower_count} onChange={e => set('follower_count', e.target.value)} placeholder="e.g. 50000" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Engagement %</label>
              <Input type="number" step="0.1" value={form.engagement_rate} onChange={e => set('engagement_rate', e.target.value)} placeholder="e.g. 4.2" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm bg-white">
              {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Contact Email</label>
            <Input type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="email@example.com" />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Discount Code</label>
            <Input value={form.discount_code} onChange={e => set('discount_code', e.target.value)} placeholder="Leave blank to auto-generate later" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{profile ? 'Save Changes' : 'Add Influencer'}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}