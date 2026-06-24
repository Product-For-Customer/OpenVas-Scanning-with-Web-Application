const STORAGE_KEY = "appTimezone";
const DEFAULT_TZ  = "Asia/Bangkok";

/** Returns the globally selected app timezone (reads localStorage, falls back to Asia/Bangkok) */
export function getAppTimezone(): string {
  return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TZ;
}

/**
 * Format a date value (ISO string, formatted string, or Unix number) using the global app timezone.
 * Replaces all the old `new Date(d.getTime() + 7 * 60 * 60 * 1000)` patterns.
 */
export function formatWithAppTimezone(
  value: string | number | null | undefined,
  opts: Intl.DateTimeFormatOptions = {},
  locale = "th-TH",
): string {
  if (value === null || value === undefined || value === "") return "-";
  const raw = String(value).trim();
  if (!raw) return "-";

  let d: Date | null = null;

  if (/^\d+$/.test(raw)) {
    const num = Number(raw);
    d = new Date(num < 1e12 ? num * 1000 : num);
  } else {
    d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      // "YYYY-MM-DD HH:MM:SS" → add "T" so it's parsed as local ISO
      d = new Date(raw.replace(" ", "T"));
    }
    if (Number.isNaN(d.getTime())) {
      return raw; // unparseable — return as-is
    }
  }

  if (!d || Number.isNaN(d.getTime())) return raw;

  const tz = getAppTimezone();
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz,
    ...opts,
  }).format(d);
}
