import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  ArrowUpRight,
  Briefcase,
  CalendarPlus,
  Check,
  Clock,
  Copy,
  CopyPlus,
  Ellipsis,
  ExternalLink,
  FileText,
  Flag,
  History,
  Link2,
  ListTodo,
  MapPin,
  MessageSquare,
  NotebookPen,
  Pencil,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
  Wallet,
  CircleDot,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/hooks';
import { confirmDialog, undoToast, useUI } from '@/lib/store';
import {
  completeAppAction,
  deleteApplications,
  duplicateApplication,
  linkContactToApplication,
  logInteraction,
  snoozeItem,
  unlinkContactFromApplication,
  updateApplication,
} from '@/lib/actions';
import { BOARD_STAGES, CLOSED_STAGES, KIND_LABEL, METHOD_MAP, REJECTION_REASONS, STAGES, STAGE_MAP, STAGE_RANK, WORK_MODE_LABEL, JOB_TYPE_LABEL } from '@/lib/constants';
import { peopleSearch, type Persona, companyResearch } from '@/lib/toolkit';
import { furthestRank, responseDays } from '@/lib/stats';
import type { Application, Stage } from '@/lib/types';
import { cn, companyKey, copyText, daysBetween, fmtDate, fmtDateTime, formatSalaryRange, relDay, toDate } from '@/lib/utils';
import { Sheet } from '@/components/overlay';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tip } from '@/components/overlay';
import { Badge, Button, EmptyState, Input, Select, StarRating, Tabs, Textarea } from '@/components/ui';
import { Avatar, CompanyLogo, ContactStageBadge, InfoRow, LinkChip, PlatformTag, PriorityFlag, StageBadge, ChannelIcon, useCompanyMap } from '@/components/common';
import { DateInput, TagInput } from '@/components/fields';
import { InterviewCard } from '@/features/interviews/InterviewCard';
import { JDMatchPanel } from './JDMatch';
import { applicationSummary, moveWithFeedback } from './helpers';

type TabId = 'overview' | 'activity' | 'interviews' | 'people' | 'jd' | 'notes';

export function ApplicationDrawerHost() {
  const drawer = useUI((s) => s.drawer);
  const close = useUI((s) => s.closeDrawer);
  const { apps } = useData();
  const open = drawer.type === 'application';
  const app = open ? apps.find((a) => a.id === drawer.id) : undefined;
  return (
    <Sheet open={open && !!app} onOpenChange={(v) => !v && close()} title={app ? `${app.role} at ${app.company}` : 'Application'}>
      {app && <ApplicationDetail key={app.id} app={app} initialTab={(drawer.tab as TabId) ?? 'overview'} />}
    </Sheet>
  );
}

function StageStepper({ app }: { app: Application }) {
  const navigate = useNavigate();
  const reached = furthestRank(app);
  const closed = CLOSED_STAGES.includes(app.status);
  const steps = BOARD_STAGES.filter((s) => s !== 'wishlist');
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => {
        const rank = STAGE_RANK[s];
        const done = rank <= reached && !(app.status === 'wishlist');
        const current = app.status === s;
        return (
          <React.Fragment key={s}>
            <Tip content={`Move to ${STAGE_MAP[s].label}`}>
              <button
                onClick={() => moveWithFeedback(app.id, s, navigate)}
                className={cn(
                  'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent',
                  current ? 'text-foreground' : done ? 'text-foreground/80' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'grid h-6 w-6 place-items-center rounded-full border-2 text-[10px] transition-colors',
                    current ? `${STAGE_MAP[s].bar} border-transparent text-white` : done ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border bg-card',
                  )}
                >
                  {done && !current ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="w-full truncate text-center">{STAGE_MAP[s].label}</span>
              </button>
            </Tip>
            {i < steps.length - 1 && <div className={cn('mb-5 h-0.5 w-3 shrink-0 rounded-full sm:w-6', rank < reached ? 'bg-primary/50' : 'bg-border')} />}
          </React.Fragment>
        );
      })}
      {closed && (
        <div className="mb-5 ml-1 shrink-0">
          <StageBadge stage={app.status} />
        </div>
      )}
    </div>
  );
}

