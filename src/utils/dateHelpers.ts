export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function parseDueDate(dueDate: string): Date | null {
  const t = Date.parse(dueDate);
  if (Number.isNaN(t)) return null;
  return new Date(t);
}
