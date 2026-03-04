/**
 * Date utilities with proper timezone handling
 * All dates are handled in local timezone to avoid UTC offset issues
 */

/**
 * Get today's date as YYYY-MM-DD in local timezone
 */
export function getTodayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get the most recent Sunday (including today if it's Sunday)
 * Returns YYYY-MM-DD in local timezone
 */
export function getLastSunday(): string {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysToSubtract = dayOfWeek; // If Sunday (0), subtract 0; else subtract day number
  
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - daysToSubtract);
  
  const year = sunday.getFullYear();
  const month = String(sunday.getMonth() + 1).padStart(2, "0");
  const day = String(sunday.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date string is a Sunday (local timezone)
 */
export function isSunday(isoDate: string): boolean {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDay() === 0;
}

/**
 * Get all Sundays within a date range
 */
export function getSundaysBetween(startDate: string, endDate: string): string[] {
  const sundays: string[] = [];
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  
  let current = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  
  // Find first Sunday
  while (current.getDay() !== 0 && current <= end) {
    current.setDate(current.getDate() + 1);
  }
  
  // Add all Sundays
  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    sundays.push(`${year}-${month}-${day}`);
    current.setDate(current.getDate() + 7);
  }
  
  return sundays;
}

/**
 * Get previous N Sundays (including today if it's Sunday)
 */
export function getPreviousSundays(count: number): string[] {
  const sundays: string[] = [];
  const lastSunday = getLastSunday();
  sundays.push(lastSunday);
  
  const [year, month, day] = lastSunday.split("-").map(Number);
  let current = new Date(year, month - 1, day);
  
  for (let i = 1; i < count; i++) {
    current.setDate(current.getDate() - 7);
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    sundays.push(`${y}-${m}-${d}`);
  }
  
  return sundays;
}

/**
 * Format ISO date for display
 * "2026-03-01" -> "Mar 1, 2026"
 */
export function formatIsoDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format ISO date with ordinal (1st, 2nd, etc.)
 * "2026-03-01" -> "1st Mar 2026"
 */
export function formatIsoDateWithOrdinal(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  
  const dayNum = date.getDate();
  const suffix = getOrdinalSuffix(dayNum);
  const monthName = date.toLocaleDateString("en-US", { month: "short" });
  
  return `${dayNum}${suffix} ${monthName} ${year}`;
}

/**
 * Convert Date to YYYY-MM-DD format (alias for consistency)
 */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a Date object for display
 * new Date() -> "Mar 1, 2026"
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format a Date object with full month name
 * new Date() -> "March 1, 2026"
 */
export function formatDateLong(date: Date | string | number): string {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Parse a date input value (YYYY-MM-DD) and validate it's a Sunday
 */
export function parseSundayInput(inputValue: string): string | null {
  if (!inputValue) return null;
  if (!isSunday(inputValue)) return null;
  return inputValue;
}

/**
 * Get date range for a week containing the given Sunday
 * Returns { start: Monday, end: Sunday }
 */
export function getWeekRange(sundayIso: string): { start: string; end: string } {
  const [year, month, day] = sundayIso.split("-").map(Number);
  const sunday = new Date(year, month - 1, day);
  
  // Monday is 6 days before Sunday
  const monday = new Date(sunday);
  monday.setDate(sunday.getDate() - 6);
  
  const format = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  };
  
  return {
    start: format(monday),
    end: sundayIso,
  };
}
