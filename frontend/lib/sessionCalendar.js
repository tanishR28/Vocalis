export function toDayKey(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function sameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function buildCalendarCells(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, month, day));
  }
  return cells;
}

export function buildCalendarCounts(historyItems) {
  const counts = {};
  historyItems.forEach((item) => {
    const key = toDayKey(item.timestamp);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

export function monthSessionCount(calendarCounts, calendarMonth) {
  return Object.entries(calendarCounts)
    .filter(([key]) => {
      const date = new Date(`${key}T00:00:00`);
      return !Number.isNaN(date.getTime()) && sameMonth(date, calendarMonth);
    })
    .reduce((sum, [, value]) => sum + value, 0);
}
