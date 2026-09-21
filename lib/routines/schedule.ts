import type { RoutineDraft } from "@/lib/openai/agent-response-schema";

type RoutineSchedule = RoutineDraft["schedule"];

const dayCodes = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"] as const;

export function normalizeRoutineSchedule(schedule: RoutineSchedule): RoutineSchedule {
  return {
    ...schedule,
    startDate: schedule.startDate.trim(),
    time: schedule.time.trim(),
    timezone: schedule.timezone.trim(),
    weekDays: Array.from(new Set(schedule.weekDays.map((day) => day.trim()))) as RoutineSchedule["weekDays"],
  };
}

function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid routine start date");

  const parsed = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day));
  if (
    date.getUTCFullYear() !== parsed.year ||
    date.getUTCMonth() + 1 !== parsed.month ||
    date.getUTCDate() !== parsed.day
  ) {
    throw new Error("Invalid routine start date");
  }

  return parsed;
}

function parseTime(value: string) {
  const trimmed = value.trim();

  const plainMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (plainMatch) {
    const hour = Number(plainMatch[1]);
    const minute = Number(plainMatch[2]);
    if (hour > 23 || minute > 59) throw new Error("Invalid routine time");
    return { hour, minute };
  }

  const meridianMatch = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*([AP]M)$/i.exec(trimmed);
  if (meridianMatch) {
    let hour = Number(meridianMatch[1]);
    const minute = Number(meridianMatch[2]);
    const meridian = meridianMatch[3].toUpperCase();

    if (meridian === "AM") hour = hour === 12 ? 0 : hour;
    if (meridian === "PM") hour = hour === 12 ? 12 : hour + 12;

    if (minute > 59) throw new Error("Invalid routine time");
    return { hour, minute };
  }

  throw new Error("Invalid routine time");
}

function zonedDateTimeToUtc(
  date: { year: number; month: number; day: number },
  time: { hour: number; minute: number },
  timeZone: string
) {
  const desiredUtc = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    time.hour,
    time.minute
  );
  let candidate = desiredUtc;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  // A second pass handles DST offsets around the requested date.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(candidate))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)])
    );
    const representedUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute
    );
    candidate -= representedUtc - desiredUtc;
  }

  const resolvedParts = Object.fromEntries(
    formatter
      .formatToParts(new Date(candidate))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)])
  );

  // A local time inside a daylight-saving gap does not exist. The offset
  // correction above otherwise oscillates around that gap and could schedule
  // the run an hour early or late, so skip that calendar occurrence.
  if (
    resolvedParts.year !== date.year ||
    resolvedParts.month !== date.month ||
    resolvedParts.day !== date.day ||
    resolvedParts.hour !== time.hour ||
    resolvedParts.minute !== time.minute
  ) {
    return null;
  }

  return new Date(candidate);
}

function addCalendarDays(
  date: { year: number; month: number; day: number },
  amount: number
) {
  const result = new Date(Date.UTC(date.year, date.month - 1, date.day + amount));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
}

function isEligibleDate(
  schedule: RoutineSchedule,
  candidate: { year: number; month: number; day: number },
  start: { year: number; month: number; day: number }
) {
  if (schedule.frequency === "once") return true;
  if (schedule.frequency === "daily") return true;
  if (schedule.frequency === "monthly") return candidate.day === start.day;

  const weekday = dayCodes[
    new Date(Date.UTC(candidate.year, candidate.month - 1, candidate.day)).getUTCDay()
  ];
  return schedule.weekDays.includes(weekday);
}

export function getNextRunAt(schedule: RoutineSchedule, after = new Date()) {
  const normalizedSchedule = normalizeRoutineSchedule(schedule);
  const start = parseDate(normalizedSchedule.startDate);
  const time = parseTime(normalizedSchedule.time);

  // Validate the IANA timezone before inserting or scheduling a routine.
  new Intl.DateTimeFormat("en-US", { timeZone: normalizedSchedule.timezone }).format(after);

  for (let offset = 0; offset <= 3660; offset += 1) {
    const candidateDate = addCalendarDays(start, offset);
    if (!isEligibleDate(normalizedSchedule, candidateDate, start)) continue;

    const candidate = zonedDateTimeToUtc(candidateDate, time, normalizedSchedule.timezone);
    if (!candidate) {
      if (normalizedSchedule.frequency === "once") return null;
      continue;
    }
    if (candidate.getTime() > after.getTime()) return candidate;
    if (normalizedSchedule.frequency === "once") return null;
  }

  return null;
}

/** Verify an event against schedule data instead of trusting stale DB state. */
export function isRoutineScheduledAt(
  schedule: RoutineSchedule,
  scheduledFor: Date
) {
  const occurrence = getNextRunAt(
    schedule,
    new Date(scheduledFor.getTime() - 1)
  );

  return occurrence?.getTime() === scheduledFor.getTime();
}
