const NICHES = [
  { id: "fashion", label: "👗 Fashion" },
  { id: "beauty", label: "💄 Beauty" },
  { id: "lifestyle", label: "🏡 Lifestyle" },
  { id: "tech", label: "📱 Tech" },
  { id: "fitness", label: "💪 Fitness" },
  { id: "home", label: "🛋️ Home" },
  { id: "digital", label: "🎨 Digital Products" },
  { id: "viral", label: "🔥 Viral / TikTok" },
  { id: "wellness", label: "🧘 Wellness" },
  { id: "gaming", label: "🎮 Gaming" },
  { id: "pet", label: "🐾 Pet Products" },
  { id: "baby", label: "👶 Baby & Kids" },
  { id: "outdoor", label: "🏕️ Outdoor & Travel" },
  { id: "kitchen", label: "🍳 Kitchen" },
  { id: "auto", label: "🚗 Auto Accessories" },
];

export default function NicheSelector({ selected, onChange }) {
  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(n => n !== id) : [...selected, id]);
  };

  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">
        Niches <span className="text-slate-400 font-normal">(optional — leave blank for all)</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {NICHES.map(n => (
          <button
            key={n.id}
            onClick={() => toggle(n.id)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              selected.includes(n.id)
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
            }`}
          >
            {n.label}
          </button>
        ))}
      </div>
    </div>
  );
}