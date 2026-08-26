# Known limitations (v1)

## Overnight shifts and month boundary

A shift may cross midnight (`endTime` on the next calendar day).

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

## hoursPerDay changes rewrite history

Day and month balances in stats always use the employee's *current* `hoursPerDay`.

There is no per-day or per-month norm history. If an admin changes `hoursPerDay`,
past months' balances in `/stats` recalculate with the new daily norm.

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

Stage 3 issued a **new** refresh token and revoked the old one on every
`POST /auth/refresh`. That rotation is **not** what v1 does. Treat reuse of the
same refresh string as intentional, not as a bug or a missed Stage 3 leftover.

`POST /auth/refresh` verifies the existing refresh token and returns a new access
token plus **the same** refresh token. It does not revoke or replace the refresh
row.

Revoke still happens on logout and on employee deactivation
(`DELETE` / `PATCH isActive: false`).

Reason rotation was dropped: if the tab reloaded (F5) before the response was
stored, the new refresh was already consumed server-side and the browser still
held the old one — hard logout. Reuse until expiry is the v1 tradeoff; a stolen
refresh stays valid until logout, deactivation, or expiry (7 days).

The same race returns if rotation is restored later, and PWA `autoUpdate` makes
it worse (old cached shell and new shell can both call refresh). If rotation is
turned back on, re-test: install PWA → ship a new frontend build → the installed
app must pick up the new version **without** logout. See `frontend/src/pwa.ts`
and the comment on `refresh()` in `backend/src/modules/auth/auth.service.ts`.
