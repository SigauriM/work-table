# Known limitations (v1)

## Overnight shifts and month boundary

A shift may cross midnight `endTime` on the next calendar day).

`workedMinutes` are always attributed to the shift's `date` field

(the start calendar day), not the end day.

Consequence: a shift starting on the 31st and ending on the 1st

counts entirely toward the month of the 31st.

## Timezone: UTC vs Europe/Berlin (production blocker)

Month filters and the shift `date` field currently use UTC, not Europe/Berlin.

Example: a shift entered at 00:30 on 1 March in Berlin is 28 February 23:30 UTC
and can land in the previous month for payroll.

This is acceptable while shifts are entered during daytime in testing.
It must be fixed before production (frontend / phones will enter times around the clock).
Logical place: stage 8 or a small pre-deploy step.

Unlike overnight shifts (a functional limitation with a defined rule),
UTC vs Berlin is a **production blocker**, not just reduced feature scope.  
  
## hoursPerMonth changes rewrite history

Month balances in stats always use the employee's *current* `hoursPerMonth`.

There is no per-month norm history. If an admin changes `hoursPerMonth`,

past months' balances in `/stats` recalculate with the new norm.

## hiredAt month boundary uses UTC

The "month of hire" for stats 404 / overview inclusion is derived from `hiredAt` in UTC

(same class of issue as UTC vs Europe/Berlin). A Berlin local midnight hire date

stored with a non-Z offset can shift the hire month. Prefer storing hire dates as

UTC midnight calendar dates until timezone handling is fixed.