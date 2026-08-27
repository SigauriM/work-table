import { render } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";
import { LocaleProvider } from "../../../i18n/LocaleContext";
import { TimesheetCalendar } from "./TimesheetCalendar";

describe("TimesheetCalendar a11y", () => {
  it("has no serious or critical axe violations", async () => {
    const { container } = render(
      <LocaleProvider>
        <TimesheetCalendar
          year={2026}
          month={3}
          today="2026-03-15"
          selectedYmd="2026-03-15"
          byDate={new Map()}
          compact={false}
          onSelect={() => undefined}
        />
      </LocaleProvider>,
    );
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    const bad = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(bad).toEqual([]);
  });
});
