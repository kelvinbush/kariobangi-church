export function formatIsoDate(iso: string): string {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso);
  if (!m) return iso;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const d = new Date(Date.UTC(year, month - 1, day));
  const monthStr = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d);

  return `${ordinal(day)} ${monthStr} ${year}`;
}

/** Format ISO date as "Feb 15th 2026" (month first, ordinal day, year). */
export function formatDateLong(iso: string): string {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso);
  if (!m) return iso;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const d = new Date(Date.UTC(year, month - 1, day));
  const monthStr = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d);

  return `${monthStr} ${ordinal(day)} ${year}`;
}

export function formatDate(d: Date): string {
  const day = d.getDate();
  const monthStr = new Intl.DateTimeFormat("en-GB", { month: "short" }).format(d);
  const year = d.getFullYear();
  return `${ordinal(day)} ${monthStr} ${year}`;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
