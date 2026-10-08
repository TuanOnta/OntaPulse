export function formatDate(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "—";
}

export function formatInterval(seconds: number) {
  return seconds % 3600 === 0
    ? `${seconds / 3600}h`
    : seconds % 60 === 0
      ? `${seconds / 60}m`
      : `${seconds}s`;
}

/** Calendar date in the user's locale and time zone, for example "Mar 4, 2026". */
export function formatDay(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value))
    : "—";
}

/** Time of day in the user's locale as a 24-hour clock, for example "14:05". */
export function formatClock(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "—";
}

/** Time of day with seconds as a 24-hour clock, for example "14:05:09". */
export function formatClockSeconds(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(new Date(value))
    : "—";
}

/** Date and time with seconds in the user's locale, for example "Oct 8, 2026, 21:07:09". */
export function formatFull(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "medium",
        hour12: false,
      }).format(new Date(value))
    : "—";
}
