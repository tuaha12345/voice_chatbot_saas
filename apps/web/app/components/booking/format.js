export function parseBookingDate(value) {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  const raw = String(value).trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const [datePart, timePart] = raw.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [hh, mm, ss] = timePart.split(":").map((p) => Number(p.slice(0, 2)) || 0);
    return new Date(y, m - 1, d, hh, mm, ss || 0);
  }
  return new Date(raw);
}

export function toSlotString(date) {
  const d = date instanceof Date ? date : parseBookingDate(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toDateParam(date) {
  const d = date instanceof Date ? date : parseBookingDate(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatInZone(value, timezone, options = {}) {
  const d = parseBookingDate(value);
  const hasStyleKeys = "dateStyle" in options || "timeStyle" in options;
  const opts = hasStyleKeys
    ? { ...options }
    : { dateStyle: "medium", timeStyle: "short", ...options };
  try {
    return new Intl.DateTimeFormat(undefined, { ...opts, timeZone: timezone || undefined }).format(d);
  } catch {
    return new Intl.DateTimeFormat(undefined, opts).format(d);
  }
}

export function hourToTime(hour) {
  const h = Math.max(0, Math.min(23, Number(hour) || 0));
  return `${String(h).padStart(2, "0")}:00`;
}

export function timeToHour(value, fallback = 9) {
  if (!value || typeof value !== "string") return fallback;
  const [h] = value.split(":");
  const n = Number(h);
  if (Number.isNaN(n)) return fallback;
  return Math.max(0, Math.min(23, n));
}

export function closeHourToTime(hour) {
  const h = Number(hour);
  if (h >= 24) return "23:59";
  return hourToTime(Math.max(1, h || 17));
}

export function timeToCloseHour(value, fallback = 17) {
  if (!value || typeof value !== "string") return fallback;
  const [h, m] = value.split(":").map(Number);
  if (Number.isNaN(h)) return fallback;
  if (h === 23 && m === 59) return 24;
  return Math.max(1, Math.min(24, h));
}
