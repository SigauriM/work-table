# Known limitations (v1)

## API prefix (`/api/v1`)

Public JSON API is `/api/v1/...`. `/health` stays unversioned.

Vite proxies `/api` to the backend **without stripping** the prefix, so the
browser and Express both see `/api/v1/...`. Refresh cookie `Path=/api/v1/auth`
matches `POST /api/v1/auth/refresh`. CSRF cookie stays `Path=/`.

## Overview performance

`GET /api/v1/stats/overview` loads employees (with terms), shifts, sick days,
and overtime payouts in a fixed handful of queries, then computes in memory.
It does not call `getEmployeeStats` per employee. There is no `MonthlyStats`
table.

Unbounded `GET /api/v1/shifts` (no `year`/`month`) returns
`{ items, nextCursor }` with `take` default 50, max 100. With `year` and
`month` the body is still a JSON array.

Timed int test, 2026-08-27, Windows, Postgres 16 on localhost, 200 active
HOURLY employees hired 2026-01-15, one March 2026 shift each, 20 samples after
2 warmups: p95 ≈ 33 ms (min ≈ 29 ms, max ≈ 35 ms). Budget was p95 < 200 ms, so
no cache.

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

Refresh is an **httpOnly** cookie (`Path=/api/v1/auth`, `SameSite=Strict`). Login and
refresh JSON do **not** include `refreshToken`; the SPA keeps access in memory
only. CSRF double-submit (`csrf` cookie + `X-CSRF-Token`) applies only to
`POST /api/v1/auth/refresh` and `POST /api/v1/auth/logout`.

Stage 3 issued a **new** refresh token and revoked the old one on every
`POST /api/v1/auth/refresh`. That rotation is **not** what v1 does. The same refresh
row is reused until logout, deactivation, password change, or expiry (7 days).

Rotation stays off until F5, PWA autoUpdate, and LAN `http://192.168.x.x:5173`
(`COOKIE_SECURE=false`) are confirmed. If rotation is turned back on, re-test
those three. See `frontend/src/pwa.ts` and `refresh()` in
`backend/src/modules/auth/auth.service.ts`.

`Secure` is `COOKIE_SECURE` (default false). Dev and phone over HTTP need it
false or the browser will not store the cookie.

## Audit log (v1)

`AuditLog` is append-only. A `BEFORE UPDATE OR DELETE` trigger raises on any
change, including by the same database user the app uses (`DATABASE_URL` =
`POSTGRES_USER`). A separate application role is not in v1.
