'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getConditionList } from '../../lib/conditions';
import { getProfile, isOnboardingComplete, linkUserToProfile, saveProfile } from '../../lib/profile';
import { useAuth } from '../../lib/auth/AuthProvider';
import { hydrateProfileFromSupabase, syncProfileToSupabase } from '../../lib/supabase/profileSync';
import { isSupabaseConfigured } from '../../lib/supabase/client';
import BrandLogo, { SidebarBrandLockup, BrandWordmarkText } from '../components/BrandLogo';
import GoogleSignInCard from '../components/GoogleSignInCard';

function OnboardingForm({
  selectedId,
  setSelectedId,
  patientName,
  setPatientName,
  age,
  setAge,
  sex,
  setSex,
  error,
  setError,
  onContinue,
}) {
  const conditions = getConditionList();

  return (
    <div className="w-full space-y-5 onboarding-panel-enter">
      <div>
        <label htmlFor="patient-name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
          Your name
        </label>
        <input
          id="patient-name"
          type="text"
          value={patientName}
          onChange={(e) => setPatientName(e.target.value)}
          placeholder="e.g. Harry"
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="patient-age" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
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
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
        <div>
          <label htmlFor="patient-sex" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Sex <span className="text-red-500">*</span>
          </label>
          <select
            id="patient-sex"
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">Select…</option>
            <option value="0">Female</option>
            <option value="1">Male</option>
          </select>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
          Select your condition <span className="text-red-500">*</span>
        </p>
        <p className="text-xs text-slate-500 mb-3">
          Recording prompts, biomarkers, and charts are tuned for this condition only.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                className={`flex h-full flex-col items-center text-center rounded-2xl border-2 p-3 transition-all ${
                  active
                    ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-slate-200 bg-white/80 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${condition.accent} flex items-center justify-center text-white mb-2`}
                >
                  <span className="material-symbols-outlined text-xl">{condition.icon}</span>
                </div>
                <h3 className="font-extrabold text-slate-900 text-sm">{condition.label}</h3>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug line-clamp-3">{condition.summary}</p>
                {active ? (
                  <p className="text-[10px] font-bold text-blue-700 mt-2 uppercase tracking-wider">Selected</p>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <button
        type="button"
        onClick={onContinue}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-white font-bold text-base shadow-lg hover:shadow-xl transition-all"
      >
        Start monitoring
      </button>

      <p className="text-center text-[11px] text-slate-400">
        You can change your condition later from Settings.
      </p>
    </div>
  );
}

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, signInWithGoogle, requireAuth, supabaseEnabled } = useAuth();

  const [selectedId, setSelectedId] = useState('');
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [error, setError] = useState('');
  const [authError, setAuthError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [hydratingProfile, setHydratingProfile] = useState(false);
  const [rhsView, setRhsView] = useState('loading');
  const [loginExiting, setLoginExiting] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  const showLoginFirst = supabaseEnabled && !guestMode;

  const hydrateLocalProfile = useCallback(() => {
    const existing = getProfile();
    if (!existing) return;
    setSelectedId(existing.conditionId === 'depression' ? '' : (existing.conditionId || ''));
    setPatientName(existing.patientName || '');
    if (existing.age) setAge(String(existing.age));
    if (existing.sex === 0 || existing.sex === 1) setSex(String(existing.sex));
  }, []);

  useEffect(() => {
    const callbackError = searchParams.get('error');
    if (callbackError) {
      setAuthError(decodeURIComponent(callbackError));
    }
  }, [searchParams]);

  useEffect(() => {
    hydrateLocalProfile();
  }, [hydrateLocalProfile]);

  useEffect(() => {
    if (authLoading) {
      setRhsView('loading');
      return;
    }

    if (!showLoginFirst) {
      setRhsView('form');
      setHydratingProfile(false);
      return;
    }

    if (!user) {
      setRhsView('login');
      setHydratingProfile(false);
      setLoginExiting(false);
      return;
    }

    linkUserToProfile(user.id);
    setRhsView('login');
    setHydratingProfile(true);

    let cancelled = false;

    (async () => {
      if (isSupabaseConfigured()) {
        await hydrateProfileFromSupabase(user.id);
      }
      if (cancelled) return;

      hydrateLocalProfile();

      if (isOnboardingComplete()) {
        router.replace('/');
        return;
      }

      setHydratingProfile(false);
      setLoginExiting(true);
      window.setTimeout(() => {
        if (!cancelled) {
          setRhsView('form');
          setLoginExiting(false);
        }
      }, 420);
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, showLoginFirst, router, hydrateLocalProfile]);

  async function handleGoogleSignIn() {
    setAuthError('');
    setGoogleLoading(true);
    try {
      const { error: signInError } = await signInWithGoogle();
      if (signInError) {
        setAuthError(signInError.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleSkipLogin() {
    setGuestMode(true);
    setAuthError('');
    setRhsView('form');
  }

  async function handleContinue() {
    if (!selectedId) {
      setError('Please select your monitoring condition.');
      return;
    }
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 18 || ageNum > 100) {
      setError('Please enter a valid age (18–100).');
      return;
    }
    if (sex !== '0' && sex !== '1') {
      setError('Please select sex.');
      return;
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

  const rhsBusy = authLoading || (rhsView === 'loading' && showLoginFirst);

  return (
    <main className="relative h-screen overflow-hidden w-full">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(/onBoarding_bg.png)' }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-white/55 backdrop-blur-[2px]" aria-hidden />

      <div className="relative z-10 h-full w-full max-w-5xl mx-auto px-6 sm:px-8 flex flex-col lg:flex-row lg:items-center lg:gap-10 xl:gap-14">
        <section className="flex shrink-0 flex-col justify-center py-8 lg:py-0 lg:flex-1 lg:min-w-0">
          <div>
            <div className="flex items-center gap-3 mb-5">
              <BrandLogo variant="iconBordered" priority imageClassName="h-12 w-12 lg:h-14 lg:w-14" />
              <div className="min-w-0">
                <BrandWordmarkText className="text-xl lg:text-2xl tracking-[0.08em]" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 mt-1.5 leading-snug">
                  Your voice. Your health. Your insights.
                </p>
              </div>
            </div>
            <h1 className="text-3xl lg:text-4xl xl:text-5xl font-extrabold text-slate-900 font-headline tracking-tight leading-tight">
              Welcome
            </h1>
            <p className="text-slate-600 mt-3 text-base lg:text-lg leading-relaxed">
              You are already diagnosed. We help track how your condition changes day to day using a
              15-second voice diary.
            </p>
            <ul className="mt-6 space-y-3 hidden lg:block">
              <li className="flex items-center gap-3 text-slate-600">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">mic</span>
                <span className="text-sm">Record a short daily voice sample from your phone or laptop.</span>
              </li>
              <li className="flex items-center gap-3 text-slate-600">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">monitoring</span>
                <span className="text-sm">See biomarker trends and alerts between clinical visits.</span>
              </li>
              <li className="flex items-center gap-3 text-slate-600">
                <span className="material-symbols-outlined text-primary text-lg shrink-0">shield</span>
                <span className="text-sm">Audio stays on your device — only scores are saved.</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 flex-col justify-center pb-8 lg:pb-0 lg:min-w-0">
          <div className="relative w-full min-h-[280px]">
            {rhsBusy ? (
              <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  {user ? 'Loading your profile…' : 'Loading…'}
                </span>
              </div>
            ) : null}

            {!rhsBusy && rhsView === 'login' ? (
              <div className={loginExiting ? 'onboarding-panel-exit' : 'onboarding-panel-enter'}>
                <GoogleSignInCard
                  error={authError}
                  loading={googleLoading || hydratingProfile}
                  onSignIn={handleGoogleSignIn}
                  onSkip={handleSkipLogin}
                  showSkip={!requireAuth}
                />
              </div>
            ) : null}

            {!rhsBusy && rhsView === 'form' ? (
              <OnboardingForm
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                patientName={patientName}
                setPatientName={setPatientName}
                age={age}
                setAge={setAge}
                sex={sex}
                setSex={setSex}
                error={error}
                setError={setError}
                onContinue={handleContinue}
              />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <main className="relative h-screen flex items-center justify-center text-slate-500">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: 'url(/onBoarding_bg.png)' }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-white/55" aria-hidden />
          <span className="relative z-10">Loading…</span>
        </main>
      }
    >
      <OnboardingPageContent />
    </Suspense>
  );
}
