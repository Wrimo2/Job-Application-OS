import * as React from 'react';
import { useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChartColumn,
  CircleQuestionMark,
  Ellipsis,
  FileText,
  Flame,
  Gift,
  House,
  Keyboard,
  LayoutDashboard,
  Monitor,
  Moon,
  NotebookPen,
  Plus,
  Search,
  Send,
  Settings,
  Sun,
  UserPlus,
  Users,
  CalendarPlus,
  ListTodo,
  MessageSquarePlus,
} from 'lucide-react';
import { cn, modKey } from '@/lib/utils';
import { useSettings } from '@/lib/hooks';
import { useData, useDueCounts } from '@/lib/data';
import { useUI } from '@/lib/store';
import { updateSettings } from '@/lib/db';
import { activityByDay, isActive, streak, weekProgress } from '@/lib/stats';
import { Button, Kbd, Progress } from './ui';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Sheet, Tip } from './overlay';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keys?: string;
}

export const NAV: { group?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, keys: 'G D' },
      { to: '/agenda', label: 'Agenda', icon: CalendarCheck, keys: 'G T' },
    ],
  },
  {
    group: 'Pipeline',
    items: [
      { to: '/applications', label: 'Applications', icon: Briefcase, keys: 'G A' },
      { to: '/interviews', label: 'Interviews', icon: CalendarDays, keys: 'G I' },
      { to: '/offers', label: 'Offers', icon: Gift, keys: 'G F' },
    ],
  },
  {
    group: 'Network',
    items: [
      { to: '/outreach', label: 'Outreach', icon: Send, keys: 'G O' },
      { to: '/contacts', label: 'Contacts', icon: Users, keys: 'G C' },
      { to: '/companies', label: 'Companies', icon: Building2, keys: 'G M' },
    ],
  },
  {
    group: 'Insights',
    items: [
      { to: '/analytics', label: 'Analytics', icon: ChartColumn, keys: 'G N' },
      { to: '/documents', label: 'Documents', icon: FileText, keys: 'G R' },
    ],
  },
];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-8 w-8 place-items-center rounded-[10px] bg-gradient-to-br from-indigo-500 to-fuchsia-500 shadow-md shadow-indigo-500/30">
        <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden>
          <circle cx="32" cy="32" r="15" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="5" />
          <path d="M23 41 L41 23 M29 23 H41 V35" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!compact && (
        <div className="leading-none">
          <div className="text-[15px] font-semibold tracking-tight">Pursuit</div>
          <div className="mt-0.5 text-[10.5px] font-medium text-muted-foreground">Job search OS</div>
        </div>
      )}
    </div>
  );
}

function useBadges() {
  const { apps, agenda } = useData();
  const due = useDueCounts();
  return useMemo(() => {
    const activeApps = apps.filter((a) => isActive(a) && a.status !== 'wishlist').length;
    const interviewsSoon = agenda.filter((a) => a.kind === 'interview' && (a.bucket === 'today' || a.bucket === 'tomorrow')).length;
    return {
      '/agenda': due.due ? { n: due.due, alert: due.overdue > 0 } : undefined,
      '/outreach': due.outreach ? { n: due.outreach, alert: false } : undefined,
      '/applications': activeApps ? { n: activeApps, quiet: true } : undefined,
      '/interviews': interviewsSoon ? { n: interviewsSoon, alert: false } : undefined,
    } as Record<string, { n: number; alert?: boolean; quiet?: boolean } | undefined>;
  }, [apps, agenda, due]);
}

