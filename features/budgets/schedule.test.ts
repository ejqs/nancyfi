import { describe, expect, test } from "bun:test"

import {
  adjustToPreviousWeekday,
  buildOccurrenceId,
  calendarDateInTimezone,
  createPaydaySchedule,
  expandSchedule,
} from "./schedule"
import type { Schedule } from "./types"

describe("adjustToPreviousWeekday", () => {
  test("leaves weekdays unchanged", () => {
    // 2026-09-15 is a Tuesday
    expect(adjustToPreviousWeekday("2026-09-15")).toBe("2026-09-15")
    // 2026-09-18 is a Friday
    expect(adjustToPreviousWeekday("2026-09-18")).toBe("2026-09-18")
  })

  test("moves Saturday to Friday", () => {
    // 2026-09-19 is a Saturday
    expect(adjustToPreviousWeekday("2026-09-19")).toBe("2026-09-18")
  })

  test("moves Sunday to Friday", () => {
    // 2026-09-20 is a Sunday
    expect(adjustToPreviousWeekday("2026-09-20")).toBe("2026-09-18")
  })

  test("moves end-of-month weekend back into the month", () => {
    // 2027-01-31 is a Sunday → Friday 29
    expect(adjustToPreviousWeekday("2027-01-31")).toBe("2027-01-29")
  })
})

describe("buildOccurrenceId", () => {
  test("is deterministic from nominal date + anchor", () => {
    expect(buildOccurrenceId("2026-09-15", "dayOfMonth")).toBe(
      "2026-09-15:dayOfMonth",
    )
    expect(buildOccurrenceId("2026-09-30", "endOfMonth")).toBe(
      "2026-09-30:endOfMonth",
    )
  })
})

describe("createPaydaySchedule + expandSchedule", () => {
  test("expands 15th and EOM with weekday adjust", () => {
    const schedule = createPaydaySchedule({
      timezone: "Asia/Manila",
      startAt: "2026-09-01",
      endAt: "2026-09-30",
    })

    const occs = expandSchedule(schedule)
    expect(occs).toHaveLength(2)
    expect(occs[0]).toEqual({
      nominalDate: "2026-09-15",
      date: "2026-09-15",
      anchor: "dayOfMonth",
      occurrenceId: "2026-09-15:dayOfMonth",
    })
    expect(occs[1]).toEqual({
      nominalDate: "2026-09-30",
      date: "2026-09-30",
      anchor: "endOfMonth",
      occurrenceId: "2026-09-30:endOfMonth",
    })
  })

  test("adjusts weekend 15th and weekend EOM", () => {
    // Sep 2028: 15th is Friday (ok); 30th is Saturday → 29
    // Use a known month: March 2026 — 15th is Sunday → Fri 13; 31st is Tuesday
    const schedule = createPaydaySchedule({
      timezone: "Asia/Manila",
      startAt: "2026-03-01",
      endAt: "2026-03-31",
    })
    const occs = expandSchedule(schedule)
    expect(occs[0].nominalDate).toBe("2026-03-15")
    expect(occs[0].date).toBe("2026-03-13")
    expect(occs[0].occurrenceId).toBe("2026-03-15:dayOfMonth")
    expect(occs[1].nominalDate).toBe("2026-03-31")
    expect(occs[1].date).toBe("2026-03-31")
  })

  test("occurrence IDs stay on nominal date when adjusted", () => {
    const schedule = createPaydaySchedule({
      timezone: "UTC",
      startAt: "2026-03-01",
      endAt: "2026-03-31",
    })
    const [mid] = expandSchedule(schedule)
    expect(mid.date).not.toBe(mid.nominalDate)
    expect(mid.occurrenceId).toBe(buildOccurrenceId(mid.nominalDate, mid.anchor))
  })

  test("respects occurrenceCount", () => {
    const schedule = createPaydaySchedule({
      timezone: "Asia/Manila",
      startAt: "2026-01-01",
      occurrenceCount: 3,
    })
    const occs = expandSchedule(schedule)
    expect(occs.map((o) => o.occurrenceId)).toEqual([
      "2026-01-15:dayOfMonth",
      "2026-01-31:endOfMonth",
      "2026-02-15:dayOfMonth",
    ])
  })

  test("intersects range with schedule bounds", () => {
    const schedule = createPaydaySchedule({
      timezone: "Asia/Manila",
      startAt: "2026-01-01",
      endAt: "2026-12-31",
    })
    const occs = expandSchedule(schedule, {
      from: "2026-09-01",
      to: "2026-09-30",
    })
    expect(occs).toHaveLength(2)
    expect(occs[0].occurrenceId).toBe("2026-09-15:dayOfMonth")
  })

  test("skips dayOfMonth when day does not exist", () => {
    const schedule: Schedule = {
      timezone: "UTC",
      dayOfMonth: 31,
      anchors: ["dayOfMonth", "endOfMonth"],
      adjustToPreviousWeekday: false,
      startAt: "2026-02-01",
      endAt: "2026-02-28",
    }
    const occs = expandSchedule(schedule)
    expect(occs).toHaveLength(1)
    expect(occs[0].occurrenceId).toBe("2026-02-28:endOfMonth")
  })

  test("can disable weekday adjustment", () => {
    const schedule: Schedule = {
      timezone: "UTC",
      dayOfMonth: 15,
      anchors: ["dayOfMonth"],
      adjustToPreviousWeekday: false,
      startAt: "2026-03-01",
      endAt: "2026-03-31",
    }
    const [occ] = expandSchedule(schedule)
    expect(occ.date).toBe("2026-03-15")
  })

  test("throws without bounds", () => {
    const schedule = createPaydaySchedule({ timezone: "UTC" })
    expect(() => expandSchedule(schedule)).toThrow(/bounds or occurrenceCount/)
  })

  test("idempotent expand yields identical ids", () => {
    const schedule = createPaydaySchedule({
      timezone: "Asia/Manila",
      startAt: "2026-01-01",
      endAt: "2026-06-30",
    })
    const a = expandSchedule(schedule).map((o) => o.occurrenceId)
    const b = expandSchedule(schedule).map((o) => o.occurrenceId)
    expect(a).toEqual(b)
  })
})

describe("calendarDateInTimezone", () => {
  test("passes through plain dates", () => {
    expect(calendarDateInTimezone("2026-09-15", "Asia/Manila")).toBe(
      "2026-09-15",
    )
  })

  test("maps instants into the schedule timezone", () => {
    // 2026-09-15 16:00 UTC → already 2026-09-16 in Manila (UTC+8)
    expect(
      calendarDateInTimezone("2026-09-15T16:00:00.000Z", "Asia/Manila"),
    ).toBe("2026-09-16")
    expect(calendarDateInTimezone("2026-09-15T16:00:00.000Z", "UTC")).toBe(
      "2026-09-15",
    )
  })
})
