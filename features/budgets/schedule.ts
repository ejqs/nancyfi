/**
 * Payday / Plan schedule engine.
 *
 * Weekend → previous weekday. Policy also requires Philippine holidays
 * ([NAN-19](https://linear.app/nancyfi/issue/NAN-19); implement in [NAN-24](https://linear.app/nancyfi/issue/NAN-24));
 * holidays are not applied in this module yet.
 *
 * @see docs/scenarios/payday-subscriptions-and-debt.md
 * @see features/budgets/docs/data-model.md
 */

import type { Schedule, ScheduleAnchor } from "./types"

/** YYYY-MM-DD civil date in the schedule's timezone calendar. */
export type CalendarDate = string

export type ScheduleOccurrence = {
  /** Anchor date before weekday adjustment (YYYY-MM-DD). */
  nominalDate: CalendarDate
  /** Date after weekend adjustment (YYYY-MM-DD). */
  date: CalendarDate
  anchor: ScheduleAnchor
  /**
   * Deterministic id for idempotent RuleRuns / Plan occurrences.
   * Stable even when the effective `date` moves for a weekend.
   * Format: `${nominalDate}:${anchor}` (e.g. `2026-09-15:dayOfMonth`).
   */
  occurrenceId: string
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

type Ymd = { year: number; month: number; day: number }

export function buildOccurrenceId(
  nominalDate: CalendarDate,
  anchor: ScheduleAnchor,
): string {
  return `${nominalDate}:${anchor}`
}

/** Semi-monthly payday: 15th + end of month, previous-weekday adjust. */
export function createPaydaySchedule(input: {
  timezone: string
  /** Default 15 */
  dayOfMonth?: number
  startAt?: string
  endAt?: string
  occurrenceCount?: number
}): Schedule {
  const schedule: Schedule = {
    timezone: input.timezone,
    dayOfMonth: input.dayOfMonth ?? 15,
    anchors: ["dayOfMonth", "endOfMonth"],
    adjustToPreviousWeekday: true,
  }
  if (input.startAt) schedule.startAt = input.startAt
  if (input.endAt) schedule.endAt = input.endAt
  if (input.occurrenceCount !== undefined) {
    schedule.occurrenceCount = input.occurrenceCount
  }
  return schedule
}

/**
 * Expand a Schedule into ordered occurrences.
 *
 * Bounds: schedule `startAt` / `endAt` (date or datetime → calendar date in
 * `timezone`) intersect optional `range`. Stops after `occurrenceCount` when set.
 *
 * If neither schedule nor range supplies an upper bound and there is no
 * `occurrenceCount`, throws — callers must bound infinite schedules.
 */
export function expandSchedule(
  schedule: Schedule,
  range?: { from?: CalendarDate; to?: CalendarDate },
): ScheduleOccurrence[] {
  assertValidSchedule(schedule)

  const start = maxDate(
    calendarDateInTimezone(schedule.startAt, schedule.timezone),
    range?.from,
  )
  const end = minDate(
    calendarDateInTimezone(schedule.endAt, schedule.timezone),
    range?.to,
  )

  if (!start && !end && schedule.occurrenceCount === undefined) {
    throw new Error(
      "expandSchedule requires start/end bounds or occurrenceCount",
    )
  }

  const from = start ?? end!
  const hardEnd = end

  const out: ScheduleOccurrence[] = []
  let cursor = startOfMonth(from)
  const monthLimit = 1200 // safety: 100 years of months

  for (let i = 0; i < monthLimit; i++) {
    if (hardEnd && compareYmd(startOfMonth(hardEnd), cursor) < 0) break
    if (
      schedule.occurrenceCount !== undefined &&
      out.length >= schedule.occurrenceCount
    ) {
      break
    }

    const monthOccs = occurrencesForMonth(schedule, cursor.year, cursor.month)
    for (const occ of monthOccs) {
      if (start && compareDate(occ.date, start) < 0) continue
      if (hardEnd && compareDate(occ.date, hardEnd) > 0) continue
      out.push(occ)
      if (
        schedule.occurrenceCount !== undefined &&
        out.length >= schedule.occurrenceCount
      ) {
        break
      }
    }

    cursor = addMonths(cursor, 1)
    if (hardEnd && !start && compareYmd(cursor, startOfMonth(hardEnd)) > 0) {
      break
    }
    // When only occurrenceCount bounds the run, stop once we have enough
    // and we've passed the start month window.
    if (
      schedule.occurrenceCount !== undefined &&
      out.length >= schedule.occurrenceCount
    ) {
      break
    }
    // Unbounded end with only start: still need occurrenceCount (checked above)
    if (!hardEnd && schedule.occurrenceCount === undefined) break
  }

  return out
}

/** Move Saturday → Friday, Sunday → Friday. Mon–Fri unchanged. */
export function adjustToPreviousWeekday(date: CalendarDate): CalendarDate {
  const ymd = parseDate(date)
  const dow = dayOfWeek(ymd) // 0=Sun … 6=Sat
  if (dow === 6) return formatDate(addDays(ymd, -1))
  if (dow === 0) return formatDate(addDays(ymd, -2))
  return date
}

/**
 * Interpret an ISO date or datetime as a calendar date in `timeZone`.
 * Plain YYYY-MM-DD is returned as-is (already a civil date).
 */
export function calendarDateInTimezone(
  value: string | undefined,
  timeZone: string,
): CalendarDate | undefined {
  if (!value) return undefined
  if (ISO_DATE.test(value)) return value

  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) {
    throw new Error(`Invalid date/time: ${value}`)
  }
  return formatInstantInTimezone(instant, timeZone)
}

