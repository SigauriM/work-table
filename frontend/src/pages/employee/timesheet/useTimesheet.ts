import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../api/client";
import { createShift, deleteShift, listShifts, updateShift } from "../../../api/shifts";
import { createSickDay, deleteSickDay, listSickDays } from "../../../api/sickDays";
import { meStats } from "../../../api/stats";
import { useToast } from "../../../components/useToast";
import { useI18n } from "../../../i18n/useI18n";
import {
  berlinDateTimeToIso,
  berlinShiftEndIso,
  calendarYmdFromIso,
  isoToBerlinDateTimeParts,
} from "../../../lib/datetime";
import {
  countedShiftHours,
  dayDelta,
  hoursPerDayForYmd,
  utcTodayYmd,
  weekdayNormHours,
  ymd,
} from "../../../lib/timesheet";
import type { EmployeeStats, Shift, SickDay } from "../../../types/api";
import { emptyTimes, type DayEntry, type DayTimes, type EntryKind, type FormKind } from "./types";

export function timesheetKey(employeeId: string, year: number, month: number) {
  return ["timesheet", employeeId, year, month] as const;
}

const EMPTY_SHIFTS: Shift[] = [];
const EMPTY_SICK: SickDay[] = [];

type TimesheetData = {
  shifts: Shift[];
  sickDays: SickDay[];
  stats: EmployeeStats;
};

