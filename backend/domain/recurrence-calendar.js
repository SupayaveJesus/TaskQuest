const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const formatterCache = new Map();

const formatterFor = (timezone) => {
  if (!formatterCache.has(timezone)) {
    formatterCache.set(timezone, new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }));
  }
  return formatterCache.get(timezone);
};

const normalizeTimezone = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: value.trim() }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
};

const localDate = (instant, timezone) => {
  const parts = formatterFor(timezone).formatToParts(new Date(instant));
  const value = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: part }) => [type, part]));
  return `${value.year}-${value.month}-${value.day}`;
};

const addDays = (date, amount) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
};

const monday = (date) => {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7;
  return addDays(date, 1 - weekday);
};

const currentPeriodKey = (frequency, timezone, now = new Date()) => {
  const date = localDate(now, timezone);
  return frequency === "semanal" ? monday(date) : date;
};

const opportunitiesThrough = (activity, asOf = new Date()) => {
  if (!activity.recurrente) {
    return !activity.fecha || activity.fecha <= localDate(asOf, "UTC") ? [activity.fecha || localDate(asOf, "UTC")] : [];
  }
  const timezone = normalizeTimezone(activity.zona_horaria) || "UTC";
  const end = currentPeriodKey(activity.frecuencia, timezone, asOf);
  let date = activity.frecuencia === "semanal" ? monday(activity.fecha) : activity.fecha;
  const opportunities = [];
  while (date <= end) {
    opportunities.push(date);
    date = addDays(date, activity.frecuencia === "semanal" ? 7 : 1);
  }
  return opportunities;
};

module.exports = { normalizeTimezone, currentPeriodKey, opportunitiesThrough, localDate, addDays, monday, DATE_PATTERN };
