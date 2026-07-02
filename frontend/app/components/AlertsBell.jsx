'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiFetch, withUserIdParams } from '../../lib/api';
import { Button } from '@/components/ui/button';

export default function AlertsBell() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef(null);

  async function loadAlerts() {
    try {
      const response = await apiFetch(`/api/alerts?${withUserIdParams({ limit: 10 }).toString()}`);
      if (!response.ok) return;
      const data = await response.json();
      setAlerts(Array.isArray(data.items) ? data.items : []);
      setUnreadCount(Number(data.unread_count) || 0);
    } catch {
      setAlerts([]);
      setUnreadCount(0);
    }
  }

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function markRead(alertId) {
    await apiFetch(`/api/alerts/${alertId}/read?${withUserIdParams().toString()}`, {
      method: 'PATCH',
    });
    await loadAlerts();
  }

  return (
    <div className="relative" ref={panelRef}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative text-slate-500"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) loadAlerts();
        }}
        aria-label="Alerts"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Alerts</p>
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">No unread alerts</p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {alerts.map((alert) => (
                <li key={alert.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{alert.message}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1">
                    {alert.severity} · {alert.alert_type}
                  </p>
                  {!alert.is_read ? (
                    <button
                      type="button"
                      onClick={() => markRead(alert.id)}
                      className="text-xs font-bold text-primary mt-2 hover:underline"
                    >
                      Mark read
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
