type TimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
};

/**
 * Visible chrome is ours (border, radius, Figtree, tokens). The native
 * `type="time"` sits on top, invisible and out of flow, so iOS min-width
 * cannot stretch the grid or paint a second pill.
 */
export function TimeField({
  label,
  value,
  onChange,
  required,
  disabled,
}: TimeFieldProps) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-[var(--ts-mute)]">
      {label}
      <span className="relative block min-h-11 min-w-0 overflow-hidden rounded-[10px] border border-[var(--ts-line)] bg-transparent">
        <span
          className={
            value
              ? "pointer-events-none flex min-h-11 items-center px-3 text-base text-[var(--ts-ink)]"
              : "pointer-events-none flex min-h-11 items-center px-3 text-base text-[var(--ts-faint)]"
          }
        >
          {value || "––:––"}
        </span>
        <input
          type="time"
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 z-10 h-full w-full min-w-0 cursor-pointer opacity-0"
        />
      </span>
    </label>
  );
}
