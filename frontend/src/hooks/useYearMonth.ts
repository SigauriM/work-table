import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { berlinYearMonth } from "../lib/berlin";

export function defaultYearMonth() {
  return berlinYearMonth();
}

export function useYearMonth() {
  const [params, setParams] = useSearchParams();
  const fallback = defaultYearMonth();
  const yearRaw = Number(params.get("year"));
  const monthRaw = Number(params.get("month"));
  const year =
    Number.isInteger(yearRaw) && yearRaw >= 2000 && yearRaw <= 2100
      ? yearRaw
      : fallback.year;
  const month =
    Number.isInteger(monthRaw) && monthRaw >= 1 && monthRaw <= 12
      ? monthRaw
      : fallback.month;

  const setYearMonth = useCallback(
    (nextYear: number, nextMonth: number) => {
      setParams(
        { year: String(nextYear), month: String(nextMonth) },
        { replace: true },
      );
    },
    [setParams],
  );

  return { year, month, setYearMonth };
}
