'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get('error');
    const target = error
      ? `/onboarding?error=${encodeURIComponent(error)}`
      : '/onboarding';
    router.replace(target);
  }, [router, searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center text-slate-500 bg-gradient-to-br from-slate-50 via-white to-blue-50">
      Redirecting…
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center text-slate-500">
          Loading…
        </main>
      }
    >
      <LoginRedirectInner />
    </Suspense>
  );
}
