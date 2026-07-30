export function todayLocalIso(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function currentLocalTime(date = new Date()) {
  return [String(date.getHours()).padStart(2, '0'), String(date.getMinutes()).padStart(2, '0')].join(':');
}

export function shiftIsoDate(dateIso: string, amount: number) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + amount);
  return todayLocalIso(date);
}

export function buildDateRange(endDateIso: string, days: number) {
  return Array.from({ length: days }, (_, index) => shiftIsoDate(endDateIso, index - days + 1));
}

export function normalizeSortableTime(value: string) {
  const hmMatch = value.match(/^(\d{2}):(\d{2})$/);
  if (hmMatch) return value;

  const match = value.match(/(\d+):(\d+)\s?(AM|PM)?/i);
  if (!match) return value;

  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = match[3]?.toUpperCase();

  if (suffix === 'PM' && hour !== 12) hour += 12;
  if (suffix === 'AM' && hour === 12) hour = 0;

  return `${String(hour).padStart(2, '0')}:${minute}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(dateIso: string) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);

  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}
