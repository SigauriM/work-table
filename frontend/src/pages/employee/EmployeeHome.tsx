import { useEffect, useRef } from "react";
import { useAuth } from "../../auth/useAuth";
import { AppShell } from "../../components/AppShell";
import { employeeNav } from "../../components/nav";
import { useI18n } from "../../i18n/useI18n";
import { trapFocus } from "../../lib/focusTrap";
import { addUtcMonth, formatMonthLong, formatMonthShort } from "../../lib/timesheet";
import { useYearMonth } from "../../hooks/useYearMonth";
import { DayEntryForm } from "./timesheet/DayEntryForm";
import { MonthSummary } from "./timesheet/MonthSummary";
import { TimesheetCalendar } from "./timesheet/TimesheetCalendar";
import { useTimesheet } from "./timesheet/useTimesheet";

export default function EmployeeHome() {
  const { user } = useAuth();
  const { t, localeTag } = useI18n();
  const employeeId = user?.employeeId ?? null;
  const { year, month, setYearMonth } = useYearMonth();
  const sheet = useTimesheet(employeeId, year, month);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeMobileDay = sheet.closeMobileDay;

  useEffect(() => {
    if (!sheet.mobileDayOpen || !overlayRef.current) return;
    const el = overlayRef.current;
    const release = trapFocus(el);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileDay();
    };
    el.addEventListener("keydown", onKey);
    return () => {
      release();
      el.removeEventListener("keydown", onKey);
    };
  }, [sheet.mobileDayOpen, closeMobileDay]);

  if (!employeeId) {
    return (
      <AppShell title={t("timesheet")} nav={employeeNav}>
        <p>{t("noProfile")}</p>
      </AppShell>
    );
  }

  const dayForm = (showBack: boolean) => (
    <DayEntryForm
      dateYmd={sheet.selectedYmd}
      today={sheet.today}
      entries={sheet.selectedEntries}
      hours={sheet.selectedHours}
      norm={sheet.selectedNorm}
      delta={sheet.delta}
      formKind={sheet.formKind}
      form={sheet.form}
      previewHours={sheet.previewHours}
      editing={sheet.editing}
      pending={sheet.pending}
      showBack={showBack}
      onBack={closeMobileDay}
      onType={sheet.chooseType}
      onForm={sheet.setForm}
      onEdit={sheet.startEdit}
      onDelete={(entry) => void sheet.onDelete(entry)}
      onSubmit={(e) => void sheet.onSubmit(e)}
      onCancelEdit={sheet.onCancelEdit}
    />
  );

  return (
    <AppShell title={t("timesheet")} nav={employeeNav} hideHeader flush>
      <div className="flex min-h-[calc(100dvh-5.5rem)] flex-col xl:min-h-dvh xl:flex-row">
        <section className="flex flex-1 flex-col px-6 pb-8 pt-6 md:px-8 md:pt-7">
          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-[19px] font-bold tracking-tight md:hidden">{t("timesheet")}</div>
              <div className="mt-0.5 text-[12.5px] text-[var(--ts-mute)] md:hidden">
                {user?.login}
              </div>
              <div className="hidden items-center gap-3.5 md:flex">
                <button
                  type="button"
                  className="min-h-11 px-1 text-lg text-[var(--ts-mute)]"
                  aria-label={t("previousMonth")}
                  onClick={() => {
                    const next = addUtcMonth(year, month, -1);
                    setYearMonth(next.year, next.month);
                  }}
                >
                  ‹
                </button>
                <h1 className="text-xl font-bold tracking-tight whitespace-nowrap">
                  {formatMonthLong(year, month, localeTag)}
                </h1>
                <button
                  type="button"
                  className="min-h-11 px-1 text-lg text-[var(--ts-mute)]"
                  aria-label={t("nextMonth")}
                  onClick={() => {
                    const next = addUtcMonth(year, month, 1);
                    setYearMonth(next.year, next.month);
                  }}
                >
                  ›
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3.5 md:hidden">
              <button
                type="button"
                className="min-h-11 px-1 text-[17px] text-[var(--ts-mute)]"
                aria-label={t("previousMonth")}
                onClick={() => {
                  const next = addUtcMonth(year, month, -1);
                  setYearMonth(next.year, next.month);
                }}
              >
                ‹
              </button>
              <span className="whitespace-nowrap text-[13.5px] font-semibold">
                {formatMonthShort(year, month, localeTag)}
              </span>
              <button
                type="button"
                className="min-h-11 px-1 text-[17px] text-[var(--ts-mute)]"
                aria-label={t("nextMonth")}
                onClick={() => {
                  const next = addUtcMonth(year, month, 1);
                  setYearMonth(next.year, next.month);
                }}
              >
                ›
              </button>
            </div>
            <MonthSummary
              compact={false}
              worked={sheet.worked}
              norm={sheet.norm}
              pct={sheet.pct}
              stats={sheet.stats}
            />
          </header>

          <MonthSummary
            compact
            worked={sheet.worked}
            norm={sheet.norm}
            pct={sheet.pct}
            stats={sheet.stats}
          />

          {sheet.error ? (
            <p className="mb-3 text-sm text-[var(--ts-under)]" role="alert">
              {sheet.error}
            </p>
          ) : null}
          {sheet.loading ? (
            <p className="mb-3 text-sm text-[var(--ts-mute)]">{t("loading")}</p>
          ) : null}

          <TimesheetCalendar
            year={year}
            month={month}
            today={sheet.today}
            selectedYmd={sheet.selectedYmd}
            byDate={sheet.byDate}
            compact
            onSelect={sheet.openDay}
          />
          <TimesheetCalendar
            year={year}
            month={month}
            today={sheet.today}
            selectedYmd={sheet.selectedYmd}
            byDate={sheet.byDate}
            compact={false}
            onSelect={(dateYmd) => {
              sheet.setSelectedYmd(dateYmd);
              sheet.onCancelEdit();
            }}
          />

          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[var(--ts-mute)] md:mt-5 md:text-[11.5px]">
            <LegendDot color="var(--ts-shift)" label={t("shift")} />
            <LegendDot color="var(--ts-sick)" label={t("sick")} />
            <LegendDot color="var(--ts-vac)" label={t("vacation")} />
            <LegendDot color="var(--ts-off)" label={t("timeOff")} />
          </div>
        </section>

        <aside className="hidden w-[360px] shrink-0 border-l border-[var(--ts-line)] px-6 py-7 xl:flex xl:flex-col">
          {dayForm(false)}
        </aside>
      </div>

      {sheet.mobileDayOpen ? (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label={t("timesheet")}
          className="fixed inset-0 z-30 flex flex-col bg-[var(--ts-bg)] xl:hidden"
        >
          <div className="min-h-0 flex-1 overflow-auto px-6 pb-8 pt-5">{dayForm(true)}</div>
        </div>
      ) : null}
    </AppShell>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <i className="block size-[7px] rounded-full md:size-2" style={{ background: color }} />
      {label}
    </span>
  );
}
