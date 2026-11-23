import * as React from 'react';
import { Suspense, lazy, useEffect, useMemo } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SettingsContext, useHotkeys, useResolvedTheme, useSettingsQuery } from '@/lib/hooks';
import { DataProvider, useData, useDueCounts } from '@/lib/data';
import { ensureBuiltIns } from '@/lib/actions';
import { useUI } from '@/lib/store';
import { companyKey } from '@/lib/utils';
import type { Company, Settings } from '@/lib/types';
import { CompaniesContext } from '@/components/common';
import { ConfirmHost, TooltipProvider } from '@/components/overlay';
import { MobileNav, Sidebar, Topbar, Logo } from '@/components/layout';
import { CommandPalette, ShortcutsDialog } from '@/components/CommandPalette';
import { Onboarding } from '@/components/Onboarding';
import { Skeleton } from '@/components/ui';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ApplicationFormHost } from '@/features/applications/ApplicationForm';
import { ApplicationDrawerHost } from '@/features/applications/ApplicationDrawer';
import { ContactFormHost } from '@/features/contacts/ContactForm';
import { ContactDrawerHost } from '@/features/contacts/ContactDrawer';
import { LogInteractionHost } from '@/features/contacts/LogInteractionForm';
import { CompanyDrawerHost } from '@/features/companies/CompanyDrawer';
import { TaskFormHost } from '@/features/agenda/TaskForm';
import { InterviewFormHost } from '@/features/interviews/InterviewForm';
import { ComposerHost } from '@/features/outreach/Composer';
import { EnrollHost } from '@/features/outreach/EnrollDialog';

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const AgendaPage = lazy(() => import('@/features/agenda/AgendaPage'));
const ApplicationsPage = lazy(() => import('@/features/applications/ApplicationsPage'));
const InterviewsPage = lazy(() => import('@/features/interviews/InterviewsPage'));
const OffersPage = lazy(() => import('@/features/offers/OffersPage'));
const OutreachPage = lazy(() => import('@/features/outreach/OutreachPage'));
const ContactsPage = lazy(() => import('@/features/contacts/ContactsPage'));
const CompaniesPage = lazy(() => import('@/features/companies/CompaniesPage'));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage'));
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const CapturePage = lazy(() => import('@/features/capture/CapturePage'));

function useThemeSync(settings: Settings) {
  const resolved = useResolvedTheme(settings.theme);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', resolved === 'dark');
    root.setAttribute('data-accent', settings.accent);
    try {
      localStorage.setItem('pursuit.theme', settings.theme);
      localStorage.setItem('pursuit.accent', settings.accent);
    } catch {
      /* ignore */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0b0b10' : '#f7f7f9');
  }, [resolved, settings.accent, settings.theme]);
  return resolved;
}

function CompaniesProvider({ children }: { children: React.ReactNode }) {
  const { companies } = useData();
  const map = useMemo(() => {
    const m = new Map<string, Company>();
    for (const c of companies) m.set(companyKey(c.name), c);
    return m;
  }, [companies]);
  return <CompaniesContext.Provider value={map}>{children}</CompaniesContext.Provider>;
}

/** Native notifications for due items, at most once per day per count. */
function useDueNotifications(enabled: boolean) {
  const due = useDueCounts();
  useEffect(() => {
    if (!enabled || typeof Notification === 'undefined' || Notification.permission !== 'granted' || due.due === 0) return;
    const key = `pursuit.notified.${new Date().toDateString()}`;
    try {
      if (localStorage.getItem(key) === String(due.due)) return;
      localStorage.setItem(key, String(due.due));
    } catch {
      /* ignore */
    }
    const n = new Notification('Pursuit — today’s game plan', {
      body: `${due.due} item${due.due === 1 ? '' : 's'} due${due.overdue ? ` (${due.overdue} overdue)` : ''}. ${due.outreach ? `${due.outreach} outreach follow-ups waiting.` : ''}`,
      icon: './favicon.svg',
    });
    n.onclick = () => {
      window.focus();
      location.hash = '#/agenda';
    };
  }, [enabled, due.due, due.overdue, due.outreach]);
}

function PageFallback() {
  return (
    <div className="page space-y-4">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

function Shell({ settings }: { settings: Settings }) {
  const ui = useUI();
  const navigate = useNavigate();
  const location = useLocation();
  const resolved = useThemeSync(settings);
  useDueNotifications(settings.notifications);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useHotkeys({
    'mod+k': () => ui.setPalette(!useUI.getState().palette),
    '/': () => ui.setPalette(true),
    n: () => ui.openAppForm(),
    c: () => ui.openContactForm(),
    m: () => ui.openComposer(),
    l: () => ui.openLog(),
    i: () => ui.openInterviewForm(),
    t: () => ui.openTaskForm(),
    '?': () => ui.setShortcuts(true),
    'g d': () => navigate('/'),
    'g t': () => navigate('/agenda'),
    'g a': () => navigate('/applications'),
    'g i': () => navigate('/interviews'),
    'g f': () => navigate('/offers'),
    'g o': () => navigate('/outreach'),
    'g c': () => navigate('/contacts'),
    'g m': () => navigate('/companies'),
    'g n': () => navigate('/analytics'),
    'g r': () => navigate('/documents'),
    'g s': () => navigate('/settings'),
  });

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="lg:pl-[248px]">
        <Topbar />
        <main>
          <ErrorBoundary resetKey={location.pathname}>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/agenda" element={<AgendaPage />} />
              <Route path="/applications" element={<ApplicationsPage />} />
              <Route path="/interviews/:tab?" element={<InterviewsPage />} />
              <Route path="/offers" element={<OffersPage />} />
              <Route path="/outreach/:tab?" element={<OutreachPage />} />
              <Route path="/contacts" element={<ContactsPage />} />
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/documents/:tab?" element={<DocumentsPage />} />
              <Route path="/settings/:tab?" element={<SettingsPage />} />
              <Route path="/capture" element={<CapturePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </main>
      </div>
      <MobileNav />

      <ApplicationFormHost />
      <ApplicationDrawerHost />
      <ContactFormHost />
      <ContactDrawerHost />
      <CompanyDrawerHost />
      <LogInteractionHost />
      <TaskFormHost />
      <InterviewFormHost />
      <ComposerHost />
      <EnrollHost />
      <CommandPalette />
      <ShortcutsDialog />
      <ConfirmHost />
      {!settings.onboarded && <Onboarding />}
      <Toaster
        theme={resolved}
        position="bottom-right"
        richColors
        closeButton
        offset={20}
        toastOptions={{ className: 'font-sans', style: { borderRadius: 12 } }}
      />
    </div>
  );
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="animate-pulse">
        <Logo />
      </div>
    </div>
  );
}

export default function App() {
  const settings = useSettingsQuery();
  useEffect(() => {
    ensureBuiltIns().catch(console.error);
  }, []);
  if (!settings) return <Splash />;
  return (
    <SettingsContext.Provider value={settings}>
      <DataProvider>
        <CompaniesProvider>
          <TooltipProvider delayDuration={250}>
            <HashRouter>
              <Shell settings={settings} />
            </HashRouter>
          </TooltipProvider>
        </CompaniesProvider>
      </DataProvider>
    </SettingsContext.Provider>
  );
}
