# Known limitations (v1)

## Overnight shifts and month boundary

A shift may cross midnight (`endTime` on the next calendar day).

`workedMinutes` are always attributed to the shift's `date` field
(the start calendar day), not the end day.

Consequence: a shift starting on the 31st and ending on the 1st
counts entirely toward the month of the 31st.

## Terms history

Pay type, rates, and `hoursPerDay` live in `EmployeeTerms` periods.

Closed periods (`validTo` set) are immutable. An admin can only split the open
tail (`validTo` null) with `effectiveFrom`. Past months keep the terms that
applied on each day.

`daysPerWeek` stays on `Employee` and is not used in calculations (daily norm
is Mon–Fri; weekends 0).

SALARY for a month is the full monthly salary from terms on the last day of
that count window — not prorated by hire day. `paidBase` sums each closed
month's own pay, not today's rate × all months.

Weekend sick days credit 0 hours (the day's norm).

## hiredAt is DateTime, not Date

Hire month for stats is the calendar YMD of `hiredAt` (UTC midnight of that day).
The API accepts `"YYYY-MM-DD"`. Do not send a Berlin-midnight instant.

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
