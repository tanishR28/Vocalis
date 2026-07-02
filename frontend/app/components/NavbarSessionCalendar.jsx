'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildCalendarCells,
  buildCalendarCounts,
  monthSessionCount,
  sameMonth,
  toDayKey,
} from '../../lib/sessionCalendar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function NavbarSessionCalendar() {
  const [open, setOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [historyItems, setHistoryItems] = useState([]);
  const panelRef = useRef(null);

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const response = await fetch(`${API_URL}/api/history?limit=60`);
        if (!response.ok) return;
        const data = await response.json();
        if (active) {
          setHistoryItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
        if (active) setHistoryItems([]);
      }
    }

    loadHistory();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const calendarCounts = useMemo(() => buildCalendarCounts(historyItems), [historyItems]);
  const calendarCells = useMemo(() => buildCalendarCells(calendarMonth), [calendarMonth]);
  const sessionsThisMonth = useMemo(
    () => monthSessionCount(calendarCounts, calendarMonth),
    [calendarCounts, calendarMonth],
  );
  const today = new Date();

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors ${
          open
            ? 'border-primary/30 bg-primary/5 text-primary'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-primary'
        }`}
        aria-label="Activity calendar"
        aria-expanded={open}
      >
        <span className="material-symbols-outlined text-[20px]">calendar_month</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
              className="p-1 rounded-lg hover:bg-slate-100"
              aria-label="Previous month"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <p className="text-sm font-bold text-slate-700">
              {new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(calendarMonth)}
            </p>
            <button
              type="button"
              onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
              className="p-1 rounded-lg hover:bg-slate-100"
              aria-label="Next month"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
          <div className="text-[11px] font-bold text-slate-400 mb-2 grid grid-cols-7">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center py-1">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((dateCell, index) => {
              if (!dateCell) {
                return <div key={`empty-${index}`} className="h-9" />;
              }
              const key = toDayKey(dateCell.toISOString());
              const count = key ? (calendarCounts[key] || 0) : 0;
              const isToday = dateCell.toDateString() === today.toDateString();
              return (
                <div
                  key={key || index}
                  className={`h-9 rounded-lg border flex flex-col items-center justify-center text-xs ${
                    isToday
                      ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                      : count > 0
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-slate-50 border-slate-100 text-slate-500'
                  }`}
                >
                  <span className="font-semibold leading-none">{dateCell.getDate()}</span>
                  {count > 0 ? <span className="text-[10px] font-extrabold text-emerald-700">{count}</span> : null}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-700 bg-emerald-50 rounded-lg px-3 py-2 border border-emerald-100">
            Sessions this month: <span className="font-bold text-emerald-700">{sessionsThisMonth}</span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
