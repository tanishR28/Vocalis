'use client';

import { usePathname } from 'next/navigation';
import AppShell from './AppShell';

const TITLES = {
  '/': 'Dashboard',
  '/record': 'Record',
  '/history': 'History',
  '/insights': 'Insights',
  '/settings': 'Settings',
};

export default function AppLayout({ children }) {
  const pathname = usePathname();

  if (pathname === '/onboarding') {
    return children;
  }

  const title = TITLES[pathname] || 'Vocalis Health';

  return <AppShell title={title}>{children}</AppShell>;
}
