import type { Shift, SickDay } from "../../../types/api";

export type EntryKind = "shift" | "sick";
export type FormKind = EntryKind | "vacation" | "off";

export type DayEntry =
  | { kind: "shift"; shift: Shift; hours: number }
  | { kind: "sick"; sick: SickDay; hours: number };

export const emptyTimes = {
  startTime: "08:00",
  endTime: "17:00",
  breakStart: "",
  breakEnd: "",
  note: "",
};

export type DayTimes = typeof emptyTimes;
