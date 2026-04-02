const REGIONS = [
  // Middle East
  { id: "UAE", label: "🇦🇪 UAE", group: "Middle East" },
  { id: "Saudi Arabia", label: "🇸🇦 Saudi Arabia", group: "Middle East" },
  { id: "Egypt", label: "🇪🇬 Egypt", group: "Middle East" },
  { id: "Qatar", label: "🇶🇦 Qatar", group: "Middle East" },
  { id: "Kuwait", label: "🇰🇼 Kuwait", group: "Middle East" },
  { id: "Bahrain", label: "🇧🇭 Bahrain", group: "Middle East" },
  { id: "Oman", label: "🇴🇲 Oman", group: "Middle East" },
  { id: "Jordan", label: "🇯🇴 Jordan", group: "Middle East" },
  { id: "Lebanon", label: "🇱🇧 Lebanon", group: "Middle East" },
  { id: "Iraq", label: "🇮🇶 Iraq", group: "Middle East" },
  // Europe
  { id: "United Kingdom", label: "🇬🇧 United Kingdom", group: "Europe" },
  { id: "Germany", label: "🇩🇪 Germany", group: "Europe" },
  { id: "France", label: "🇫🇷 France", group: "Europe" },
  { id: "Italy", label: "🇮🇹 Italy", group: "Europe" },
  { id: "Spain", label: "🇪🇸 Spain", group: "Europe" },
  { id: "Netherlands", label: "🇳🇱 Netherlands", group: "Europe" },
  { id: "Sweden", label: "🇸🇪 Sweden", group: "Europe" },
  { id: "Poland", label: "🇵🇱 Poland", group: "Europe" },
  { id: "Portugal", label: "🇵🇹 Portugal", group: "Europe" },
  { id: "Belgium", label: "🇧🇪 Belgium", group: "Europe" },
  { id: "Switzerland", label: "🇨🇭 Switzerland", group: "Europe" },
  { id: "Austria", label: "🇦🇹 Austria", group: "Europe" },
  { id: "Denmark", label: "🇩🇰 Denmark", group: "Europe" },
  { id: "Norway", label: "🇳🇴 Norway", group: "Europe" },
  { id: "Finland", label: "🇫🇮 Finland", group: "Europe" },
  { id: "Greece", label: "🇬🇷 Greece", group: "Europe" },
  { id: "Czech Republic", label: "🇨🇿 Czech Republic", group: "Europe" },
  { id: "Romania", label: "🇷🇴 Romania", group: "Europe" },
  { id: "Hungary", label: "🇭🇺 Hungary", group: "Europe" },
  { id: "Ireland", label: "🇮🇪 Ireland", group: "Europe" },
  // Americas
  { id: "United States", label: "🇺🇸 United States", group: "Americas" },
  { id: "Canada", label: "🇨🇦 Canada", group: "Americas" },
  { id: "Brazil", label: "🇧🇷 Brazil", group: "Americas" },
  { id: "Mexico", label: "🇲🇽 Mexico", group: "Americas" },
  { id: "Argentina", label: "🇦🇷 Argentina", group: "Americas" },
  { id: "Colombia", label: "🇨🇴 Colombia", group: "Americas" },
  { id: "Chile", label: "🇨🇱 Chile", group: "Americas" },
  { id: "Peru", label: "🇵🇪 Peru", group: "Americas" },
  // Asia Pacific
  { id: "India", label: "🇮🇳 India", group: "Asia Pacific" },
  { id: "China", label: "🇨🇳 China", group: "Asia Pacific" },
  { id: "Japan", label: "🇯🇵 Japan", group: "Asia Pacific" },
  { id: "South Korea", label: "🇰🇷 South Korea", group: "Asia Pacific" },
  { id: "Australia", label: "🇦🇺 Australia", group: "Asia Pacific" },
  { id: "New Zealand", label: "🇳🇿 New Zealand", group: "Asia Pacific" },
  { id: "Singapore", label: "🇸🇬 Singapore", group: "Asia Pacific" },
  { id: "Malaysia", label: "🇲🇾 Malaysia", group: "Asia Pacific" },
  { id: "Indonesia", label: "🇮🇩 Indonesia", group: "Asia Pacific" },
  { id: "Thailand", label: "🇹🇭 Thailand", group: "Asia Pacific" },
  { id: "Philippines", label: "🇵🇭 Philippines", group: "Asia Pacific" },
  { id: "Vietnam", label: "🇻🇳 Vietnam", group: "Asia Pacific" },
  { id: "Taiwan", label: "🇹🇼 Taiwan", group: "Asia Pacific" },
  { id: "Hong Kong", label: "🇭🇰 Hong Kong", group: "Asia Pacific" },
  // South Asia
  { id: "Pakistan", label: "🇵🇰 Pakistan", group: "South Asia" },
  { id: "Bangladesh", label: "🇧🇩 Bangladesh", group: "South Asia" },
  { id: "Sri Lanka", label: "🇱🇰 Sri Lanka", group: "South Asia" },
  // Africa
  { id: "South Africa", label: "🇿🇦 South Africa", group: "Africa" },
  { id: "Nigeria", label: "🇳🇬 Nigeria", group: "Africa" },
  { id: "Kenya", label: "🇰🇪 Kenya", group: "Africa" },
  { id: "Ghana", label: "🇬🇭 Ghana", group: "Africa" },
  { id: "Morocco", label: "🇲🇦 Morocco", group: "Africa" },
  { id: "Ethiopia", label: "🇪🇹 Ethiopia", group: "Africa" },
  // Others
  { id: "Turkey", label: "🇹🇷 Turkey", group: "Other" },
  { id: "Russia", label: "🇷🇺 Russia", group: "Other" },
  { id: "Israel", label: "🇮🇱 Israel", group: "Other" },
];

const GROUPS = [...new Set(REGIONS.map(r => r.group))];

export default function RegionSelector({ selected, onChange }) {
  const toggle = (id) => {
    onChange(selected.includes(id) ? selected.filter(r => r !== id) : [...selected, id]);
  };

  const toggleGroup = (group) => {
    const ids = REGIONS.filter(r => r.group === group).map(r => r.id);
    const allSelected = ids.every(id => selected.includes(id));
    if (allSelected) {
      onChange(selected.filter(id => !ids.includes(id)));
    } else {
      onChange([...new Set([...selected, ...ids])]);
    }
  };

  return (
    <div>
      <p className="text-sm font-medium text-slate-700 mb-2">
        Target Regions <span className="text-slate-400 font-normal">(select one or more)</span>
      </p>
      <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
        {GROUPS.map(group => {
          const groupRegions = REGIONS.filter(r => r.group === group);
          const allSelected = groupRegions.every(r => selected.includes(r.id));
          return (
            <div key={group}>
              <div className="flex items-center gap-2 mb-1.5">
                <button
                  onClick={() => toggleGroup(group)}
                  className={`text-xs font-semibold px-2 py-0.5 rounded border transition-colors ${
                    allSelected ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'
                  }`}
                >
                  {group} {allSelected ? '✓' : '+ All'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {groupRegions.map(r => (
                  <button
                    key={r.id}
                    onClick={() => toggle(r.id)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
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
        })}
      </div>
      {selected.length > 0 && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-violet-600 font-medium">{selected.length} region{selected.length !== 1 ? 's' : ''} selected</p>
          <button onClick={() => onChange([])} className="text-xs text-slate-400 hover:text-slate-600">Clear all</button>
        </div>
      )}
    </div>
  );
}