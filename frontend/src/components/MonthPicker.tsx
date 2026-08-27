import { berlinYearMonth } from "../lib/berlin";
import { btnSecondary, inputClass } from "../ui";

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function yearOptions(selected: number) {
  const now = berlinYearMonth().year;
  const years = new Set<number>();
  for (let y = now - 5; y <= now + 2; y++) years.add(y);
  years.add(selected);
  return [...years].sort((a, b) => a - b);
}

export function MonthPicker({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  return (
    <section className="flex gap-3">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        Year
        <select
          className={inputClass}
          value={year}
          onChange={(e) => onChange(Number(e.target.value), month)}
        >
          {yearOptions(year).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm">
        Month
        <select
          className={inputClass}
          value={month}
          onChange={(e) => onChange(year, Number(e.target.value))}
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

export function TabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[var(--ts-line)]">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`${btnSecondary} shrink-0 rounded-b-none border-b-0 ${
            value === tab.id ? "bg-[var(--ts-ink)] text-[var(--ts-bg)]" : ""
          }`}
          aria-current={value === tab.id ? "page" : undefined}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
