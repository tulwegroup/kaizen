import { Badge } from "@/components/ui/badge";

const REGIONS = [
  { id: "UAE", label: "🇦🇪 UAE" },
  { id: "Saudi Arabia", label: "🇸🇦 Saudi Arabia" },
  { id: "Egypt", label: "🇪🇬 Egypt" },
  { id: "United Kingdom", label: "🇬🇧 United Kingdom" },
  { id: "United States", label: "🇺🇸 United States" },
  { id: "Germany", label: "🇩🇪 Germany" },
  { id: "France", label: "🇫🇷 France" },
  { id: "Australia", label: "🇦🇺 Australia" },
  { id: "India", label: "🇮🇳 India" },
  { id: "Pakistan", label: "🇵🇰 Pakistan" },
  { id: "Turkey", label: "🇹🇷 Turkey" },
  { id: "Malaysia", label: "🇲🇾 Malaysia" },
  { id: "Canada", label: "🇨🇦 Canada" },
  { id: "South Africa", label: "🇿🇦 South Africa" },
];

export default function RegionSelector({ selected, onChange }) {
  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(r => r !== id) : [...selected, id]);
  };

  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">Target Regions <span className="text-slate-400 font-normal">(select one or more)</span></p>
      <div className="flex flex-wrap gap-2">
        {REGIONS.map(r => (
          <button
            key={r.id}
            onClick={() => toggle(r.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              selected.includes(r.id)
                ? 'bg-violet-600 text-white border-violet-600'
                : 'bg-white text-slate-700 border-slate-200 hover:border-violet-300'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}