function ApplicationDetail({ app, initialTab }: { app: Application; initialTab: TabId }) {
  const ui = useUI();
  const navigate = useNavigate();
  const settings = useSettings();
  const { interviews, contacts, interactions, tasks, documents } = useData();
  const companyMap = useCompanyMap();
  const [tab, setTab] = useState<TabId>(initialTab);
  const myInterviews = useMemo(() => interviews.filter((i) => i.applicationId === app.id).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)), [interviews, app.id]);
  const linked = useMemo(() => contacts.filter((c) => app.contactIds.includes(c.id) || c.applicationIds.includes(app.id)), [contacts, app]);
  const atCompany = useMemo(() => contacts.filter((c) => c.company && companyKey(c.company) === companyKey(app.company) && !linked.some((l) => l.id === c.id)), [contacts, app.company, linked]);
  const myTouches = useMemo(() => interactions.filter((i) => i.applicationId === app.id), [interactions, app.id]);
  const myTasks = useMemo(() => tasks.filter((t) => t.applicationId === app.id), [tasks, app.id]);
  const resume = documents.find((d) => d.id === app.resumeId);
  const referrer = contacts.find((c) => c.id === app.referrerId);
  const rd = responseDays(app);
  const daysIn = app.appliedAt ? daysBetween(app.appliedAt) : null;

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'activity' as const, label: 'Activity', count: app.history.length + myTouches.length },
    { id: 'interviews' as const, label: 'Interviews', count: myInterviews.length },
    { id: 'people' as const, label: 'People', count: linked.length },
    { id: 'jd' as const, label: 'JD match' },
    { id: 'notes' as const, label: 'Notes' },
  ];

  const remove = async () => {
    const ok = await confirmDialog({ title: `Delete ${app.role} at ${app.company}?`, description: 'This removes the application and its interviews.', confirmLabel: 'Delete', danger: true, undoable: true });
    if (!ok) return;
    ui.closeDrawer();
    const restore = await deleteApplications([app.id]);
    undoToast('Application deleted', restore);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="border-b bg-card px-5 pb-3 pt-4">
        <div className="flex items-start gap-3">
          <CompanyLogo name={app.company} size={48} rounded="rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="truncate text-lg font-semibold tracking-tight">{app.role}</h2>
              <PriorityFlag priority={app.priority} />
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
              <button
                className="font-medium text-foreground/90 hover:underline"
                onClick={() => {
                  const c = companyMap.get(companyKey(app.company));
                  if (c) ui.openDrawer('company', c.id);
                  else navigate('/companies');
                }}
              >
                {app.company}
              </button>
              {app.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {app.location}
                  {app.workMode ? ` · ${WORK_MODE_LABEL[app.workMode]}` : ''}
                </span>
              )}
              <PlatformTag platform={app.platform} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            {app.url && (
              <Tip content="Open job posting">
                <Button size="icon-sm" variant="ghost" onClick={() => window.open(app.url, '_blank', 'noopener')}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Tip>
            )}
            <Tip content="Edit">
              <Button size="icon-sm" variant="ghost" onClick={() => ui.openAppForm(app.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </Tip>
            <Menu>
              <MenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="More">
                  <Ellipsis className="h-4 w-4" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Copy />} onSelect={() => copyText(applicationSummary(app)).then(() => toast.success('Summary copied'))}>
                  Copy summary
                </MenuItem>
                <MenuItem
                  icon={<CopyPlus />}
                  onSelect={async () => {
                    const d = await duplicateApplication(app.id);
                    if (d) {
                      toast.success('Duplicated to Wishlist');
                      ui.openDrawer('application', d.id);
                    }
                  }}
                >
                  Duplicate
                </MenuItem>
                <MenuItem icon={<Archive />} onSelect={() => updateApplication(app.id, { archived: !app.archived }).then(() => toast.success(app.archived ? 'Unarchived' : 'Archived'))}>
                  {app.archived ? 'Unarchive' : 'Archive'}
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger onSelect={remove}>
                  Delete
                </MenuItem>
              </MenuContent>
            </Menu>
            <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={() => ui.closeDrawer()}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <StageStepper app={app} />
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Select
            value={app.status}
            onChange={(e) => moveWithFeedback(app.id, e.target.value as Stage, navigate)}
            wrapperClassName="w-auto"
            className="h-8 w-44 text-[13px]"
            aria-label="Status"
          >
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => ui.openInterviewForm(app.id)}>
            <CalendarPlus className="h-3.5 w-3.5" /> Interview
          </Button>
          <Button size="sm" variant="secondary" onClick={() => ui.openComposer({ applicationId: app.id, contactId: referrer?.id ?? linked[0]?.id, templateId: app.status === 'applied' ? 'tpl-fu-application' : undefined })}>
            <Send className="h-3.5 w-3.5" /> Message
          </Button>
          <Button size="sm" variant="secondary" onClick={() => ui.openTaskForm(undefined, { applicationId: app.id })}>
            <ListTodo className="h-3.5 w-3.5" /> Task
          </Button>
        </div>
      </div>

      <div className="bg-card px-5">
        <Tabs tabs={tabs} value={tab} onChange={setTab} size="sm" />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {tab === 'overview' && (
          <div className="space-y-5">
            <NextActionCard app={app} />
            {app.status === 'rejected' && (
              <div className="rounded-xl border bg-card p-4">
                <div className="mb-2 text-[13px] font-semibold">Why didn’t it work out?</div>
                <div className="flex flex-wrap gap-1.5">
                  {REJECTION_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => updateApplication(app.id, { rejectionReason: r })}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                        app.rejectionReason === r ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'hover:bg-accent',
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground">Tagging reasons lets Analytics show you where you lose — and what to fix.</p>
              </div>
            )}
            <div className="grid gap-x-6 sm:grid-cols-2">
              <div>
                <InfoRow label="Status" icon={<CircleDot />}>
                  <StageBadge stage={app.status} />
                </InfoRow>
                <InfoRow label="Applied" icon={<CalendarDays />}>
                  {app.appliedAt ? (
                    <>
                      {fmtDate(app.appliedAt)} <span className="text-muted-foreground">· {daysIn}d ago</span>
                    </>
                  ) : (
                    'Not yet'
                  )}
                </InfoRow>
                <InfoRow label="First response" icon={<Clock />}>
                  {app.respondedAt ? `${fmtDate(app.respondedAt)} · ${rd}d to respond` : app.status === 'applied' ? `Waiting ${daysIn ?? 0}d` : '—'}
                </InfoRow>
                <InfoRow label="Method" icon={<Briefcase />}>
                  {METHOD_MAP[app.method]?.label}
                </InfoRow>
                <InfoRow label="Referrer" icon={<Users />}>
                  {referrer ? (
                    <button className="inline-flex items-center gap-1.5 hover:underline" onClick={() => ui.openDrawer('contact', referrer.id)}>
                      <Avatar name={referrer.name} size={18} /> {referrer.name}
                    </button>
                  ) : undefined}
                </InfoRow>
              </div>
              <div>
                <InfoRow label="Salary" icon={<Wallet />}>
                  {app.salaryMin || app.salaryMax ? formatSalaryRange(app.salaryMin, app.salaryMax, app.currency ?? settings.currency) : undefined}
                </InfoRow>
                <InfoRow label="Job type" icon={<Briefcase />}>
                  {app.jobType ? JOB_TYPE_LABEL[app.jobType] : undefined}
                </InfoRow>
                <InfoRow label="Resume" icon={<FileText />}>
                  {resume?.name}
                </InfoRow>
                <InfoRow label="Deadline" icon={<Flag />}>
                  {app.deadline ? `${fmtDate(app.deadline)} · ${relDay(app.deadline)}` : undefined}
                </InfoRow>
                <InfoRow label="Excitement" icon={<Star />}>
                  <StarRating value={app.excitement ?? 0} onChange={(v) => updateApplication(app.id, { excitement: v })} size={15} />
                </InfoRow>
              </div>
            </div>
            {app.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {app.tags.map((t) => (
                  <Badge key={t} tone="primary">
                    #{t}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <LinkChip href={app.url} icon={<Link2 />}>
                Job posting
              </LinkChip>
              {companyResearch(app.company)
                .slice(0, 4)
                .map((l) => (
                  <LinkChip key={l.id} href={l.url} icon={<ArrowUpRight />}>
                    {l.label}
                  </LinkChip>
                ))}
            </div>
            {app.notes && (
              <div className="rounded-xl border bg-card p-3.5">
                <div className="label-caps mb-1.5">Notes</div>
                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{app.notes}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'activity' && <ActivityTab app={app} />}

        {tab === 'interviews' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-muted-foreground">{myInterviews.length ? 'Every round, its prep checklist and how it went.' : ''}</p>
              <Button size="sm" variant="primary" onClick={() => ui.openInterviewForm(app.id)}>
                <CalendarPlus className="h-3.5 w-3.5" /> Schedule round
              </Button>
            </div>
            {myInterviews.length ? (
              myInterviews.map((iv) => <InterviewCard key={iv.id} iv={iv} app={app} defaultOpen={myInterviews.length === 1} />)
            ) : (
              <EmptyState compact icon={<CalendarPlus className="h-5 w-5" />} title="No interviews yet" description="When you get a call, add it here — Pursuit builds a prep checklist and reminds you to send a thank-you." />
            )}
          </div>
        )}

        {tab === 'people' && (
          <div className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="label-caps">Linked to this application</span>
                <Button size="xs" variant="secondary" onClick={() => ui.openContactForm(undefined, { company: app.company, applicationIds: [app.id] })}>
                  <UserPlus className="h-3.5 w-3.5" /> Add person
                </Button>
              </div>
              {linked.length ? (
                <div className="divide-y rounded-xl border bg-card">
                  {linked.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar name={c.name} size={32} />
                      <button className="min-w-0 flex-1 text-left" onClick={() => ui.openDrawer('contact', c.id)}>
                        <div className="truncate text-[13.5px] font-medium">
                          {c.name} {app.referrerId === c.id && <Badge tone="green">Referrer</Badge>}
                        </div>
                        <div className="truncate text-[12px] text-muted-foreground">{c.title}</div>
                      </button>
                      <ContactStageBadge stage={c.stage} />
                      <Tip content="Compose message">
                        <Button size="icon-xs" variant="ghost" onClick={() => ui.openComposer({ contactId: c.id, applicationId: app.id })}>
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </Tip>
                      <Tip content="Unlink">
                        <Button size="icon-xs" variant="ghost" onClick={() => unlinkContactFromApplication(c.id, app.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </Tip>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed p-4 text-center text-[13px] text-muted-foreground">No one linked yet. Applications with a person attached get far more responses.</p>
              )}
            </div>
            {atCompany.length > 0 && (
              <div>
                <div className="label-caps mb-2">People you know at {app.company}</div>
                <div className="divide-y rounded-xl border bg-card">
                  {atCompany.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                      <Avatar name={c.name} size={30} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-medium">{c.name}</div>
                        <div className="truncate text-[12px] text-muted-foreground">{c.title}</div>
                      </div>
                      <Button size="xs" variant="secondary" onClick={() => linkContactToApplication(c.id, app.id)}>
                        Link
                      </Button>
                      <Button size="xs" variant="primary" onClick={() => ui.openComposer({ contactId: c.id, applicationId: app.id, templateId: 'tpl-dm-referral' })}>
                        Ask referral
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <FindPeople app={app} />
          </div>
        )}

        {tab === 'jd' && <JDTab app={app} />}

        {tab === 'notes' && <NotesTab app={app} />}
      </div>
    </div>
  );
}

function NextActionCard({ app }: { app: Application }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(app.nextAction ?? '');
  const [due, setDue] = useState<string | undefined>(app.nextActionAt);
  useEffect(() => {
    setText(app.nextAction ?? '');
    setDue(app.nextActionAt);
  }, [app.nextAction, app.nextActionAt]);
  const closed = CLOSED_STAGES.includes(app.status);
  if (closed && !app.nextActionAt) return null;
  const overdue = app.nextActionAt && toDate(app.nextActionAt)! < new Date() && relDay(app.nextActionAt) !== 'today';
  return (
    <div className={cn('rounded-xl border p-4', overdue ? 'border-rose-500/30 bg-rose-500/5' : 'bg-gradient-to-br from-primary/[0.06] to-transparent')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label-caps">Next step</div>
          {!editing ? (
            <div className="mt-1 text-[14px] font-medium">
              {app.nextAction || <span className="text-muted-foreground">No next step — add one so nothing slips.</span>}
              {app.nextActionAt && <span className={cn('ml-2 text-[12.5px] font-normal', overdue ? 'text-rose-600' : 'text-muted-foreground')}>due {relDay(app.nextActionAt)}</span>}
            </div>
          ) : (
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_200px]">
              <Input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Follow up with the recruiter" />
              <DateInput value={due} onChange={setDue} />
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {!editing ? (
            <>
              {app.nextActionAt && (
                <>
                  <Tip content="Done">
                    <Button size="icon-sm" variant="secondary" onClick={() => completeAppAction(app.id).then(() => toast.success('Nice — done!'))}>
                      <Check className="h-4 w-4" />
                    </Button>
                  </Tip>
                  <Menu>
                    <MenuTrigger asChild>
                      <Button size="sm" variant="secondary">
                        <Clock className="h-3.5 w-3.5" /> Snooze
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      {[1, 3, 7].map((d) => (
                        <MenuItem key={d} onSelect={() => snoozeItem('app', app.id, d).then(() => toast.success(`Snoozed ${d} day${d > 1 ? 's' : ''}`))}>
                          {d === 1 ? 'Tomorrow' : `${d} days`}
                        </MenuItem>
                      ))}
                    </MenuContent>
                  </Menu>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={async () => {
                  await updateApplication(app.id, { nextAction: text || undefined, nextActionAt: due });
                  setEditing(false);
                }}
              >
                Save
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityTab({ app }: { app: Application }) {
  const { interactions, interviews, contacts, tasks } = useData();
  const [note, setNote] = useState('');
  const items = useMemo(() => {
    const cMap = new Map(contacts.map((c) => [c.id, c]));
    const rows: { at: string; icon: React.ReactNode; title: React.ReactNode; body?: string; tone?: string }[] = [];
    for (const h of app.history) rows.push({ at: h.at, icon: <span className={cn('h-2.5 w-2.5 rounded-full', STAGE_MAP[h.stage].dot)} />, title: <>Moved to <b>{STAGE_MAP[h.stage].label}</b></>, body: h.note });
    for (const i of interactions.filter((x) => x.applicationId === app.id)) {
      const c = i.contactId ? cMap.get(i.contactId) : undefined;
      rows.push({
        at: i.date,
        icon: i.kind === 'note' ? <NotebookPen className="h-3.5 w-3.5" /> : <ChannelIcon channel={i.channel} />,
        title:
          i.kind === 'note' ? (
            'Note'
          ) : (
            <>
              {i.direction === 'in' ? 'Reply from' : KIND_LABEL[i.kind]} {c && <b>{i.direction === 'in' ? c.name : `→ ${c.name}`}</b>}
            </>
          ),
        body: i.content,
      });
    }
    for (const iv of interviews.filter((x) => x.applicationId === app.id)) rows.push({ at: iv.scheduledAt, icon: <CalendarDays className="h-3.5 w-3.5" />, title: <>Interview: <b>{iv.round}</b> ({iv.outcome})</> });
    for (const t of tasks.filter((x) => x.applicationId === app.id && x.done && x.doneAt)) rows.push({ at: t.doneAt!, icon: <Check className="h-3.5 w-3.5" />, title: <>Done: {t.title}</> });
    rows.push({ at: app.createdAt, icon: <Sparkles className="h-3.5 w-3.5" />, title: 'Added to Pursuit' });
    return rows.sort((a, b) => b.at.localeCompare(a.at));
  }, [app, interactions, interviews, contacts, tasks]);

  const addNote = async () => {
    if (!note.trim()) return;
    await logInteraction({ applicationId: app.id, kind: 'note', channel: 'other', content: note.trim() });
    setNote('');
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addNote()} placeholder="Add an update or note…  (Enter to save)" />
        <Button variant="secondary" onClick={addNote}>
          <NotebookPen className="h-4 w-4" /> Add
        </Button>
      </div>
      <ol className="relative space-y-4 border-l pl-5">
        {items.map((r, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[29px] top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full border bg-card text-muted-foreground">{r.icon}</span>
            <div className="text-[13.5px]">{r.title}</div>
            {r.body && <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-muted-foreground">{r.body}</p>}
            <div className="mt-0.5 text-[11.5px] text-muted-foreground/80">{fmtDateTime(r.at)}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FindPeople({ app }: { app: Application }) {
  const settings = useSettings();
  const personas: { id: Persona; label: string }[] = [
    { id: 'recruiter', label: 'Recruiters' },
    { id: 'hiring_manager', label: 'Hiring managers' },
    { id: 'peer', label: 'Peers to refer you' },
  ];
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-[13.5px] font-semibold">
        <Search className="h-4 w-4 text-primary" /> Find people at {app.company}
      </div>
      <p className="mt-1 text-[12.5px] text-muted-foreground">Ready-made LinkedIn & Google searches. Add who you find as targets, then start a sequence.</p>
      <div className="mt-3 space-y-2">
        {personas.map((p) => {
          const links = peopleSearch({ persona: p.id, company: app.company, role: app.role, location: app.location?.split(',')[0], school: settings.profile.school });
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-2">
              <span className="w-32 shrink-0 text-[12.5px] font-medium">{p.label}</span>
              {links.slice(0, 3).map((l) => (
                <LinkChip key={l.id} href={l.url} icon={<ArrowUpRight />}>
                  {l.label.replace('LinkedIn ', '').replace('Google X-ray of LinkedIn', 'Google X-ray')}
                </LinkChip>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JDTab({ app }: { app: Application }) {
  const [jd, setJd] = useState(app.jobDescription ?? '');
  const [editing, setEditing] = useState(!app.jobDescription);
  return (
    <div className="space-y-4">
      {editing ? (
        <div className="space-y-2">
          <Textarea autoFocus value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description here…" maxRows={16} className="min-h-[180px]" />
          <div className="flex justify-end gap-2">
            {app.jobDescription && (
              <Button variant="ghost" size="sm" onClick={() => { setJd(app.jobDescription ?? ''); setEditing(false); }}>
                Cancel
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              onClick={async () => {
                await updateApplication(app.id, { jobDescription: jd });
                setEditing(false);
              }}
            >
              Save & analyze
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted-foreground">{jd.split(/\s+/).filter(Boolean).length} words</span>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit JD
          </Button>
        </div>
      )}
      {!editing && <JDMatchPanel jd={jd} />}
      {!editing && (
        <details className="rounded-xl border bg-card p-3.5">
          <summary className="cursor-pointer text-[13px] font-medium">Show full job description</summary>
          <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{jd}</p>
        </details>
      )}
      {!jd && !editing && <EmptyState compact icon={<FileText className="h-5 w-5" />} title="No job description" description="Paste the JD to see how well your profile matches it." />}
    </div>
  );
}

function NotesTab({ app }: { app: Application }) {
  const [notes, setNotes] = useState(app.notes ?? '');
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    if (notes === (app.notes ?? '')) return;
    setSaved(false);
    const t = setTimeout(async () => {
      await updateApplication(app.id, { notes });
      setSaved(true);
    }, 600);
    return () => clearTimeout(t);
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="label-caps">Notes</span>
          <span className="text-[11.5px] text-muted-foreground">{saved ? 'Saved' : 'Saving…'}</span>
        </div>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Team, people you spoke to, process, compensation details, red flags…" className="min-h-[220px]" maxRows={30} />
      </div>
      <div>
        <div className="label-caps mb-1.5">Tags</div>
        <TagInput value={app.tags} onChange={(tags) => updateApplication(app.id, { tags })} suggestions={['dream', 'remote', 'fintech', 'startup', 'urgent', 'relocation']} />
      </div>
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <History className="h-3.5 w-3.5" /> Created {fmtDateTime(app.createdAt)} · Updated {relDay(app.updatedAt)}
      </div>
    </div>
  );
}
