import { calendarYmdFromIso, isoToBerlinDateTimeParts } from "../lib/datetime";
import type { Shift } from "../types/api";
import { btnSecondary } from "../ui";

export function ShiftList({
  shifts,
  loading,
  onEdit,
  onDelete,
}: {
  shifts: Shift[];
  loading: boolean;
  onEdit?: (shift: Shift) => void;
  onDelete: (id: string) => void;
}) {
  const empty = shifts.length === 0 && !loading;

  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {shifts.map((s) => {
          const d = calendarYmdFromIso(s.date);
          const a = isoToBerlinDateTimeParts(s.startTime).time;
          const b = isoToBerlinDateTimeParts(s.endTime).time;
          return (
            <li
              key={s.id}
              className="flex items-start justify-between gap-2 rounded border border-neutral-200 bg-white p-3 text-sm"
            >
              <div>
                <div>
                  {d} {a}–{b}
                </div>
                <div className="text-neutral-600">{(s.workedMinutes / 60).toFixed(1)} h</div>
                {s.note ? <div className="text-neutral-600">{s.note}</div> : null}
              </div>
              <div className="flex shrink-0 gap-2">
                {onEdit ? (
                  <button
                    type="button"
                    className={btnSecondary}
                    onClick={() => onEdit(s)}
                  >
                    Edit
                  </button>
                ) : null}
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => void onDelete(s.id)}
                >
                  Del
                </button>
              </div>
            </li>
          );
        })}
        {empty ? <li className="text-sm text-neutral-500">No shifts</li> : null}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Start</th>
              <th className="px-3 py-3 font-medium">End</th>
              <th className="px-3 py-3 font-medium">Hours</th>
              <th className="px-3 py-3 font-medium">Note</th>
              <th className="px-3 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id} className="border-b border-neutral-100">
                <td className="px-3 py-3">{calendarYmdFromIso(s.date)}</td>
                <td className="px-3 py-3">{isoToBerlinDateTimeParts(s.startTime).time}</td>
                <td className="px-3 py-3">{isoToBerlinDateTimeParts(s.endTime).time}</td>
                <td className="px-3 py-3">{(s.workedMinutes / 60).toFixed(1)}</td>
                <td className="px-3 py-3">{s.note ?? ""}</td>
                <td className="px-3 py-3">
                  <div className="flex gap-2">
                    {onEdit ? (
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() => onEdit(s)}
                      >
                        Edit
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={btnSecondary}
                      onClick={() => void onDelete(s.id)}
                    >
                      Del
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {empty ? (
              <tr>
                <td className="px-3 py-3 text-neutral-500" colSpan={6}>
                  No shifts
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
