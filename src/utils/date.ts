// utils/time-buckets.ts
export function dayBucket(date: Date): string {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function monthBucket(date: Date): string {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

export function weekBucket(date: Date): string {
  const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const days = Math.floor((date.getTime() - firstDay.getTime()) / 86400000);
  const week = Math.ceil((days + firstDay.getUTCDay() + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
