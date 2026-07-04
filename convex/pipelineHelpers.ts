const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoUtc(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function todayISO(): string {
  const now = new Date();
  const kenyaOffset = 3 * 60 * 60 * 1000;
  const kenyaDate = new Date(now.getTime() + kenyaOffset);
  return kenyaDate.toISOString().split("T")[0];
}

export function isSunday(isoDate: string): boolean {
  return parseIsoUtc(isoDate).getUTCDay() === 0;
}

export function daysSince(startDate: string, referenceDate = todayISO()): number {
  const start = parseIsoUtc(startDate);
  const end = parseIsoUtc(referenceDate);
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY));
}
