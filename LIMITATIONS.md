# Known limitations (v1)

## Overnight shifts and month boundary

A shift may cross midnight `endTime` on the next calendar day).

`workedMinutes` are always attributed to the shift's `date` field

(the start calendar day), not the end day.

Consequence: a shift starting on the 31st and ending on the 1st

counts entirely toward the month of the 31st.