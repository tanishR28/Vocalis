'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth/AuthProvider';
import { onAuthUserChanged } from './reportImport';

/** Stable id for API scoping: authenticated user id, or null for anonymous demo. */
export function useAuthScopeId() {
  const { user, loading, accessToken } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) {
      setReady(false);
      return;
    }
    onAuthUserChanged(user?.id ?? null);
    setReady(true);
  }, [user?.id, loading]);

  return {
    userId: user?.id ?? null,
    accessToken: accessToken ?? null,
    authLoading: loading,
    authReady: ready,
  };
}
