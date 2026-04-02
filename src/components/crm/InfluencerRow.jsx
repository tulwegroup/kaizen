import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, Check, Zap, Pencil } from 'lucide-react';

const STATUS_ORDER = ['discovered', 'contacted', 'sample_sent', 'content_posted', 'active', 'inactive'];

const STATUS_STYLES = {
  discovered:     'bg-slate-100 text-slate-600',
  contacted:      'bg-blue-100 text-blue-700',
  sample_sent:    'bg-amber-100 text-amber-700',
  content_posted: 'bg-violet-100 text-violet-700',
  active:         'bg-emerald-100 text-emerald-700',
  inactive:       'bg-red-100 text-red-600',
};

const PLATFORM_ICONS = { tiktok: '🎵', instagram: '📸', youtube: '▶️' };
const NICHE_ICONS = { fashion: '👗', beauty: '💄', lifestyle: '🏡', tech: '📱', fitness: '💪', home: '🛋️', digital: '🎨', gaming: '🎮', pet: '🐾', kids: '👶', outdoor: '🏕️', education: '📚' };

export default function InfluencerRow({ profile, stats, onStatusChange, onGenerateCode, onEdit }) {
  const [copied, setCopied] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  const copyCode = () => {
    if (!profile.discount_code) return;
    navigator.clipboard.writeText(profile.discount_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const nextStatus = () => {
    const idx = STATUS_ORDER.indexOf(profile.status);
    if (idx < STATUS_ORDER.length - 2) { // don't auto-advance to inactive
      onStatusChange(profile.id, STATUS_ORDER[idx + 1]);
    }
  };

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      {/* Influencer */}
      <td className="px-4 py-3">
        <div className="font-semibold text-slate-800">
          {PLATFORM_ICONS[profile.platform] || '👤'} @{profile.platform_username}
        </div>
        {profile.contact_email && (
          <div className="text-xs text-slate-400 mt-0.5">{profile.contact_email}</div>
        )}
        {profile.follower_count > 0 && (
          <div className="text-xs text-slate-400">{(profile.follower_count / 1000).toFixed(0)}k followers</div>
        )}
      </td>

      {/* Platform */}
      <td className="px-4 py-3 text-slate-600 capitalize">{profile.platform}</td>

      {/* Niche */}
      <td className="px-4 py-3">
        <span className="text-xs capitalize">
          {NICHE_ICONS[profile.niche] || '🎯'} {profile.niche || '—'}
        </span>
      </td>

      {/* Status with dropdown */}
      <td className="px-4 py-3">
        <select
          value={profile.status || 'discovered'}
          onChange={e => onStatusChange(profile.id, e.target.value)}
          className={`text-xs font-semibold px-2 py-1 rounded-full border-0 cursor-pointer appearance-none ${STATUS_STYLES[profile.status] || 'bg-slate-100 text-slate-600'}`}
        >
          {STATUS_ORDER.map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </td>

      {/* Discount Code */}
      <td className="px-4 py-3">
        {profile.discount_code ? (
          <div className="flex items-center gap-1">
            <code className="text-xs bg-slate-100 px-2 py-0.5 rounded font-mono">{profile.discount_code}</code>
            <button onClick={copyCode} className="text-slate-400 hover:text-slate-700">
              {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        ) : (
          <button
            onClick={() => onGenerateCode(profile)}
            className="text-xs text-violet-600 hover:text-violet-800 flex items-center gap-1 font-medium"
          >
            <Zap className="w-3 h-3" /> Generate
          </button>
        )}
      </td>

      {/* Sales */}
      <td className="px-4 py-3 text-right text-slate-700 font-medium">{stats?.count || 0}</td>

      {/* Revenue */}
      <td className="px-4 py-3 text-right text-emerald-700 font-semibold">
        {stats ? `$${stats.total_revenue.toLocaleString()}` : '—'}
      </td>

      {/* Commission */}
      <td className="px-4 py-3 text-right text-amber-600 font-semibold">
        {stats ? `$${stats.total_commission.toLocaleString()}` : '—'}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <button onClick={onEdit} className="text-slate-400 hover:text-slate-700">
          <Pencil className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}