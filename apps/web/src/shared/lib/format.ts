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
