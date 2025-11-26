import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const dedupeRemindersById = (items = []) => {
  const map = new Map();
  for (const reminder of items || []) {
    if (!reminder || reminder.id === undefined || reminder.id === null) {
      continue;
    }
    const existing = map.get(reminder.id);
    if (!existing) {
      map.set(reminder.id, reminder);
      continue;
    }
    const currentDate = reminder.datum_podsjetnika
      ? new Date(reminder.datum_podsjetnika).getTime()
      : Number.POSITIVE_INFINITY;
    const existingDate = existing.datum_podsjetnika
      ? new Date(existing.datum_podsjetnika).getTime()
      : Number.POSITIVE_INFINITY;
    if (currentDate < existingDate) {
      map.set(reminder.id, reminder);
    }
  }
  return Array.from(map.values());
};
