// Shared by the browser review and the server. Keep this module credential-free.
export function validSchedule(date: string | Date, now = Date.now()) {
  const time = typeof date === "string" ? Date.parse(date) : date.getTime();
  return (
    Number.isFinite(time) &&
    time >= now + 5 * 60000 &&
    time <= now + 90 * 86400000
  );
}

export function validScheduleBatch(dates: Date[], now = Date.now()) {
  return dates.length > 0 && dates.every((date) => validSchedule(date, now));
}
