const PERIODS = [
  { id: "24h",    label: "24 Hours",   multiplier: 1/30,  desc: "Daily snapshot" },
  { id: "1week",  label: "1 Week",     multiplier: 7/30,  desc: "Weekly forecast" },
  { id: "1month", label: "1 Month",    multiplier: 1,     desc: "Monthly baseline" },
  { id: "3month", label: "3 Months",   multiplier: 3,     desc: "Quarterly projection" },
  { id: "6month", label: "6 Months",   multiplier: 6,     desc: "Half-year outlook" },
  { id: "1year",  label: "1 Year",     multiplier: 12,    desc: "Annual projection" },
];

export { PERIODS };

export default function PeriodSelector({ selected, onChange }) {
  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">
        Projection Period <span className="text-slate-400 font-normal">(anticipated sales window)</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {PERIODS.map(p => (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              selected === p.id
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
            }`}
          >
            <span className="block font-semibold">{p.label}</span>
            <span className="block text-xs opacity-70">{p.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}