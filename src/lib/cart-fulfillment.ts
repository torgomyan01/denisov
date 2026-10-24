export type FulfillmentMode = "pickup" | "delivery";
export type PickupTimeMode = "asap" | "scheduled";

export type TimeSlot = {
  /** ISO datetime string */
  id: string;
  label: string;
  dayLabel: string;
  timeLabel: string;
};

const DEFAULT_OPEN = 8;
const DEFAULT_CLOSE = 22;
const ASAP_MINUTES = 30;
const SLOT_STEP_MIN = 15;

/** Shorten cafe address for the logistics row. */
export const shortPickupLabel = (address: string, brand = "Денисов"): string => {
  const cleaned = String(address || "")
    .replace(/^Санкт-Петербург,?\s*/i, "")
    .trim();
  if (!cleaned) return brand;
  return `${brand} · ${cleaned}`;
};

export const formatScheduledLabel = (iso: string | null): string => {
  if (!iso) return "Выберите время";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Выберите время";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    date.getFullYear() === tomorrow.getFullYear() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getDate() === tomorrow.getDate();
  const time = date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  if (sameDay) return `Сегодня, ${time}`;
  if (isTomorrow) return `Завтра, ${time}`;
  const day = date.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
  return `${day}, ${time}`;
};

const parseHourRange = (
  hours: string,
): { open: number; close: number } => {
  const match = String(hours || "").match(
    /(\d{1,2})\s*[:.]\s*\d{0,2}\s*[–\-—]\s*(\d{1,2})/,
  );
  if (!match) return { open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
  const open = Number(match[1]);
  const close = Number(match[2]);
  if (!Number.isFinite(open) || !Number.isFinite(close) || open >= close) {
    return { open: DEFAULT_OPEN, close: DEFAULT_CLOSE };
  }
  return { open, close };
};

const roundUpToStep = (date: Date, stepMin: number): Date => {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const mins = next.getMinutes();
  const rem = mins % stepMin;
  if (rem !== 0) next.setMinutes(mins + (stepMin - rem));
  return next;
};

const buildDaySlots = (
  day: Date,
  openHour: number,
  closeHour: number,
  earliest: Date,
): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  const cursor = new Date(day);
  cursor.setHours(openHour, 0, 0, 0);
  const end = new Date(day);
  end.setHours(closeHour, 0, 0, 0);

  const now = new Date();
  const sameDay =
    day.getFullYear() === now.getFullYear() &&
    day.getMonth() === now.getMonth() &&
    day.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    day.getFullYear() === tomorrow.getFullYear() &&
    day.getMonth() === tomorrow.getMonth() &&
    day.getDate() === tomorrow.getDate();
  const dayLabel = sameDay ? "Сегодня" : isTomorrow ? "Завтра" : day.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });

  while (cursor < end) {
    if (cursor >= earliest) {
      const timeLabel = cursor.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
      slots.push({
        id: cursor.toISOString(),
        label: `${dayLabel}, ${timeLabel}`,
        dayLabel,
        timeLabel,
      });
    }
    cursor.setMinutes(cursor.getMinutes() + SLOT_STEP_MIN);
  }
  return slots;
};

/** Generate pickup time slots for today + tomorrow within cafe hours. */
export const buildPickupTimeSlots = (hours: string): TimeSlot[] => {
  const { open, close } = parseHourRange(hours);
  const earliest = roundUpToStep(
    new Date(Date.now() + ASAP_MINUTES * 60_000),
    SLOT_STEP_MIN,
  );
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  return [
    ...buildDaySlots(today, open, close, earliest),
    ...buildDaySlots(tomorrow, open, close, earliest),
  ];
};

export const ASAP_LABEL = "В течение 20 – 30 мин";
export const CHANGE_TIME_LABEL = "Изменить время получения";
