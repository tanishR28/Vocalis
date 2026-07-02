'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient, isSupabaseConfigured } from '../supabase/client';

const REQUIRE_AUTH = process.env.NEXT_PUBLIC_REQUIRE_AUTH === 'true';

function authRedirectUrl() {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}/auth/callback`;
}

const AuthContext = createContext({
  session: null,
  user: null,
  accessToken: null,
  loading: true,
  requireAuth: REQUIRE_AUTH,
  supabaseEnabled: false,
  signIn: async () => ({ error: { message: 'Supabase not configured' } }),
  signUp: async () => ({ error: { message: 'Supabase not configured' } }),
  signInWithGoogle: async () => ({ error: { message: 'Supabase not configured' } }),
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const supabase = useMemo(() => createClient(), []);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (email, password) => {
      if (!supabase) return { error: { message: 'Supabase is not configured' } };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error };
    },
    [supabase],
  );

  const signUp = useCallback(
    async (email, password) => {
      if (!supabase) return { error: { message: 'Supabase is not configured' } };
      const { error } = await supabase.auth.signUp({ email, password });
      return { error };
    },
    [supabase],
  );

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: { message: 'Supabase is not configured' } };
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectUrl(),
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    return { error };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setSession(null);
  }, [supabase]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      accessToken: session?.access_token ?? null,
      loading,
      requireAuth: REQUIRE_AUTH,
      supabaseEnabled: isSupabaseConfigured(),
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
    }),
    [session, loading, signIn, signUp, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function isAuthRequired() {
  return REQUIRE_AUTH;
}
