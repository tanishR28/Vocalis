'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isOnboardingComplete } from '../../lib/profile';

export default function OnboardingGate({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(pathname === '/onboarding');

  useEffect(() => {
    if (pathname === '/onboarding') {
      setAllowed(true);
      return;
    }
    if (!isOnboardingComplete()) {
      router.replace('/onboarding');
      setAllowed(false);
      return;
    }
    setAllowed(true);
  }, [pathname, router]);

  if (!allowed) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen text-slate-500">
        Loading…
      </div>
    );
  }

  return children;
}
