'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCondition, getConditionList } from '@/lib/conditions';
import { getProfile, updateProfile } from '@/lib/profile';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const router = useRouter();
  const conditions = getConditionList();
  const [patientName, setPatientName] = useState('');
  const [conditionId, setConditionId] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const profile = getProfile();
    if (!profile) return;
    setPatientName(profile.patientName || '');
    setConditionId(profile.conditionId || '');
  }, []);

  const selected = getCondition(conditionId);

  function handleSave() {
    if (!conditionId) {
      setError('Please select a monitoring condition.');
      return;
    }
    setError('');
    updateProfile({ conditionId, patientName });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto w-full space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-on-surface font-headline tracking-tight">Profile & monitoring</h2>
        <p className="text-on-surface-variant mt-1 text-sm">
          Update your display name and which condition the app tracks. Your recording history is kept.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div>
          <label htmlFor="settings-name" className="block text-sm font-bold text-slate-700 mb-2">
            Display name
          </label>
          <input
            id="settings-name"
            type="text"
            value={patientName}
            onChange={(e) => {
              setPatientName(e.target.value);
              setSaved(false);
            }}
            placeholder="e.g. Tanish"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div>
          <label htmlFor="settings-condition" className="block text-sm font-bold text-slate-700 mb-2">
            Monitoring condition
          </label>
          <select
            id="settings-condition"
            value={conditionId}
            onChange={(e) => {
              setConditionId(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none cursor-pointer"
          >
            <option value="" disabled>
              Select condition…
            </option>
            {conditions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {selected && (
            <p className="mt-3 text-sm text-slate-600 leading-relaxed rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              {selected.summary}
            </p>
          )}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {saved ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 font-medium">
            Settings saved. Dashboard charts will reflect your selection.
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button type="button" onClick={handleSave} className="flex-1">
            Save changes
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push('/')}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
