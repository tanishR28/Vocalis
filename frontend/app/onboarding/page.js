'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getConditionList } from '../../lib/conditions';
import { getProfile, saveProfile } from '../../lib/profile';
import { useAuth } from '../../lib/auth/AuthProvider';
import { syncProfileToSupabase } from '../../lib/supabase/profileSync';

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [selectedId, setSelectedId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [error, setError] = useState('');

  const conditions = getConditionList();

  useEffect(() => {
    const existing = getProfile();
    if (existing) {
      setSelectedId(existing.conditionId || '');
      setPatientName(existing.patientName || '');
      if (existing.age) setAge(String(existing.age));
      if (existing.sex === 0 || existing.sex === 1) setSex(String(existing.sex));
    }
  }, []);

  async function handleContinue() {
    if (!selectedId) {
      setError('Please select your monitoring condition.');
      return;
    }
    if (selectedId === 'parkinsons') {
      const ageNum = Number(age);
      if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 100) {
        setError('Please enter a valid age (18–100) for Parkinson\'s UPDRS analysis.');
        return;
      }
      if (sex !== '0' && sex !== '1') {
        setError('Please select sex (required for Parkinson\'s UPDRS model).');
        return;
      }
    }
    setError('');
    const profile = saveProfile({
      conditionId: selectedId,
      patientName,
      age: age ? Number(age) : undefined,
      sex: sex !== '' ? Number(sex) : undefined,
      userId: user?.id,
    });
    if (user?.id) {
      await syncProfileToSupabase(profile, user.id, user.email);
    }
    router.replace('/');
  }

  return (
    <main className="min-h-screen w-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-white shadow-lg mb-4">
            <span className="material-symbols-outlined text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              voice_selection
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 font-headline tracking-tight">
            Welcome to Vocalis
          </h1>
          <p className="text-slate-600 mt-3 text-lg max-w-xl mx-auto">
            You are already diagnosed. We help track how your condition changes day to day using a
            15-second voice diary.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-6 md:p-8 space-y-8">
          <div>
            <label htmlFor="patient-name" className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
              Your name
            </label>
            <input
              id="patient-name"
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="e.g. Tanish"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {selectedId === 'parkinsons' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="patient-age" className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Age <span className="text-red-500">*</span>
                </label>
                <input
                  id="patient-age"
                  type="number"
                  min={18}
                  max={100}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 72"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label htmlFor="patient-sex" className="block text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Sex <span className="text-red-500">*</span>
                </label>
                <select
                  id="patient-sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">Select…</option>
                  <option value="0">Female</option>
                  <option value="1">Male</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Matches Oxford dataset encoding (0=female, 1=male).</p>
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">
              Select your condition <span className="text-red-500">*</span>
            </p>
            <p className="text-sm text-slate-500 mb-4">
              The app will tune recording prompts, biomarkers, and dashboard charts for this condition only.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {conditions.map((condition) => {
                const active = selectedId === condition.id;
                return (
                  <button
                    key={condition.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(condition.id);
                      if (error) setError('');
                    }}
                    className={`text-left rounded-2xl border-2 p-5 transition-all hover:shadow-md ${
                      active
                        ? 'border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-200'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl bg-gradient-to-br ${condition.accent} flex items-center justify-center text-white mb-3`}
                    >
                      <span className="material-symbols-outlined">{condition.icon}</span>
                    </div>
                    <h3 className="font-extrabold text-slate-900 text-lg">{condition.label}</h3>
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed">{condition.summary}</p>
                    {active && (
                      <p className="text-xs font-bold text-blue-700 mt-3 uppercase tracking-wider">Selected</p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : null}

          <button
            type="button"
            onClick={handleContinue}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
          >
            Start monitoring
          </button>

          <p className="text-center text-xs text-slate-400">
            You can change your condition later from Settings.
          </p>
        </div>
      </div>
    </main>
  );
}
