'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/AuthProvider';
import { isOnboardingComplete, linkUserToProfile } from '../../lib/profile';
import { hydrateProfileFromSupabase } from '../../lib/supabase/profileSync';
import { isSupabaseConfigured } from '../../lib/supabase/client';

const PUBLIC_PATHS = new Set(['/login', '/onboarding']);

export default function OnboardingGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, requireAuth } = useAuth();
  const [profileReady, setProfileReady] = useState(false);
  const [allowed, setAllowed] = useState(PUBLIC_PATHS.has(pathname));

  useEffect(() => {
    if (loading) return;

    if (!user) {
      setProfileReady(true);
      return;
    }

    linkUserToProfile(user.id);

    if (!isSupabaseConfigured()) {
      setProfileReady(true);
      return;
    }

    let cancelled = false;
    setProfileReady(false);
    hydrateProfileFromSupabase(user.id).finally(() => {
      if (!cancelled) setProfileReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  useEffect(() => {
    if (loading || !profileReady) return;

    if (pathname === '/login') {
      router.replace('/onboarding');
      setAllowed(false);
      return;
    }

    if (requireAuth && !user && pathname !== '/onboarding') {
      router.replace('/onboarding');
      setAllowed(false);
      return;
    }

    if (pathname === '/onboarding') {
      if (user && isOnboardingComplete()) {
        router.replace('/');
        setAllowed(false);
        return;
      }
      setAllowed(true);
      return;
    }

    if (!isOnboardingComplete()) {
      router.replace('/onboarding');
      setAllowed(false);
      return;
    }

    setAllowed(true);
  }, [pathname, router, user, loading, requireAuth, profileReady]);

  if (loading || !profileReady || !allowed) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen text-slate-500">
        Loading…
      </div>
    );
  }

  return children;
}
