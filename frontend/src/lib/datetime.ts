/** dateYmd: "2024-03-01", timeHm: "09:00" или "09:00:00" → ISO UTC с Z */
export function utcDateTimeToIso(dateYmd: string, timeHm: string): string {
    const t = timeHm.length === 5 ? `${timeHm}:00` : timeHm;
    return `${dateYmd}T${t}.000Z`;
  }
  
  /** Календарный день → полночь UTC (shift.date, sick day) */
  export function utcDateToIso(dateYmd: string): string {
    return `${dateYmd}T00:00:00.000Z`;
  }
  
  /** ISO → части для input type="date" / type="time" (как UTC, не локаль браузера) */
  export function isoToUtcDateTimeParts(iso: string): { date: string; time: string } {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      throw new Error("Invalid ISO");
    }
    const date = d.toISOString().slice(0, 10);
    const time = d.toISOString().slice(11, 16);
    return { date, time };
  }
  
  /**
   * Для overnight: если endTimeHm <= startTimeHm по часам,
   * конец на следующий UTC-день относительно dateYmd начала.
   */
  export function utcShiftEndIso(
    startDateYmd: string,
    startTimeHm: string,
    endTimeHm: string,
  ): string {
    const startIso = utcDateTimeToIso(startDateYmd, startTimeHm);
    let endIso = utcDateTimeToIso(startDateYmd, endTimeHm);
    if (new Date(endIso) <= new Date(startIso)) {
      const next = new Date(`${startDateYmd}T00:00:00.000Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      const nextYmd = next.toISOString().slice(0, 10);
      endIso = utcDateTimeToIso(nextYmd, endTimeHm);
    }
    return endIso;
  }