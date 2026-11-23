import * as React from 'react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Inbox, LayoutTemplate, PartyPopper, Plus, Repeat, Send, Target, Wrench, Zap, ArrowRight } from 'lucide-react';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/hooks';
import { useUI } from '@/lib/store';
import { gotReply, isOutreach, outreachStats, weekProgress } from '@/lib/stats';
import { cn, fmtPct, plural } from '@/lib/utils';
import { Button, Card, CardHeader, EmptyState, Progress, Tabs } from '@/components/ui';
import { Avatar, PageHeader, RelationshipBadge, StatTile } from '@/components/common';
import { AgendaGroups } from '@/features/agenda/AgendaList';
import TemplatesTab from './TemplatesTab';
import SequencesTab from './SequencesTab';
import ToolkitTab from './ToolkitTab';
import PlaybookTab from './PlaybookTab';

type Tab = 'queue' | 'templates' | 'sequences' | 'toolkit' | 'playbook';

export default function OutreachPage() {
  const { tab = 'queue' } = useParams();
  const navigate = useNavigate();
  const { agenda } = useData();
  const due = agenda.filter((a) => (a.kind === 'sequence' || a.kind === 'contact') && (a.bucket === 'overdue' || a.bucket === 'today')).length;
  const tabs = [
    { id: 'queue' as Tab, label: 'Queue', icon: <Inbox className="h-4 w-4" />, count: due || undefined },
    { id: 'templates' as Tab, label: 'Templates', icon: <LayoutTemplate className="h-4 w-4" /> },
    { id: 'sequences' as Tab, label: 'Sequences', icon: <Repeat className="h-4 w-4" /> },
    { id: 'toolkit' as Tab, label: 'Toolkit', icon: <Wrench className="h-4 w-4" /> },
    { id: 'playbook' as Tab, label: 'Playbook', icon: <BookOpen className="h-4 w-4" /> },
  ];
  return (
    <div className="page">
      <PageHeader icon={<Send className="h-5 w-5" />} title="Outreach" subtitle="Your cold-outreach machine: find people, send great messages, never miss a follow-up." />
      <Tabs tabs={tabs} value={tab as Tab} onChange={(t) => navigate(t === 'queue' ? '/outreach' : `/outreach/${t}`)} className="mb-5" />
      {tab === 'queue' && <QueueTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'sequences' && <SequencesTab />}
      {tab === 'toolkit' && <ToolkitTab />}
      {tab === 'playbook' && <PlaybookTab />}
    </div>
  );
}

