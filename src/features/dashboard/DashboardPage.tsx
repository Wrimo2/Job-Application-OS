import * as React from 'react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, subDays } from 'date-fns';
import {
  ArrowRight,
  Bookmark,
  Brain,
  Briefcase,
  CalendarDays,
  ChartColumn,
  Check,
  CircleCheck,
  Clock,
  FileText,
  Flame,
  Ghost,
  Gift,
  Linkedin,
  Plus,
  Send,
  Sparkles,
  Target,
  Users,
  Zap,
  PartyPopper,
  Circle,
} from 'lucide-react';
import { useData } from '@/lib/data';
import { useLocalState, useSettings } from '@/lib/hooks';
import { useUI } from '@/lib/store';
import { BOARD_STAGES, STAGE_MAP, platformMeta } from '@/lib/constants';
import { generateInsights, type Insight, type InsightIcon } from '@/lib/insights';
import { activityByDay, breakdownBy, isActive, isApplied, outreachStats, periodKPIs, streak, weekProgress, weeklySeries } from '@/lib/stats';
import { cn, firstName, fmtPct, greeting, plural } from '@/lib/utils';
import { Button, Card, CardHeader, EmptyState, Progress, ProgressRing } from '@/components/ui';
import { CompanyLogo, StatTile } from '@/components/common';
import { ActivityHeatmap, BarList, SegmentedBar } from '@/components/charts';
import { AgendaGroups } from '@/features/agenda/AgendaList';

const ICONS: Record<InsightIcon, React.ComponentType<{ className?: string }>> = {
  clock: Clock,
  ghost: Ghost,
  chart: ChartColumn,
  users: Users,
  target: Target,
  send: Send,
  brain: Brain,
  calendar: CalendarDays,
  bookmark: Bookmark,
  flame: Flame,
  file: FileText,
  gift: Gift,
  check: CircleCheck,
  zap: Zap,
};

