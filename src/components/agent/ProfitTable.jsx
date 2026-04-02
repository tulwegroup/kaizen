import { TrendingUp, TrendingDown } from "lucide-react";

export default function ProfitTable({ projections = [] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Region</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Sell Price</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Est. Sales</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Revenue</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Influencer $</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Net Profit</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">ROI</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((p, i) => (
              <tr key={i} className={`border-b border-slate-100 hover:bg-slate-50 ${i === 0 ? 'bg-emerald-50/40' : ''}`}>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {i === 0 && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded mr-1">Top</span>}
                  {p.product_name}
                </td>
                <td className="px-4 py-3 text-slate-600">{p.region}</td>
                <td className="px-4 py-3 text-right text-slate-700">${p.recommended_sell_price}</td>
                <td className="px-4 py-3 text-right text-slate-700">{p.estimated_conversions}</td>
                <td className="px-4 py-3 text-right text-slate-700">${p.gross_revenue?.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-slate-500">${p.influencer_spend?.toLocaleString()}</td>
                <td className={`px-4 py-3 text-right font-semibold ${p.net_profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  ${p.net_profit?.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.roi_pct >= 100 ? 'bg-emerald-100 text-emerald-700' : p.roi_pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {p.roi_pct}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <div className="w-16 bg-slate-100 rounded-full h-1.5">
                      <div className="bg-violet-500 h-1.5 rounded-full" style={{ width: `${Math.min(p.priority_score, 100)}%` }} />
                    </div>
                    <span className="text-xs text-slate-500">{p.priority_score}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200">
              <td colSpan={6} className="px-4 py-3 font-semibold text-slate-700">Total Projected</td>
              <td className="px-4 py-3 text-right font-bold text-emerald-700">
                ${projections.reduce((s, p) => s + p.net_profit, 0).toLocaleString()}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}