function QueueTab() {
  const ui = useUI();
  const navigate = useNavigate();
  const settings = useSettings();
  const { agenda, contacts, enrollments, sequences, interactions, templates, apps, now } = useData();
  const outreachItems = agenda.filter((a) => a.kind === 'sequence' || a.kind === 'contact');
  const dueNow = outreachItems.filter((a) => a.bucket === 'overdue' || a.bucket === 'today');
  const wk = useMemo(() => weekProgress(apps, interactions, settings, now), [apps, interactions, settings, now]);
  const os = useMemo(() => outreachStats(interactions, contacts, templates), [interactions, contacts, templates]);
  const activeEnr = enrollments.filter((e) => e.status === 'active' || e.status === 'paused');
  const enrolledIds = new Set(activeEnr.map((e) => e.contactId));
  const ready = contacts.filter((c) => c.stage === 'target' && !enrolledIds.has(c.id)).sort((a, b) => b.priority - a.priority);

  const seqStats = useMemo(
    () =>
      sequences.map((s) => {
        const es = enrollments.filter((e) => e.sequenceId === s.id);
        const touches = interactions.filter((i) => isOutreach(i) && es.some((e) => e.id === i.enrollmentId));
        return {
          s,
          active: es.filter((e) => e.status === 'active' || e.status === 'paused').length,
          replied: es.filter((e) => e.status === 'replied').length,
          total: es.length,
          rate: touches.length ? (touches.filter(gotReply).length / touches.length) * 100 : null,
        };
      }),
    [sequences, enrollments, interactions],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Due now" value={dueNow.length} icon={<Inbox />} sub={<span>{outreachItems.length - dueNow.length} scheduled later</span>} />
        <StatTile label="Sent this week" value={`${wk.outreachThisWeek}/${settings.goals.outreachPerWeek}`} icon={<Send />} sub={<span>{wk.outreachToday} today</span>} />
        <StatTile label="Response rate" value={fmtPct(os.replyRate)} icon={<Zap />} sub={<span>{os.replied}/{os.sent} messages</span>} onClick={() => navigate('/analytics')} />
        <StatTile label="In sequences" value={activeEnr.length} icon={<Repeat />} sub={<span>{os.referrals} referrers so far</span>} onClick={() => navigate('/outreach/sequences')} />
      </div>

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[14px] font-semibold">
              Daily target: {wk.outreachToday}/{settings.goals.dailyOutreach} messages
            </div>
            <div className="text-[12.5px] text-muted-foreground">
              {wk.outreachToday >= settings.goals.dailyOutreach ? 'Target hit — anything more is a bonus. 🎯' : `${settings.goals.dailyOutreach - wk.outreachToday} more to go. Clear the queue, then reach out to new targets.`}
            </div>
          </div>
        </div>
        <Progress value={wk.outreachToday} max={settings.goals.dailyOutreach} className="h-2 sm:ml-auto sm:max-w-xs" barClassName="bg-fuchsia-500" />
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Your queue" subtitle="Click “Write” — the message is pre-drafted from the right template." icon={<Inbox className="h-4 w-4" />} />
          <div className="px-2 pb-3 pt-3 sm:px-3">
            <AgendaGroups
              items={outreachItems}
              buckets={['overdue', 'today', 'tomorrow', 'week', 'later']}
              emptyFor={
                <EmptyState
                  compact
                  icon={<PartyPopper className="h-5 w-5" />}
                  title="Queue is clear"
                  description="Start a sequence for the people waiting on the right, or add new targets."
                  action={
                    <Button size="sm" variant="primary" onClick={() => ui.openContactForm()}>
                      <Plus className="h-3.5 w-3.5" /> Add target
                    </Button>
                  }
                />
              }
            />
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Ready to start"
              subtitle="Targets not in a sequence yet"
              icon={<Target className="h-4 w-4" />}
              action={
                ready.length > 0 ? (
                  <Button size="xs" variant="primary" onClick={() => ui.openEnroll(ready.map((c) => c.id))}>
                    Enroll all
                  </Button>
                ) : undefined
              }
            />
            <div className="p-2 sm:p-3">
              {ready.length ? (
                <div className="space-y-0.5">
                  {ready.slice(0, 8).map((c) => (
                    <div key={c.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/60">
                      <Avatar name={c.name} size={28} />
                      <button className="min-w-0 flex-1 text-left" onClick={() => ui.openDrawer('contact', c.id)}>
                        <div className="truncate text-[13px] font-medium">{c.name}</div>
                        <div className="truncate text-[11.5px] text-muted-foreground">
                          {c.title}
                          {c.company ? ` · ${c.company}` : ''}
                        </div>
                      </button>
                      <span className="hidden 2xl:block">
                        <RelationshipBadge rel={c.relationship} />
                      </span>
                      <Button size="xs" variant="secondary" onClick={() => ui.openEnroll([c.id], undefined, c.applicationIds[0])}>
                        Start
                      </Button>
                    </div>
                  ))}
                  {ready.length > 8 && (
                    <button onClick={() => navigate('/contacts?quick=targets')} className="w-full px-2 py-1.5 text-left text-[12.5px] font-medium text-primary hover:underline">
                      +{ready.length - 8} more
                    </button>
                  )}
                </div>
              ) : (
                <EmptyState
                  compact
                  icon={<Target className="h-5 w-5" />}
                  title="No targets waiting"
                  description="Use the Toolkit to find recruiters, hiring managers and peers at your target companies."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate('/outreach/toolkit')}>
                      Open toolkit
                    </Button>
                  }
                />
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Sequences"
              icon={<Repeat className="h-4 w-4" />}
              action={
                <Button size="xs" variant="ghost" onClick={() => navigate('/outreach/sequences')}>
                  Manage <ArrowRight className="h-3 w-3" />
                </Button>
              }
            />
            <div className="divide-y px-4 pb-2 pt-2">
              {seqStats
                .filter((x) => x.total > 0)
                .sort((a, b) => b.active - a.active)
                .map(({ s, active, replied, total, rate }) => (
                  <div key={s.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">{s.name}</div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {active} active · {replied} replied · {plural(total, 'person', 'people')} total
                      </div>
                    </div>
                    <span className={cn('text-[13px] font-semibold tabular-nums', (rate ?? 0) >= 30 ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>{fmtPct(rate)}</span>
                  </div>
                ))}
              {!seqStats.some((x) => x.total > 0) && <p className="py-4 text-center text-[13px] text-muted-foreground">No one enrolled yet.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
