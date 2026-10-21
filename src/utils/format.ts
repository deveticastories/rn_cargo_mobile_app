/** Formatting helpers shared across screens (Indian number grouping, short dates, initials). */

export const money = (n: number | string | undefined): string =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function parseDate(value?: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "11 Oct" */
export const shortDate = (value?: string): string => {
  const d = parseDate(value);
  return d ? `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}` : "—";
};

/** "11 Oct 2026" */
export const fullDate = (value?: string): string => {
  const d = parseDate(value);
  return d ? `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "—";
};

/** "Saturday, 11 October" */
export const longToday = (d = new Date()): string => `${DAYS[d.getDay()]}, ${d.getDate()} ${LONG_MONTHS[d.getMonth()]}`;

/** "Oct 2026" */
export const monthLabel = (d = new Date()): string => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

export const greeting = (d = new Date()): string => {
  const h = d.getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

export function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/** "admin@cargo.app" → "Admin" */
export function nameFromEmail(email?: string): string {
  if (!email) return "";
  const local = email.split("@")[0].replace(/[._-]+/g, " ");
  return local.replace(/\b\w/g, (c) => c.toUpperCase());
}

export const DAY_MS = 86_400_000;

/** Whole days from today (local midnight) to the given date; negative when past. */
export function daysFromToday(value?: string): number | null {
  const d = parseDate(value);
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / DAY_MS);
}

export const isSameMonth = (value: string | undefined, ref = new Date()): boolean => {
  const d = parseDate(value);
  return !!d && d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
};

export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
