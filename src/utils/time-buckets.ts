export function dayBucket(date: string): string {
  const dateObj = new Date(date);
  return dateObj.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function weekBucket(date: string): string {
  const dateObj = new Date(date);
  const firstDay = new Date(Date.UTC(dateObj.getUTCFullYear(), 0, 1));
  const days = Math.floor((dateObj.getTime() - firstDay.getTime()) / 86400000);
  const week = Math.ceil((days + dateObj.getUTCDay() + 1) / 7);
  return `${dateObj.getUTCFullYear()}-W${String(week).padStart(2, "0")}`; // YYYY-Www
}
