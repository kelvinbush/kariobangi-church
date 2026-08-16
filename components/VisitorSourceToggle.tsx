"use client";

const colors = {
  bg: '#f4f4f5',
  text: { primary: '#141414', secondary: '#525252', muted: '#a1a1a1' },
  accent: { amber: '#0D9762', amberLight: '#a7ddc7' },
};

type Props = {
  /** true = first time in the ministry (came from another church), false = visiting from one of our branches, null = not recorded */
  value: boolean | null;
  onChange: (value: boolean) => void;
  label?: string;
};

/**
 * Records where a visitor came from: another church entirely (a genuine
 * first-timer for the ministry) or one of our own branches.
 */
export default function VisitorSourceToggle({ value, onChange, label = "Where are they from?" }: Props) {
  const options = [
    { value: true, title: "Another church", hint: "First time in the ministry" },
    { value: false, title: "One of our branches", hint: "Already in the ministry" },
  ];

  return (
    <div>
      <div className="text-xs mb-1.5" style={{ color: colors.text.muted }}>
        {label}
        {value === null && <span className="ml-1.5 italic">· not recorded</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              className="px-3 py-2 rounded-xl text-left border transition-colors"
              style={{
                backgroundColor: active ? colors.accent.amberLight : colors.bg,
                borderColor: active ? colors.accent.amber : 'rgba(0,0,0,0.08)',
              }}
            >
              <span className="text-xs block" style={{ color: colors.text.primary, fontWeight: active ? 600 : 400 }}>
                {option.title}
              </span>
              <span className="text-[10px] block mt-0.5" style={{ color: colors.text.secondary }}>
                {option.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
