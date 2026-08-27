import { z } from "zod";
import { parseYmd } from "./berlin.js";

/** Calendar day on the wire: `"2026-03-01"`, not an instant. */
export const calendarYmdSchema = z.string().superRefine((val, ctx) => {
  try {
    parseYmd(val);
  } catch {
    ctx.addIssue({ code: "custom", message: "Expected YYYY-MM-DD" });
  }
});
