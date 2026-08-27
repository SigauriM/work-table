-- Reinterpret Shift clock columns: stored UTC wall clock (typed 09:00 as 09:00Z)
-- is Europe/Berlin civil time. Prisma DateTime is TIMESTAMP WITHOUT TIME ZONE (UTC).
-- Do not re-run: Prisma applies this migration once.
-- Does not touch date / hiredAt / createdAt / updatedAt / refresh expiresAt.

CREATE FUNCTION worktable_utc_wall_to_berlin_utc(ts timestamp)
RETURNS timestamp
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  as_utc timestamptz;
  cand timestamptz;
  berlin timestamp;
  best timestamptz;
  offset_min int;
BEGIN
  IF ts IS NULL THEN
    RETURN NULL;
  END IF;

  as_utc := ts AT TIME ZONE 'UTC';
  best := NULL;

  FOREACH offset_min IN ARRAY ARRAY[60, 120]
  LOOP
    cand := as_utc - make_interval(mins => offset_min);
    berlin := cand AT TIME ZONE 'Europe/Berlin';
    IF date_trunc('second', berlin) = date_trunc('second', ts) THEN
      IF best IS NULL OR cand < best THEN
        best := cand;
      END IF;
    END IF;
  END LOOP;

  IF best IS NULL THEN
    RAISE EXCEPTION 'Invalid Berlin time for utc-wall %', ts;
  END IF;

  RETURN best AT TIME ZONE 'UTC';
END;
$$;

UPDATE "Shift"
SET
  "startTime" = worktable_utc_wall_to_berlin_utc("startTime"),
  "endTime" = worktable_utc_wall_to_berlin_utc("endTime"),
  "breakStart" = worktable_utc_wall_to_berlin_utc("breakStart"),
  "breakEnd" = worktable_utc_wall_to_berlin_utc("breakEnd");

UPDATE "Shift"
SET "workedMinutes" = GREATEST(
  0,
  FLOOR(EXTRACT(EPOCH FROM ("endTime" - "startTime")) / 60)::int
    - CASE
        WHEN "breakStart" IS NOT NULL AND "breakEnd" IS NOT NULL
        THEN FLOOR(EXTRACT(EPOCH FROM ("breakEnd" - "breakStart")) / 60)::int
        ELSE 0
      END
);

DROP FUNCTION worktable_utc_wall_to_berlin_utc(timestamp);
