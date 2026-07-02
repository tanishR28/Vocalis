'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Mic,
  History,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  Plus,
  Activity,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProfile, clearProfile } from '@/lib/profile';
import { getCondition } from '@/lib/conditions';
import { getSidebarCollapsed, setSidebarCollapsed } from '@/lib/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import NavbarSessionCalendar from './NavbarSessionCalendar';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/record', label: 'Record', icon: Mic },
  { href: '/history', label: 'History', icon: History },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

function NavLinks({ pathname, collapsed, onNavigate }) {
  return (
    <nav className={cn('flex flex-col gap-1', collapsed ? 'p-2' : 'p-3')}>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || (href !== '/' && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={cn(
              'flex items-center rounded-xl text-sm font-medium transition-colors',
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
              active
                ? 'bg-white text-primary shadow-sm border border-slate-200'
                : 'text-slate-600 hover:bg-white hover:text-primary'
            )}
          >
            <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
            {!collapsed && label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand({ collapsed, onToggle, showToggle = true }) {
  return (
    <div
      className={cn(
        'flex items-center border-b border-slate-200',
        collapsed ? 'flex-col gap-2 px-2 py-3' : 'gap-3 px-4 py-5'
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md">
        <Activity className="h-5 w-5" />
      </div>
      {!collapsed && (
        <div className="min-w-0 flex-1">
          <p className="font-headline text-lg font-extrabold tracking-tight text-primary truncate">Vocalis</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Clinical Grade</p>
        </div>
      )}
      {showToggle && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-slate-500"
          onClick={onToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}

function SidebarFooter({ condition, collapsed }) {
  return (
    <div className={cn('border-t border-slate-200', collapsed ? 'p-2' : 'p-4')}>
      {collapsed ? (
        <Button asChild size="icon" className="w-full rounded-xl shadow-md" title="New Recording">
          <Link href="/record">
            <Plus className="h-4 w-4" />
          </Link>
        </Button>
      ) : (
        <>
          <Button asChild className="w-full rounded-xl shadow-md">
            <Link href="/record">
              <Plus className="h-4 w-4" />
              New Recording
            </Link>
          </Button>
          {condition && (
            <p className="mt-3 text-center text-[11px] font-medium text-slate-500 truncate">
              Monitoring {condition.label}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function SidebarPanel({ pathname, collapsed, condition, onToggle, onNavigate, showToggle = true }) {
  return (
    <>
      <SidebarBrand collapsed={collapsed} onToggle={onToggle} showToggle={showToggle} />
      <div className="flex-1 overflow-y-auto">
        <NavLinks pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      <SidebarFooter condition={condition} collapsed={collapsed} />
    </>
  );
}

export default function AppShell({ children, title, headerActions }) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setProfile(getProfile());
  }, [pathname]);

  useEffect(() => {
    setCollapsed(getSidebarCollapsed());
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      setSidebarCollapsed(next);
      return next;
    });
  }

  const condition = profile ? getCondition(profile.conditionId) : null;
  const initials = (profile?.patientName || 'P')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleExit() {
    clearProfile();
    localStorage.removeItem('vocalis_latest_analysis');
    localStorage.removeItem('vocalis_just_updated');
    router.push('/onboarding');
  }

  const pageTitle = title || 'Vocalis';

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          'hidden md:flex fixed top-0 left-0 z-40 h-screen flex-col bg-slate-50 border-r border-slate-200 transition-all duration-300',
          collapsed ? 'w-[4.5rem]' : 'w-64'
        )}
      >
        <SidebarPanel
          pathname={pathname}
          collapsed={collapsed}
          condition={condition}
          onToggle={toggleSidebar}
        />
      </aside>

      <div
        className={cn(
          'flex min-h-screen flex-col transition-[margin] duration-300',
          collapsed ? 'md:ml-[4.5rem]' : 'md:ml-64'
        )}
      >
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 shadow-sm">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="flex h-full w-72 flex-col p-0">
              <SidebarPanel
                pathname={pathname}
                collapsed={false}
                condition={condition}
                onToggle={() => {}}
                onNavigate={() => setMobileOpen(false)}
                showToggle={false}
              />
            </SheetContent>
          </Sheet>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex text-slate-500"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </Button>

          <h1 className="flex-1 truncate font-headline text-lg font-bold text-primary">{pageTitle}</h1>

          {headerActions ? <div className="flex items-center gap-2">{headerActions}</div> : null}

          <NavbarSessionCalendar />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="User menu"
              >
                <Avatar>
                  <AvatarFallback>{initials}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col gap-0.5">
                  <span>{profile?.patientName || 'Patient'}</span>
                  {condition && (
                    <span className="text-xs font-normal text-slate-500">{condition.label} monitoring</span>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExit} className="text-error focus:text-error">
                <LogOut className="h-4 w-4" />
                Exit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 overflow-x-hidden pb-20 md:pb-8">{children}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-slate-200 bg-white px-2 py-2 md:hidden">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-1.5 py-1 text-[10px] font-bold',
                  active ? 'text-primary' : 'text-slate-400'
                )}
              >
                <Icon className="h-5 w-5" />
                {label.split(' ')[0]}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