export function NewMenu({ children, align = 'end' }: { children: React.ReactNode; align?: 'start' | 'end' }) {
  const ui = useUI();
  return (
    <Menu>
      <MenuTrigger asChild>{children}</MenuTrigger>
      <MenuContent align={align} className="w-60">
        <MenuItem icon={<Briefcase />} shortcut="N" onSelect={() => ui.openAppForm()}>
          Application
        </MenuItem>
        <MenuItem icon={<UserPlus />} shortcut="C" onSelect={() => ui.openContactForm()}>
          Contact / target
        </MenuItem>
        <MenuItem icon={<MessageSquarePlus />} shortcut="M" onSelect={() => ui.openComposer()}>
          Compose message
        </MenuItem>
        <MenuItem icon={<NotebookPen />} shortcut="L" onSelect={() => ui.openLog()}>
          Log outreach
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<CalendarPlus />} shortcut="I" onSelect={() => ui.openInterviewForm()}>
          Interview
        </MenuItem>
        <MenuItem icon={<ListTodo />} shortcut="T" onSelect={() => ui.openTaskForm()}>
          Task / reminder
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const badges = useBadges();
  return (
    <nav className="flex flex-col gap-4">
      {NAV.map((sec, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {sec.group && <div className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">{sec.group}</div>}
          {sec.items.map((it) => {
            const b = badges[it.to];
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === '/'}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
                    isActive ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground/80 hover:bg-accent hover:text-foreground',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && <span className="absolute -left-3 top-1.5 h-6 w-1 rounded-r-full bg-primary" />}
                    <it.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                    <span className="flex-1 truncate">{it.label}</span>
                    {b && (
                      <span
                        className={cn(
                          'min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums leading-5',
                          b.alert ? 'bg-rose-500 text-white' : b.quiet ? 'text-muted-foreground' : 'bg-primary/15 text-primary',
                        )}
                      >
                        {b.n}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function GoalsCard() {
  const settings = useSettings();
  const { apps, interactions, interviews, tasks } = useData();
  const navigate = useNavigate();
  const wk = useMemo(() => weekProgress(apps, interactions, settings), [apps, interactions, settings]);
  const st = useMemo(() => streak(activityByDay(apps, interactions, interviews, tasks)), [apps, interactions, interviews, tasks]);
  return (
    <button onClick={() => navigate('/analytics')} className="w-full rounded-xl border bg-card p-3 text-left shadow-soft transition-shadow hover:shadow-lift">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[12px] font-semibold">This week</span>
        <span className={cn('inline-flex items-center gap-1 text-[12px] font-semibold', st.current ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground')}>
          <Flame className={cn('h-3.5 w-3.5', st.current && 'animate-flame fill-orange-500/30')} />
          {st.current}d streak
        </span>
      </div>
      <div className="space-y-2">
        <div>
          <div className="mb-1 flex justify-between text-[11.5px] text-muted-foreground">
            <span>Applications</span>
            <span className="tabular-nums text-foreground">
              {wk.appsThisWeek}/{settings.goals.applicationsPerWeek}
            </span>
          </div>
          <Progress value={wk.appsThisWeek} max={settings.goals.applicationsPerWeek} />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-[11.5px] text-muted-foreground">
            <span>Outreach</span>
            <span className="tabular-nums text-foreground">
              {wk.outreachThisWeek}/{settings.goals.outreachPerWeek}
            </span>
          </div>
          <Progress value={wk.outreachThisWeek} max={settings.goals.outreachPerWeek} barClassName="bg-fuchsia-500" className="bg-fuchsia-500/10" />
        </div>
      </div>
    </button>
  );
}

export function Sidebar() {
  const ui = useUI();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-14 items-center px-4">
        <Logo />
      </div>
      <div className="flex flex-col gap-2 px-3 pb-3">
        <NewMenu align="start">
          <Button variant="primary" className="w-full justify-start">
            <Plus className="h-4 w-4" />
            New
            <span className="ml-auto text-[11px] font-normal opacity-70">N · C · M</span>
          </Button>
        </NewMenu>
        <button
          onClick={() => ui.setPalette(true)}
          className="flex h-9 items-center gap-2 rounded-lg border bg-card px-2.5 text-[13px] text-muted-foreground shadow-soft transition-colors hover:text-foreground"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search or jump to…</span>
          <Kbd>{modKey}</Kbd>
          <Kbd>K</Kbd>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <NavLinks />
      </div>
      <div className="space-y-2 border-t p-3">
        <div className="[@media(max-height:820px)]:hidden">
          <GoalsCard />
        </div>
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium transition-colors',
              isActive ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground/80 hover:bg-accent hover:text-foreground',
            )
          }
        >
          <Settings className="h-[18px] w-[18px] text-muted-foreground" />
          Settings & data
        </NavLink>
      </div>
    </aside>
  );
}

export function ThemeToggle() {
  const settings = useSettings();
  const next = settings.theme === 'light' ? 'dark' : settings.theme === 'dark' ? 'system' : 'light';
  const Icon = settings.theme === 'light' ? Sun : settings.theme === 'dark' ? Moon : Monitor;
  return (
    <Tip content={`Theme: ${settings.theme} (click for ${next})`}>
      <Button variant="ghost" size="icon-sm" aria-label="Toggle theme" onClick={() => updateSettings({ theme: next })}>
        <Icon className="h-[18px] w-[18px]" />
      </Button>
    </Tip>
  );
}

export function Topbar() {
  const ui = useUI();
  const due = useDueCounts();
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 sm:px-5 lg:px-8">
      <div className="lg:hidden">
        <Logo compact />
      </div>
      <button
        onClick={() => ui.setPalette(true)}
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-card px-3 text-[13px] text-muted-foreground shadow-soft transition-colors hover:text-foreground sm:max-w-md lg:hidden"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate">Search…</span>
      </button>
      <div className="hidden flex-1 lg:block" />
      <div className="flex items-center gap-1">
        <Tip content={due.due ? `${due.due} due today${due.overdue ? ` · ${due.overdue} overdue` : ''}` : 'Nothing due — nice!'}>
          <Button variant="ghost" size="icon-sm" aria-label="Agenda" onClick={() => navigate('/agenda')} className="relative">
            <Bell className="h-[18px] w-[18px]" />
            {due.due > 0 && (
              <span className={cn('absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[10px] font-bold text-white', due.overdue ? 'bg-rose-500' : 'bg-primary')}>
                {due.due > 99 ? '99+' : due.due}
              </span>
            )}
          </Button>
        </Tip>
        <ThemeToggle />
        <Tip content="Keyboard shortcuts (?)">
          <Button variant="ghost" size="icon-sm" aria-label="Shortcuts" className="hidden sm:inline-flex" onClick={() => ui.setShortcuts(true)}>
            <Keyboard className="h-[18px] w-[18px]" />
          </Button>
        </Tip>
        <NewMenu>
          <Button variant="primary" size="sm" className="ml-1 lg:hidden">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New</span>
          </Button>
        </NewMenu>
      </div>
    </header>
  );
}

export function MobileNav() {
  const ui = useUI();
  const location = useLocation();
  const due = useDueCounts();
  const items = [
    { to: '/', label: 'Home', icon: House },
    { to: '/applications', label: 'Jobs', icon: Briefcase },
    { to: '/outreach', label: 'Outreach', icon: Send, badge: due.outreach },
    { to: '/contacts', label: 'People', icon: Users },
  ];
  return (
    <>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t bg-background/90 backdrop-blur-xl lg:hidden">
        <div className="grid h-16 grid-cols-5">
          {items.map((it) => {
            const active = it.to === '/' ? location.pathname === '/' : location.pathname.startsWith(it.to);
            return (
              <NavLink key={it.to} to={it.to} className={cn('relative flex flex-col items-center justify-center gap-1 text-[11px] font-medium', active ? 'text-primary' : 'text-muted-foreground')}>
                <it.icon className="h-5 w-5" />
                {it.label}
                {!!it.badge && <span className="absolute right-[calc(50%-18px)] top-2 h-2 w-2 rounded-full bg-rose-500" />}
              </NavLink>
            );
          })}
          <button onClick={() => ui.setMobileNav(true)} className="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Ellipsis className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
      <Sheet open={ui.mobileNav} onOpenChange={ui.setMobileNav} title="Navigation" className="max-w-[300px]">
        <div className="flex h-14 items-center border-b px-4">
          <Logo />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <NavLinks onNavigate={() => ui.setMobileNav(false)} />
          <div className="mt-4 border-t pt-3">
            <NavLink to="/settings" onClick={() => ui.setMobileNav(false)} className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-sidebar-foreground/80 hover:bg-accent">
              <Settings className="h-[18px] w-[18px] text-muted-foreground" />
              Settings & data
            </NavLink>
            <button
              onClick={() => {
                ui.setMobileNav(false);
                ui.setShortcuts(true);
              }}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-sidebar-foreground/80 hover:bg-accent"
            >
              <CircleQuestionMark className="h-[18px] w-[18px] text-muted-foreground" />
              Help & shortcuts
            </button>
          </div>
        </div>
        <div className="border-t p-3">
          <GoalsCard />
        </div>
      </Sheet>
    </>
  );
}
