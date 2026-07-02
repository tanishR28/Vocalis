'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCondition, getConditionList, ENABLED_CONDITION_IDS } from '@/lib/conditions';
import { getProfile, updateProfile, PROFILE_CHANGED } from '@/lib/profile';
import { useAuth } from '@/lib/auth/AuthProvider';
import { syncProfileToSupabase } from '@/lib/supabase/profileSync';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const conditions = getConditionList();
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [conditionId, setConditionId] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    function hydrateFromProfile() {
      const profile = getProfile();
      if (!profile) return;
      setPatientName(profile.patientName || '');
      setConditionId(profile.conditionId === 'depression' ? '' : (profile.conditionId || ''));
      if (profile.age) setAge(String(profile.age));
      else setAge('');
      if (profile.sex === 0 || profile.sex === 1) setSex(String(profile.sex));
      else setSex('');
    }

    hydrateFromProfile();
    window.addEventListener(PROFILE_CHANGED, hydrateFromProfile);
    return () => window.removeEventListener(PROFILE_CHANGED, hydrateFromProfile);
  }, []);

  const selected = getCondition(conditionId);

  async function handleSave() {
    if (!ENABLED_CONDITION_IDS.includes(conditionId)) {
      setError('Please select Parkinson\'s or Asthma. Depression monitoring is not available yet.');
      return;
    }
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 100) {
      setError('Valid age (18–100) is required.');
      return;
    }
    if (sex !== '0' && sex !== '1') {
      setError('Sex is required.');
      return;
    }
    setError('');
    const profile = updateProfile({
      conditionId,
      patientName,
      age: age ? Number(age) : undefined,
      sex: sex !== '' ? Number(sex) : undefined,
    });
    if (user?.id && profile) {
      await syncProfileToSupabase(profile, user.id, user.email);
    }
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="settings-age" className="block text-sm font-bold text-slate-700 mb-2">
              Age <span className="text-red-500">*</span>
            </label>
            <input
              id="settings-age"
              type="number"
              min={18}
              max={100}
              value={age}
              onChange={(e) => { setAge(e.target.value); setSaved(false); }}
              placeholder="e.g. 72"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label htmlFor="settings-sex" className="block text-sm font-bold text-slate-700 mb-2">
              Sex <span className="text-red-500">*</span>
            </label>
            <select
              id="settings-sex"
              value={sex}
              onChange={(e) => { setSex(e.target.value); setSaved(false); }}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select…</option>
              <option value="0">Female</option>
              <option value="1">Male</option>
            </select>
          </div>
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
