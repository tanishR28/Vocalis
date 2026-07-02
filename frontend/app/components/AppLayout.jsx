'use client';

import { usePathname } from 'next/navigation';
import AppShell from './AppShell';

const TITLES = {
  '/': 'Dashboard',
  '/record': 'Record',
  '/history': 'History',
  '/insights': 'Insights',
  '/settings': 'Settings',
  '/login': 'Sign in',
};

export default function AppLayout({ children }) {
  const pathname = usePathname();

  if (pathname === '/onboarding' || pathname === '/login') {
    return children;
  }

  const title = TITLES[pathname] || 'Vocalis';

  return <AppShell title={title}>{children}</AppShell>;
}
