'use client';

import { useEffect } from 'react';
import { useAuth } from '../../lib/auth/AuthProvider';
import { setAccessTokenGetter } from '../../lib/api';

export default function ApiAuthBridge() {
  const { accessToken } = useAuth();

  useEffect(() => {
    setAccessTokenGetter(() => accessToken);
  }, [accessToken]);

  return null;
}