function assertValidSchedule(schedule: Schedule): void {
  if (!schedule.timezone) {
    throw new Error("Schedule.timezone is required")
  }
  if (!schedule.anchors.length) {
    throw new Error("Schedule.anchors must be non-empty")
  }
  if (
    schedule.anchors.includes("dayOfMonth") &&
    (schedule.dayOfMonth === undefined ||
      schedule.dayOfMonth < 1 ||
      schedule.dayOfMonth > 31)
  ) {
    throw new Error("Schedule.dayOfMonth must be 1–31 when dayOfMonth anchor is used")
  }
  if (
    schedule.occurrenceCount !== undefined &&
    schedule.occurrenceCount < 0
  ) {
    throw new Error("Schedule.occurrenceCount must be >= 0")
  }
}

function occurrencesForMonth(
  schedule: Schedule,
  year: number,
  month: number,
): ScheduleOccurrence[] {
  const occs: ScheduleOccurrence[] = []
  const dim = daysInMonth(year, month)

  for (const anchor of schedule.anchors) {
    let nominal: Ymd | null = null
    if (anchor === "endOfMonth") {
      nominal = { year, month, day: dim }
    } else if (anchor === "dayOfMonth") {
      const day = schedule.dayOfMonth!
      // Day does not exist this month → skip (do not invent / collide with EOM).
      if (day > dim) continue
      nominal = { year, month, day }
    }
    if (!nominal) continue

    const nominalDate = formatDate(nominal)
    const date = schedule.adjustToPreviousWeekday
      ? adjustToPreviousWeekday(nominalDate)
      : nominalDate

    occs.push({
      nominalDate,
      date,
      anchor,
      occurrenceId: buildOccurrenceId(nominalDate, anchor),
    })
  }

  occs.sort((a, b) => {
    const byDate = compareDate(a.date, b.date)
    if (byDate !== 0) return byDate
    return a.occurrenceId.localeCompare(b.occurrenceId)
  })
  return occs
}

function parseDate(date: CalendarDate): Ymd {
  const m = ISO_DATE.exec(date)
  if (!m) throw new Error(`Expected YYYY-MM-DD, got ${date}`)
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
  }
}

function formatDate(ymd: Ymd): CalendarDate {
  return `${String(ymd.year).padStart(4, "0")}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Gregorian weekday: 0=Sunday … 6=Saturday (UTC noon avoids DST edges). */
function dayOfWeek(ymd: Ymd): number {
  return new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day, 12)).getUTCDay()
}

function addDays(ymd: Ymd, delta: number): Ymd {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + delta, 12))
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  }
}

function addMonths(ymd: Ymd, delta: number): Ymd {
  const d = new Date(Date.UTC(ymd.year, ymd.month - 1 + delta, 1, 12))
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: 1,
  }
}

function startOfMonth(date: CalendarDate | Ymd): Ymd {
  const ymd = typeof date === "string" ? parseDate(date) : date
  return { year: ymd.year, month: ymd.month, day: 1 }
}

function compareDate(a: CalendarDate, b: CalendarDate): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function compareYmd(a: Ymd, b: Ymd): number {
  return compareDate(formatDate(a), formatDate(b))
}

function maxDate(
  a: CalendarDate | undefined,
  b: CalendarDate | undefined,
): CalendarDate | undefined {
  if (!a) return b
  if (!b) return a
  return compareDate(a, b) >= 0 ? a : b
}

function minDate(
  a: CalendarDate | undefined,
  b: CalendarDate | undefined,
): CalendarDate | undefined {
  if (!a) return b
  if (!b) return a
  return compareDate(a, b) <= 0 ? a : b
}

function formatInstantInTimezone(instant: Date, timeZone: string): CalendarDate {
  // en-CA yields YYYY-MM-DD
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant)
  if (!ISO_DATE.test(formatted)) {
    throw new Error(`Unexpected timezone format for ${timeZone}: ${formatted}`)
  }
  return formatted
}
