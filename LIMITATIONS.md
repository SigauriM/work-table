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
Stage 8 frontend treats form date/time as UTC (see below). Full Europe/Berlin on the backend remains a pre-deploy / production fix.

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
  

## Frontend stage 8: form times are UTC

Shift and sick-day date/time fields in the UI are interpreted as UTC and sent with a `Z` suffix

(via `frontend/src/lib/datetime.ts`).

Example: entering `22:00` means 22:00 UTC, not 22:00 Europe/Berlin

(about one hour earlier on the wall clock in Germany in winter).

This matches current backend month boundaries. Replacing UTC with Berlin timezone

is still required before production.  
  
## Refresh tokens are not rotated

`POST /auth/refresh` verifies the refresh token and issues a new access token.

It does not revoke the refresh token or replace it.

Revoke still happens on logout and on employee deactivation `DELETE` / `PATCH isActive: false`).

Reason: refresh rotation lost the new token if the tab reloaded before the response was stored (F5 spam). Reuse until expiry is the v1 tradeoff; stolen refresh remains valid until logout, deactivation, or expiry (7 days).