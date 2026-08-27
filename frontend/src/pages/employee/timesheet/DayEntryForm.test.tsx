import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "../../../i18n/LocaleContext";
import { DayEntryForm } from "./DayEntryForm";
import { emptyTimes, type DayTimes } from "./types";

function renderForm(over: Partial<Parameters<typeof DayEntryForm>[0]> = {}) {
  let form: DayTimes = { ...emptyTimes };
  const onForm = vi.fn((next: DayTimes) => {
    form = next;
  });
  const onSubmit = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
  const onType = vi.fn();
  render(
    <LocaleProvider>
      <DayEntryForm
        dateYmd="2026-03-02"
        today="2026-03-02"
        entries={[]}
        hours={0}
        norm={8}
        delta={{ text: "8.0 h under", color: "var(--ts-under)" }}
        formKind="shift"
        form={form}
        previewHours={9}
        editing={null}
        pending={false}
        showBack={false}
        onBack={() => undefined}
        onType={onType}
        onForm={onForm}
        onEdit={() => undefined}
        onDelete={() => undefined}
        onSubmit={onSubmit}
        onCancelEdit={() => undefined}
        {...over}
      />
    </LocaleProvider>,
  );
  return { onForm, onSubmit, onType };
}

describe("DayEntryForm", () => {
  beforeEach(() => {
    localStorage.removeItem("worktable-locale");
  });
  afterEach(() => {
    cleanup();
  });

  it("shows empty-day copy, counted hours, and shift time fields", () => {
    renderForm();
    expect(screen.getByText("Nothing logged yet")).toBeTruthy();
    expect(screen.getByText(/today/)).toBeTruthy();
    expect(screen.getByText("9 h")).toBeTruthy();
    expect(screen.getByText("Start")).toBeTruthy();
    expect(screen.getByText("End")).toBeTruthy();
  });

  it("submits the add form and can switch to sick (hides times)", () => {
    const { onSubmit, onType } = renderForm();
    fireEvent.submit(screen.getByRole("button", { name: /Add to/ }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Sick" }));
    expect(onType).toHaveBeenCalledWith("sick");
  });

  it("hides start/end when kind is sick", () => {
    renderForm({ formKind: "sick" });
    expect(screen.queryByText("Start")).toBeNull();
    expect(screen.getByRole("button", { name: /Add to/ })).toBeTruthy();
  });
});
