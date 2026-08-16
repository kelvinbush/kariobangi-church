// Residences are typed free-hand, so the same estate arrives as "Dandora Phase 1",
// "Dandora ph2", "Umoja 1", "Umoja II"… For reporting we fold those onto the estate
// name and keep the raw value on the row for detail.

// Only trailing phase/stage markers and bare numbers are stripped. Directional or
// descriptive suffixes ("Kariobangi North", "Umoja Innercore") are left alone — they
// name genuinely different places.
const TRAILING_QUALIFIER = /\s+(?:(?:phase|ph|stage)\s*(?:[0-9]+|i{1,3}|iv|v)?|[0-9]+|i{1,3}|iv|v)$/;

/** Lower-case key used to group residences that are really the same estate. */
export function residenceGroupKey(raw: string | null | undefined): string {
  const cleaned = (raw ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!cleaned) return "";

  let value = cleaned;
  let previous = "";
  while (value && value !== previous) {
    previous = value;
    value = value.replace(TRAILING_QUALIFIER, "").trim();
  }

  // A residence recorded as just "Phase 2" leaves nothing meaningful — keep it as typed.
  if (!value || ["phase", "ph", "stage"].includes(value)) return cleaned;
  return value;
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 };

/**
 * Phase number within a group, so "Dandora", "Dandora Phase 2" and "dandora ph 4"
 * list in that order rather than alphabetically ("ph 4" sorts before "phase 2").
 * Returns 0 when no phase was recorded.
 */
export function residencePhaseOrder(raw: string | null | undefined): number {
  const cleaned = (raw ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!cleaned) return 0;

  const digits = cleaned.match(/(\d+)\s*$/);
  if (digits) return Number(digits[1]);

  const roman = cleaned.match(/\s(i{1,3}|iv|v)$/);
  return roman ? ROMAN[roman[1]] ?? 0 : 0;
}

/** Display name for a group, e.g. "dandora phase 1" -> "Dandora". */
export function residenceGroupLabel(raw: string | null | undefined): string {
  const key = residenceGroupKey(raw);
  if (!key) return "Residence not recorded";
  return key
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
