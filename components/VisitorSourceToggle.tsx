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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-[11px]" style={{ color: colors.text.muted }}>
        {label}
        {value === null
          ? <span className="ml-1 italic">· not recorded</span>
          : <span className="ml-1">· {options.find((o) => o.value === value)?.hint}</span>}
      </span>
      <div className="flex gap-2 flex-1 min-w-[200px]">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={String(option.value)}
              type="button"
              title={option.hint}
              onClick={() => onChange(option.value)}
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl border transition-colors text-center"
              style={{
                backgroundColor: active ? colors.accent.amberLight : colors.bg,
                borderColor: active ? colors.accent.amber : 'rgba(0,0,0,0.08)',
              }}
            >
              <span className="text-[11px] block truncate" style={{ color: colors.text.primary, fontWeight: active ? 600 : 400 }}>
                {option.title}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