export function useTimesheet(employeeId: string | null, year: number, month: number) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const today = utcTodayYmd();
  const firstYmd = ymd(year, month, 1);
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}`;

  const [selectedYmd, setSelectedYmd] = useState(
    today.startsWith(firstYmd.slice(0, 7)) ? today : firstYmd,
  );
  const [mobileDayOpen, setMobileDayOpen] = useState(false);
  const [formKind, setFormKind] = useState<FormKind>("shift");
  const [form, setForm] = useState<DayTimes>(emptyTimes);
  const [editing, setEditing] = useState<{ kind: EntryKind; id: string } | null>(null);

  if (!selectedYmd.startsWith(monthPrefix)) {
    setSelectedYmd(today.startsWith(monthPrefix) ? today : firstYmd);
    setMobileDayOpen(false);
    setEditing(null);
    setForm(emptyTimes);
    setFormKind("shift");
  }

  const query = useQuery({
    queryKey: employeeId ? timesheetKey(employeeId, year, month) : ["timesheet", "none"],
    enabled: Boolean(employeeId),
    retry: 1,
    queryFn: async (): Promise<TimesheetData> => {
      const [shifts, sickDays, stats] = await Promise.all([
        listShifts({ employeeId: employeeId!, year, month }),
        listSickDays({ employeeId: employeeId!, year, month }),
        meStats(year, month),
      ]);
      return { shifts, sickDays, stats };
    },
  });

  const shifts = query.data?.shifts ?? EMPTY_SHIFTS;
  const sickDays = query.data?.sickDays ?? EMPTY_SICK;
  const stats = query.data?.stats ?? null;
  const key = employeeId ? timesheetKey(employeeId, year, month) : null;

  const fail = useCallback(
    (err: unknown, fallback: string) => {
      const text = err instanceof ApiError ? err.message : fallback;
      toast.show(text);
      return text;
    },
    [toast],
  );

  const invalidate = useCallback(() => {
    if (key) return qc.invalidateQueries({ queryKey: key });
    return Promise.resolve();
  }, [qc, key]);

  const createShiftMut = useMutation({
    mutationFn: createShift,
    async onMutate(body) {
      if (!key) return;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TimesheetData>(key);
      const id = crypto.randomUUID();
      const hours = countedShiftHours(
        body.date,
        isoToBerlinDateTimeParts(body.startTime).time,
        isoToBerlinDateTimeParts(body.endTime).time,
        body.breakStart ? isoToBerlinDateTimeParts(body.breakStart).time : "",
        body.breakEnd ? isoToBerlinDateTimeParts(body.breakEnd).time : "",
      );
      const shift: Shift = {
        id,
        employeeId: body.employeeId,
        date: `${body.date}T00:00:00.000Z`,
        startTime: body.startTime,
        endTime: body.endTime,
        breakStart: body.breakStart ?? null,
        breakEnd: body.breakEnd ?? null,
        workedMinutes: Math.round(hours * 60),
        note: body.note ?? null,
      };
      qc.setQueryData<TimesheetData>(key, (old) =>
        old ? { ...old, shifts: [...old.shifts, shift] } : old,
      );
      return { prev };
    },
    onError(err, _body, ctx) {
      if (key && ctx?.prev) qc.setQueryData(key, ctx.prev);
      fail(err, t("saveFailed"));
    },
    onSettled: () => void invalidate(),
  });

  const updateShiftMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof updateShift>[1] }) =>
      updateShift(id, body),
    async onMutate({ id, body }) {
      if (!key) return;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TimesheetData>(key);
      qc.setQueryData<TimesheetData>(key, (old) => {
        if (!old) return old;
        return {
          ...old,
          shifts: old.shifts.map((s) =>
            s.id === id
              ? {
                  ...s,
                  startTime: body.startTime ?? s.startTime,
                  endTime: body.endTime ?? s.endTime,
                  breakStart: body.breakStart !== undefined ? body.breakStart : s.breakStart,
                  breakEnd: body.breakEnd !== undefined ? body.breakEnd : s.breakEnd,
                  note: body.note !== undefined ? body.note ?? null : s.note,
                }
              : s,
          ),
        };
      });
      return { prev };
    },
    onError(err, _vars, ctx) {
      if (key && ctx?.prev) qc.setQueryData(key, ctx.prev);
      fail(err, t("saveFailed"));
    },
    onSettled: () => void invalidate(),
  });

  const deleteShiftMut = useMutation({
    mutationFn: deleteShift,
    async onMutate(id) {
      if (!key) return;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<TimesheetData>(key);
      qc.setQueryData<TimesheetData>(key, (old) =>
        old ? { ...old, shifts: old.shifts.filter((s) => s.id !== id) } : old,
      );
      return { prev };
    },
    onError(err, _id, ctx) {
      if (key && ctx?.prev) qc.setQueryData(key, ctx.prev);
      fail(err, t("deleteFailed"));
    },
    onSettled: () => void invalidate(),
  });

  const createSickMut = useMutation({
    mutationFn: createSickDay,
    onError: (err) => fail(err, t("saveFailed")),
    onSettled: () => void invalidate(),
  });
  const deleteSickMut = useMutation({
    mutationFn: deleteSickDay,
    onError: (err) => fail(err, t("deleteFailed")),
    onSettled: () => void invalidate(),
  });

  const dayNormHours = hoursPerDayForYmd(selectedYmd, stats?.terms, stats?.hoursPerDay);

  const byDate = useMemo(() => {
    const map = new Map<string, DayEntry[]>();
    const add = (k: string, entry: DayEntry) => {
      const list = map.get(k) ?? [];
      list.push(entry);
      map.set(k, list);
    };
    for (const s of shifts) {
      add(calendarYmdFromIso(s.date), { kind: "shift", shift: s, hours: s.workedMinutes / 60 });
    }
    for (const d of sickDays) {
      const date = calendarYmdFromIso(d.date);
      const hours = weekdayNormHours(date, hoursPerDayForYmd(date, stats?.terms, stats?.hoursPerDay));
      add(date, { kind: "sick", sick: d, hours });
    }
    return map;
  }, [shifts, sickDays, stats?.terms, stats?.hoursPerDay]);

  const selectedEntries = byDate.get(selectedYmd) ?? [];
  const selectedHours = selectedEntries.reduce((sum, e) => sum + e.hours, 0);
  const selectedNorm = weekdayNormHours(selectedYmd, dayNormHours);
  const delta = dayDelta(selectedHours, selectedNorm);
  const previewHours = countedShiftHours(
    selectedYmd,
    form.startTime,
    form.endTime,
    form.breakStart,
    form.breakEnd,
  );

  const worked = Number(stats?.workedHours ?? 0);
  const norm = Number(stats?.normHours ?? 0);
  const pct = norm > 0 ? Math.min(100, Math.max(0, (worked / norm) * 100)) : 0;

  function chooseType(kind: FormKind) {
    setFormKind(kind);
    if (editing && kind !== editing.kind) {
      setEditing(null);
      setForm(emptyTimes);
    }
  }

  const closeMobileDay = useCallback(() => {
    setMobileDayOpen(false);
    setEditing(null);
    setForm(emptyTimes);
    setFormKind("shift");
  }, []);

  const openDay = useCallback((dateYmd: string) => {
    setSelectedYmd(dateYmd);
    setEditing(null);
    setForm(emptyTimes);
    setFormKind("shift");
    setMobileDayOpen(true);
  }, []);

  function startEdit(entry: DayEntry) {
    if (entry.kind === "shift") {
      const s = entry.shift;
      setFormKind("shift");
      setEditing({ kind: "shift", id: s.id });
      setForm({
        startTime: isoToBerlinDateTimeParts(s.startTime).time,
        endTime: isoToBerlinDateTimeParts(s.endTime).time,
        breakStart: s.breakStart ? isoToBerlinDateTimeParts(s.breakStart).time : "",
        breakEnd: s.breakEnd ? isoToBerlinDateTimeParts(s.breakEnd).time : "",
        note: s.note ?? "",
      });
      return;
    }
    setFormKind("sick");
    setEditing({ kind: "sick", id: entry.sick.id });
    setForm({ ...emptyTimes, note: entry.sick.note ?? "" });
  }

  async function onDelete(entry: DayEntry) {
    try {
      if (entry.kind === "shift") await deleteShiftMut.mutateAsync(entry.shift.id);
      else await deleteSickMut.mutateAsync(entry.sick.id);
      if (editing?.id === (entry.kind === "shift" ? entry.shift.id : entry.sick.id)) {
        setEditing(null);
        setForm(emptyTimes);
      }
    } catch {
      /* toast from mutation */
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employeeId || (formKind !== "shift" && formKind !== "sick")) return;
    try {
      if (formKind === "shift") {
        if (!form.startTime || !form.endTime) {
          throw new ApiError(400, t("startEndRequired"));
        }
        const hasB0 = form.breakStart.trim() !== "";
        const hasB1 = form.breakEnd.trim() !== "";
        if (hasB0 !== hasB1) {
          throw new ApiError(400, t("breakPair"));
        }
        const body = {
          employeeId,
          date: selectedYmd,
          startTime: berlinDateTimeToIso(selectedYmd, form.startTime),
          endTime: berlinShiftEndIso(selectedYmd, form.startTime, form.endTime),
          breakStart: hasB0 ? berlinDateTimeToIso(selectedYmd, form.breakStart) : null,
          breakEnd: hasB1 ? berlinDateTimeToIso(selectedYmd, form.breakEnd) : null,
          note: form.note.trim() || undefined,
        };
        if (editing?.kind === "shift") {
          const { employeeId: _omit, ...patch } = body;
          void _omit;
          await updateShiftMut.mutateAsync({ id: editing.id, body: patch });
        } else {
          await createShiftMut.mutateAsync(body);
        }
      } else if (editing?.kind === "sick") {
        await deleteSickMut.mutateAsync(editing.id);
        await createSickMut.mutateAsync({
          employeeId,
          date: selectedYmd,
          note: form.note.trim() || undefined,
        });
      } else {
        await createSickMut.mutateAsync({
          employeeId,
          date: selectedYmd,
          note: form.note.trim() || undefined,
        });
      }
      setEditing(null);
      setForm(emptyTimes);
      setFormKind("shift");
    } catch (err) {
      fail(err, t("saveFailed"));
    }
  }

  const pending =
    createShiftMut.isPending ||
    updateShiftMut.isPending ||
    deleteShiftMut.isPending ||
    createSickMut.isPending ||
    deleteSickMut.isPending;

  const error =
    query.error instanceof ApiError ? query.error.message : query.error ? t("failedLoad") : null;

  const onCancelEdit = useCallback(() => {
    setEditing(null);
    setForm(emptyTimes);
    setFormKind("shift");
  }, []);

  return {
    today,
    selectedYmd,
    setSelectedYmd,
    mobileDayOpen,
    formKind,
    form,
    setForm,
    editing,
    byDate,
    selectedEntries,
    selectedHours,
    selectedNorm,
    delta,
    previewHours,
    worked,
    norm,
    pct,
    stats,
    loading: query.isLoading,
    error,
    pending,
    chooseType,
    openDay,
    closeMobileDay,
    startEdit,
    onDelete,
    onSubmit,
    onCancelEdit,
  };
}
