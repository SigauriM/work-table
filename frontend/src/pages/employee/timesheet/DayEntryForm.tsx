import type { FormEvent } from "react";
import { TimeField } from "../../../components/TimeField";
import { useI18n } from "../../../i18n/useI18n";
import { isoToBerlinDateTimeParts } from "../../../lib/datetime";
import { formatDayShort, formatDayTitle, formatHours } from "../../../lib/timesheet";
import { inputClass } from "../../../ui";
import type { DayEntry, DayTimes, EntryKind, FormKind } from "./types";

export function DayEntryForm({
  dateYmd,
  today,
  entries,
  hours,
  norm,
  delta,
  formKind,
  form,
  previewHours,
  editing,
  pending,
  showBack,
  onBack,
  onType,
  onForm,
  onEdit,
  onDelete,
  onSubmit,
  onCancelEdit,
}: {
  dateYmd: string;
  today: string;
  entries: DayEntry[];
  hours: number;
  norm: number;
  delta: { text: string; color: string };
  formKind: FormKind;
  form: DayTimes;
  previewHours: number;
  editing: { kind: EntryKind; id: string } | null;
  pending: boolean;
  showBack: boolean;
  onBack: () => void;
  onType: (kind: FormKind) => void;
  onForm: (next: DayTimes) => void;
  onEdit: (entry: DayEntry) => void;
  onDelete: (entry: DayEntry) => void;
  onSubmit: (e: FormEvent) => void;
  onCancelEdit: () => void;
}) {
  const { t, localeTag } = useI18n();
  const year = dateYmd.slice(0, 4);
  const isShift = formKind === "shift";
  const typePills: { id: FormKind; label: string; enabled: boolean }[] = [
    { id: "shift", label: t("shift"), enabled: true },
    { id: "sick", label: t("sick"), enabled: true },
    { id: "vacation", label: t("vacation"), enabled: false },
    { id: "off", label: t("timeOff"), enabled: false },
  ];

  return (
    <div className="flex flex-col gap-5">
      {showBack ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="min-h-11 text-[13px] font-semibold text-[var(--ts-mute)]"
            onClick={onBack}
          >
            ‹ {t("back")}
          </button>
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="whitespace-nowrap text-[22px] font-bold tracking-tight md:text-[19px]">
            {formatDayTitle(dateYmd, localeTag)}
          </div>
          <div className="mt-0.5 whitespace-nowrap text-xs text-[var(--ts-mute)]">
            {year} · {t("norm")} {formatHours(norm)}
            {dateYmd === today ? ` · ${t("today")}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[22px] font-bold tracking-tight md:text-xl">{formatHours(hours)}</div>
          <div className="text-[11.5px]" style={{ color: delta.color }}>
            {delta.text}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {entries.map((entry) => (
          <EntryRow
            key={entry.kind === "shift" ? entry.shift.id : entry.sick.id}
            entry={entry}
            onEdit={() => onEdit(entry)}
            onDelete={() => void onDelete(entry)}
          />
        ))}
        {entries.length === 0 ? (
          <div className="border-b border-[var(--ts-fill)] pb-3.5 text-[13px] text-[var(--ts-mute)]">
            {t("nothingLogged")}
          </div>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="mt-auto flex flex-col gap-3.5">
        <div className="text-[11px] font-semibold tracking-[0.08em] text-[var(--ts-faint)] uppercase">
          {editing ? t("editEntry") : t("addEntry")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {typePills.map((pill) => {
            const on = formKind === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                disabled={!pill.enabled}
                onClick={() => onType(pill.id)}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap disabled:opacity-40"
                style={{
                  background: on ? "var(--ts-ink)" : "transparent",
                  color: on ? "var(--ts-bg)" : "var(--ts-ink)",
                  boxShadow: on ? "none" : "inset 0 0 0 1px var(--ts-line)",
                }}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
        {isShift ? (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <TimeField
                label={t("start")}
                value={form.startTime}
                onChange={(startTime) => onForm({ ...form, startTime })}
                required
                disabled={pending}
              />
              <TimeField
                label={t("end")}
                value={form.endTime}
                onChange={(endTime) => onForm({ ...form, endTime })}
                required
                disabled={pending}
              />
              <TimeField
                label={t("breakStart")}
                value={form.breakStart}
                onChange={(breakStart) => onForm({ ...form, breakStart })}
                disabled={pending}
              />
              <TimeField
                label={t("breakEnd")}
                value={form.breakEnd}
                onChange={(breakEnd) => onForm({ ...form, breakEnd })}
                disabled={pending}
              />
            </div>
            <div className="flex items-baseline justify-between text-[12.5px] text-[var(--ts-mute)]">
              <span>{t("counted")}</span>
              <span className="text-[15px] font-bold text-[var(--ts-ink)]">
                {formatHours(previewHours)}
              </span>
            </div>
          </div>
        ) : null}
        <label className="flex flex-col gap-1 text-xs text-[var(--ts-mute)]">
          {t("note")}
          <input
            className={inputClass}
            placeholder={t("optional")}
            value={form.note}
            onChange={(e) => onForm({ ...form, note: e.target.value })}
            disabled={pending}
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={pending || (formKind !== "shift" && formKind !== "sick")}
            className="min-h-11 flex-1 rounded-full bg-[var(--ts-ink)] px-3 py-3 text-[13.5px] font-semibold text-[var(--ts-bg)] disabled:opacity-50"
          >
            {pending
              ? t("saving")
              : editing
                ? t("save")
                : `${t("addTo")} ${formatDayShort(dateYmd, localeTag)}`}
          </button>
          {editing ? (
            <button
              type="button"
              className="min-h-11 rounded-full px-3 text-sm font-semibold text-[var(--ts-mute)]"
              onClick={onCancelEdit}
            >
              {t("cancel")}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

function EntryRow({
  entry,
  onEdit,
  onDelete,
}: {
  entry: DayEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  const isShift = entry.kind === "shift";
  const start = isShift ? isoToBerlinDateTimeParts(entry.shift.startTime).time : null;
  const end = isShift ? isoToBerlinDateTimeParts(entry.shift.endTime).time : null;
  const b0 =
    isShift && entry.shift.breakStart
      ? isoToBerlinDateTimeParts(entry.shift.breakStart).time
      : null;
  const b1 =
    isShift && entry.shift.breakEnd ? isoToBerlinDateTimeParts(entry.shift.breakEnd).time : null;
  const note = isShift ? entry.shift.note : entry.sick.note;

  return (
    <div className="flex flex-col gap-1.5 border-b border-[var(--ts-fill)] pb-3.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold tracking-[0.06em] text-[var(--ts-faint)] uppercase">
          {isShift ? t("shift") : t("sick")}
        </span>
        <span className="ml-auto text-[15px] font-bold">{formatHours(entry.hours)}</span>
      </div>
      <div className="text-[14.5px] font-semibold">
        {isShift && start && end ? `${start} – ${end}` : t("fullDay")}
      </div>
      {b0 && b1 ? (
        <div className="text-xs text-[var(--ts-mute)]">
          {t("break")} {b0} – {b1}
        </div>
      ) : null}
      {note ? <div className="text-[12.5px] text-[var(--ts-mute)]">{note}</div> : null}
      <div className="mt-0.5 flex gap-4">
        <button
          type="button"
          className="min-h-11 text-[12.5px] font-semibold text-[var(--ts-ink)] underline underline-offset-4"
          onClick={onEdit}
        >
          {t("edit")}
        </button>
        <button
          type="button"
          className="min-h-11 text-[12.5px] font-semibold text-[var(--ts-under)] underline underline-offset-4"
          onClick={onDelete}
        >
          {t("delete")}
        </button>
      </div>
    </div>
  );
}