const TONE: Record<Insight['tone'], { ring: string; icon: string; label: string }> = {
  action: { ring: 'border-primary/25 bg-gradient-to-br from-primary/[0.08] to-transparent', icon: 'bg-primary/15 text-primary', label: 'Do this' },
  warning: { ring: 'border-amber-500/30 bg-gradient-to-br from-amber-500/[0.08] to-transparent', icon: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', label: 'Heads up' },
  tip: { ring: 'border-sky-500/25 bg-gradient-to-br from-sky-500/[0.07] to-transparent', icon: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', label: 'Insight' },
  win: { ring: 'border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent', icon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', label: 'Win' },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const navigate = useNavigate();
  const Icon = ICONS[insight.icon];
  const t = TONE[insight.tone];
  return (
    <div className={cn('flex flex-col rounded-xl border p-4 shadow-soft', t.ring)}>
      <div className="flex items-start gap-3">
        <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', t.icon)}>
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{t.label}</div>
          <div className="text-[14px] font-semibold leading-snug tracking-tight">{insight.title}</div>
        </div>
      </div>
      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">{insight.body}</p>
      {insight.cta && (
        <button onClick={() => navigate(insight.cta!.to)} className="mt-3 inline-flex items-center gap-1 self-start text-[13px] font-medium text-primary hover:underline">
          {insight.cta.label} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function GettingStarted() {
  const ui = useUI();
  const navigate = useNavigate();
  const settings = useSettings();
  const { apps, contacts, enrollments } = useData();
  const [hidden, setHidden] = useLocalState('dash.gettingStartedHidden', false);
  const steps = [
    { done: !!(settings.profile.name && settings.profile.achievement && settings.profile.skills.length), label: 'Complete your profile (powers every template)', action: () => navigate('/settings/profile') },
    { done: apps.length > 0, label: 'Add your first application', action: () => ui.openAppForm() },
    { done: contacts.filter((c) => c.stage === 'target').length >= 3 || contacts.length >= 5, label: 'Add 3 people to reach out to', action: () => ui.openContactForm() },
    { done: enrollments.length > 0, label: 'Start an outreach sequence', action: () => navigate('/outreach/sequences') },
    { done: contacts.some((c) => c.source === 'LinkedIn connection'), label: 'Import your LinkedIn connections', action: () => navigate('/contacts') },
    { done: false, label: 'Add the 1-click job capture button to your browser', action: () => navigate('/settings/capture') },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || doneCount === steps.length) return null;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <ProgressRing value={doneCount} max={steps.length} size={72}>
          <span className="text-sm font-semibold">
            {doneCount}/{steps.length}
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-semibold">Set up your job-search machine</h3>
            <button className="text-[12px] text-muted-foreground hover:text-foreground" onClick={() => setHidden(true)}>
              Hide
            </button>
          </div>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {steps.map((s) => (
              <button key={s.label} onClick={s.action} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-accent">
                {s.done ? <CircleCheck className="h-4 w-4 shrink-0 text-emerald-500" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
                <span className={cn(s.done && 'text-muted-foreground line-through')}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const ui = useUI();
  const navigate = useNavigate();
  const settings = useSettings();
  const data = useData();
  const { apps, contacts, interactions, interviews, tasks, enrollments, templates, documents, offers, agenda, now } = data;

  const activity = useMemo(() => activityByDay(apps, interactions, interviews, tasks), [apps, interactions, interviews, tasks]);
  const st = useMemo(() => streak(activity, now), [activity, now]);
  const wk = useMemo(() => weekProgress(apps, interactions, settings, now), [apps, interactions, settings, now]);
  const cur = useMemo(() => periodKPIs(apps, interactions, interviews, subDays(now, 30), now), [apps, interactions, interviews, now]);
  const prev = useMemo(() => periodKPIs(apps, interactions, interviews, subDays(now, 60), subDays(now, 30)), [apps, interactions, interviews, now]);
  const weeks = useMemo(() => weeklySeries(apps, interactions, interviews, 8, settings.weekStartsOn, now), [apps, interactions, interviews, settings.weekStartsOn, now]);
  const os = useMemo(() => outreachStats(interactions, contacts, templates), [interactions, contacts, templates]);
  const insights = useMemo(
    () => generateInsights({ apps, contacts, interactions, interviews, enrollments, templates, documents, offers, activity, settings, now }),
    [apps, contacts, interactions, interviews, enrollments, templates, documents, offers, activity, settings, now],
  );
  const platforms = useMemo(
    () =>
      breakdownBy(apps, (a) => a.platform, (k) => platformMeta(k).label)
        .filter((b) => b.total >= 2)
        .sort((a, b) => (b.positiveRate ?? 0) - (a.positiveRate ?? 0))
        .slice(0, 6),
    [apps],
  );
  const active = apps.filter(isActive);
  const inProcess = active.filter((a) => ['screening', 'assessment', 'interviewing', 'offer'].includes(a.status)).length;
  const upcoming = interviews
    .filter((i) => i.outcome === 'scheduled' && new Date(i.scheduledAt) >= new Date(now.getTime() - 60 * 60 * 1000))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const focus = agenda.filter((a) => a.bucket === 'overdue' || a.bucket === 'today' || a.bucket === 'tomorrow');
  const dueNow = agenda.filter((a) => a.bucket === 'overdue' || a.bucket === 'today').length;
  const name = firstName(settings.profile.name);

  const summary = [
    dueNow ? `${plural(dueNow, 'thing')} to do today` : 'nothing urgent today',
    upcoming.length ? `${plural(upcoming.length, 'interview')} coming up` : null,
    st.current ? `a ${st.current}-day streak 🔥` : null,
  ].filter(Boolean);

  const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

  return (
    <div className="surface-glow">
      <div className="page space-y-6">
        {/* Hero */}
        <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[13px] font-medium text-muted-foreground">{format(now, 'EEEE, d MMMM')}</p>
            <h1 className="mt-1 text-[26px] font-semibold tracking-tight sm:text-[30px]">
              {greeting(now)}
              {name ? `, ${name}` : ''} 👋
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              You have {summary.join(', ').replace(/, ([^,]*)$/, ' and $1')}.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => ui.openComposer()}>
              <Send className="h-4 w-4" /> Compose
            </Button>
            <Button variant="primary" onClick={() => ui.openAppForm()}>
              <Plus className="h-4 w-4" /> Add application
            </Button>
          </div>
        </div>

        <GettingStarted />

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Active pipeline"
            value={active.filter((a) => a.status !== 'wishlist').length}
            icon={<Briefcase />}
            sub={<span>{inProcess} in process · {active.filter((a) => a.status === 'wishlist').length} saved</span>}
            spark={weeks.map((w) => w.applications)}
            onClick={() => navigate('/applications')}
          />
          <StatTile
            label="Response rate · 30d"
            value={fmtPct(cur.responseRate)}
            delta={delta(cur.responseRate, prev.responseRate)}
            icon={<Zap />}
            sub={<span>{cur.responses}/{cur.applied} applications</span>}
            spark={weeks.map((w) => w.responses)}
            onClick={() => navigate('/analytics')}
          />
          <StatTile
            label="Interviews"
            value={upcoming.length}
            icon={<CalendarDays />}
            sub={<span>upcoming · {cur.interviews} in last 30d</span>}
            spark={weeks.map((w) => w.interviews)}
            onClick={() => navigate('/interviews')}
          />
          <StatTile
            label="Outreach response"
            value={fmtPct(os.replyRate)}
            icon={<Send />}
            sub={<span>{wk.outreachThisWeek} sent this week</span>}
            spark={weeks.map((w) => w.outreach)}
            onClick={() => navigate('/outreach')}
          />
        </div>

        {/* Game plan + goals */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title="Today’s game plan"
              subtitle="Follow-ups, sequence steps, interviews and tasks — in priority order."
              icon={<Target className="h-4 w-4" />}
              action={
                <Button size="sm" variant="ghost" onClick={() => navigate('/agenda')}>
                  Full agenda <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <div className="max-h-[440px] overflow-y-auto px-2 pb-3 pt-3 sm:px-3">
              <AgendaGroups
                items={focus}
                buckets={['overdue', 'today', 'tomorrow']}
                emptyFor={
                  <EmptyState
                    compact
                    icon={<PartyPopper className="h-5 w-5" />}
                    title="You’re all caught up"
                    description="Great time to find 3 new people at a dream company, or apply to jobs posted in the last 24 hours."
                    action={
                      <>
                        <Button size="sm" variant="secondary" onClick={() => navigate('/outreach/toolkit')}>
                          Find people & jobs
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => ui.openContactForm()}>
                          Add a target
                        </Button>
                      </>
                    }
                  />
                }
              />
            </div>
          </Card>

          <Card>
            <CardHeader title="This week" subtitle={`${wk.daysLeft} day${wk.daysLeft === 1 ? '' : 's'} left · goals in Settings`} icon={<Flame className="h-4 w-4" />} />
            <div className="space-y-5 p-5">
              <div className="flex items-center justify-around">
                <div className="flex flex-col items-center gap-2">
                  <ProgressRing value={wk.appsThisWeek} max={settings.goals.applicationsPerWeek} size={92} stroke={8}>
                    <div className="text-center">
                      <div className="text-lg font-semibold leading-none">{wk.appsThisWeek}</div>
                      <div className="text-[10.5px] text-muted-foreground">/ {settings.goals.applicationsPerWeek}</div>
                    </div>
                  </ProgressRing>
                  <span className="text-[12px] font-medium text-muted-foreground">Applications</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <ProgressRing value={wk.outreachThisWeek} max={settings.goals.outreachPerWeek} size={92} stroke={8} barClass="stroke-fuchsia-500" trackClass="stroke-fuchsia-500/15">
                    <div className="text-center">
                      <div className="text-lg font-semibold leading-none">{wk.outreachThisWeek}</div>
                      <div className="text-[10.5px] text-muted-foreground">/ {settings.goals.outreachPerWeek}</div>
                    </div>
                  </ProgressRing>
                  <span className="text-[12px] font-medium text-muted-foreground">Outreach</span>
                </div>
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-[12.5px]">
                  <span className="text-muted-foreground">Outreach today</span>
                  <span className="font-medium tabular-nums">
                    {wk.outreachToday}/{settings.goals.dailyOutreach}
                  </span>
                </div>
                <Progress value={wk.outreachToday} max={settings.goals.dailyOutreach} barClassName={wk.outreachToday >= settings.goals.dailyOutreach ? 'bg-emerald-500' : undefined} />
              </div>
              <div className="flex items-center gap-3 rounded-xl border bg-gradient-to-r from-orange-500/10 to-transparent p-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500/15">
                  <Flame className={cn('h-5 w-5 text-orange-500', st.current > 0 && 'animate-flame')} />
                </div>
                <div>
                  <div className="text-[14px] font-semibold">{plural(st.current, 'day')} streak</div>
                  <div className="text-[12px] text-muted-foreground">
                    Best: {st.best}d · {st.todayDone ? 'today ✓' : 'do one thing today to keep it'}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Insights */}
        {insights.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
                <Sparkles className="h-4 w-4 text-primary" /> What to do next
              </h2>
              <Link to="/analytics" className="text-[13px] font-medium text-primary hover:underline">
                Open analytics
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {insights.slice(0, 6).map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
            </div>
          </div>
        )}

        {/* Pipeline + interviews */}
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader title="Pipeline snapshot" subtitle="Where your active applications are right now" icon={<Briefcase className="h-4 w-4" />} />
            <div className="space-y-5 p-5">
              <SegmentedBar
                parts={BOARD_STAGES.map((s) => ({ key: s, label: STAGE_MAP[s].label, value: active.filter((a) => a.status === s).length, className: STAGE_MAP[s].bar }))}
                onSelect={() => navigate('/applications')}
              />
              <div className="grid grid-cols-3 gap-2 xl:grid-cols-6">
                {BOARD_STAGES.map((s) => (
                  <button key={s} onClick={() => navigate('/applications')} className="rounded-lg border bg-card px-2 py-2 text-left hover:bg-accent">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={cn('h-1.5 w-1.5 rounded-full', STAGE_MAP[s].dot)} />
                      {STAGE_MAP[s].label}
                    </div>
                    <div className="mt-0.5 text-lg font-semibold">{active.filter((a) => a.status === s).length}</div>
                  </button>
                ))}
              </div>
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader
              title="Upcoming interviews"
              icon={<CalendarDays className="h-4 w-4" />}
              action={
                <Button size="sm" variant="ghost" onClick={() => navigate('/interviews')}>
                  All <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <div className="space-y-1 p-3">
              {upcoming.length ? (
                upcoming.slice(0, 4).map((iv) => {
                  const app = apps.find((a) => a.id === iv.applicationId);
                  const when = new Date(iv.scheduledAt);
                  const soon = when.getTime() - now.getTime() < 36 * 3600 * 1000;
                  const link = iv.location && /^https?:/.test(iv.location) ? iv.location : undefined;
                  return (
                    <div key={iv.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent/60">
                      <div className={cn('flex w-11 shrink-0 flex-col items-center rounded-lg py-1', soon ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                        <span className="text-[9.5px] font-semibold uppercase">{format(when, 'MMM')}</span>
                        <span className="text-[15px] font-semibold leading-none">{format(when, 'd')}</span>
                      </div>
                      <button className="min-w-0 flex-1 text-left" onClick={() => app && ui.openDrawer('application', app.id, 'interviews')}>
                        <div className="flex items-center gap-1.5">
                          {app && <CompanyLogo name={app.company} size={16} rounded="rounded" />}
                          <span className="truncate text-[13.5px] font-medium">{app?.company}</span>
                        </div>
                        <div className="truncate text-[12px] text-muted-foreground">
                          {iv.round} · {format(when, 'EEE h:mm a')}
                        </div>
                      </button>
                      {link && soon ? (
                        <Button size="xs" variant="primary" onClick={() => window.open(link, '_blank', 'noopener')}>
                          Join
                        </Button>
                      ) : (
                        <Button size="xs" variant="secondary" onClick={() => app && ui.openDrawer('application', app.id, 'interviews')}>
                          Prep {iv.checklist.filter((c) => c.done).length}/{iv.checklist.length}
                        </Button>
                      )}
                    </div>
                  );
                })
              ) : (
                <EmptyState compact icon={<CalendarDays className="h-5 w-5" />} title="No interviews scheduled" description="They’ll appear here with prep checklists. Outreach is the fastest way to get more." />
              )}
            </div>
          </Card>
        </div>

        {/* Activity + platforms */}
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="min-w-0 lg:col-span-3">
            <CardHeader title="Consistency" subtitle="Applications, outreach, interviews and tasks per day" icon={<Flame className="h-4 w-4" />} />
            <div className="p-5">
              <ActivityHeatmap activity={activity} weeks={20} weekStartsOn={settings.weekStartsOn} />
            </div>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader title="Where you get traction" subtitle="% of applications that reach screening, by platform" icon={<ChartColumn className="h-4 w-4" />} />
            <div className="p-5">
              <BarList
                rows={platforms.map((p) => ({
                  key: p.key,
                  label: p.label,
                  dot: platformMeta(p.key).color,
                  value: p.positiveRate ?? 0,
                  display: fmtPct(p.positiveRate),
                  sub: `${p.positive}/${p.total}`,
                }))}
                max={100}
                onSelect={() => navigate('/analytics')}
                emptyText="Apply on a couple of platforms to compare them."
              />
            </div>
          </Card>
        </div>

        {!apps.length && !contacts.length && (
          <p className="text-center text-[12.5px] text-muted-foreground">
            Tip: press <b>N</b> to add an application, <b>C</b> to add a contact, or <b>{'⌘/Ctrl K'}</b> to search everything.
          </p>
        )}
      </div>
    </div>
  );
}
