export function dateKey(date: Date | string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(date));
  const part = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function monthDays(year: number, month: number) {
  const start = new Date(Date.UTC(year, month, 1));
  const count =
    Math.ceil(
      (start.getUTCDay() +
        new Date(Date.UTC(year, month + 1, 0)).getUTCDate()) /
        7,
    ) * 7;
  start.setUTCDate(1 - start.getUTCDay());
  return Array.from(
    { length: count },
    (_, index) => new Date(start.getTime() + index * 86400000),
  );
}
export const activeDelivery = (status: string) =>
  !["cancelled"].includes(status);
