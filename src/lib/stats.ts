import { addDays, differenceInCalendarDays, format, startOfDay, startOfWeek, subWeeks } from 'date-fns';
import { CLOSED_STAGES, INTERVIEW_TYPE_LABEL, STAGE_MAP, STAGE_RANK } from './constants';
import type {
  Application,
  Channel,
  Contact,
  Enrollment,
  ID,
  Interaction,
  Interview,
  Sequence,
  Settings,
  Stage,
  Task,
  Template,
} from './types';
import { dayKey, firstName, fmtTime, median, pct, relDay, toDate } from './utils';

/* ───────────────────────── Application helpers ───────────────────────── */

export function furthestRank(a: Application): number {
  let r = STAGE_RANK[a.status];
  for (const h of a.history ?? []) r = Math.max(r, STAGE_RANK[h.stage]);
  if (r < 1 && a.status !== 'wishlist') r = 1;
  return r;
}

export const isApplied = (a: Application) => a.status !== 'wishlist';
export const hasResponse = (a: Application) => !!a.respondedAt || furthestRank(a) >= 2 || a.status === 'rejected';
export const isPositive = (a: Application) => furthestRank(a) >= 2;
export const reachedInterview = (a: Application) => furthestRank(a) >= 4;
export const reachedOffer = (a: Application) => furthestRank(a) >= 5;
export const isClosed = (a: Application) => CLOSED_STAGES.includes(a.status);
export const isActive = (a: Application) => !isClosed(a) && !a.archived;

export function responseDays(a: Application): number | null {
  const ap = toDate(a.appliedAt);
  const rs = toDate(a.respondedAt);
  if (!ap || !rs) return null;
  return Math.max(0, differenceInCalendarDays(rs, ap));
}

export function daysSinceApplied(a: Application, now = new Date()): number | null {
  const ap = toDate(a.appliedAt);
  return ap ? differenceInCalendarDays(now, ap) : null;
}

/** Stage it was in when it was closed (rejected / ghosted / withdrawn). */
export function closedFrom(a: Application): Stage {
  if (a.closedFromStage) return a.closedFromStage;
  const hist = [...(a.history ?? [])].reverse().find((h) => STAGE_RANK[h.stage] >= 1);
  return hist?.stage ?? 'applied';
}

/* ───────────────────────── Funnel & breakdowns ───────────────────────── */

export interface FunnelStep {
  id: string;
  label: string;
  count: number;
  ofTop: number | null;
  fromPrev: number | null;
}

export function funnel(apps: Application[]): FunnelStep[] {
  const applied = apps.filter(isApplied);
  const steps: [string, string, number][] = [
    ['applied', 'Applied', applied.length],
    ['responded', 'Got a response', applied.filter(hasResponse).length],
    ['positive', 'Screening+', applied.filter(isPositive).length],
    ['interview', 'Interviews', applied.filter(reachedInterview).length],
    ['offer', 'Offers', applied.filter(reachedOffer).length],
  ];
  return steps.map(([id, label, count], i) => ({
    id,
    label,
    count,
    ofTop: pct(count, steps[0][2]),
    fromPrev: i === 0 ? null : pct(count, steps[i - 1][2]),
  }));
}

export interface Breakdown {
  key: string;
  label: string;
  total: number;
  responded: number;
  positive: number;
  interviews: number;
  offers: number;
  responseRate: number | null;
  positiveRate: number | null;
  interviewRate: number | null;
  offerRate: number | null;
  medianResponseDays: number | null;
}

export function breakdownBy(apps: Application[], keyFn: (a: Application) => string | undefined, labelFn: (k: string) => string): Breakdown[] {
  const groups = new Map<string, Application[]>();
  for (const a of apps.filter(isApplied)) {
    const k = keyFn(a) || 'unknown';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const responded = list.filter(hasResponse).length;
      const positive = list.filter(isPositive).length;
      const interviews = list.filter(reachedInterview).length;
      const offers = list.filter(reachedOffer).length;
      const rds = list.map(responseDays).filter((x): x is number => x !== null);
      return {
        key,
        label: labelFn(key),
        total: list.length,
        responded,
        positive,
        interviews,
        offers,
        responseRate: pct(responded, list.length),
        positiveRate: pct(positive, list.length),
        interviewRate: pct(interviews, list.length),
        offerRate: pct(offers, list.length),
        medianResponseDays: median(rds),
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function rejectionBreakdown(apps: Application[]): { stage: Stage; label: string; count: number }[] {
  const counts = new Map<Stage, number>();
  for (const a of apps.filter((x) => x.status === 'rejected')) {
    const s = closedFrom(a);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const order: Stage[] = ['applied', 'screening', 'assessment', 'interviewing', 'offer'];
  const labels: Record<string, string> = {
    applied: 'Resume screen',
    screening: 'After recruiter screen',
    assessment: 'After assessment',
    interviewing: 'After interviews',
    offer: 'At offer stage',
  };
  return order.map((stage) => ({ stage, label: labels[stage], count: counts.get(stage) ?? 0 })).filter((r) => r.count > 0);
}

export function responseTimeBuckets(apps: Application[]): { label: string; count: number }[] {
  const days = apps.map(responseDays).filter((x): x is number => x !== null);
  const buckets: [string, (d: number) => boolean][] = [
    ['0–3 days', (d) => d <= 3],
    ['4–7 days', (d) => d >= 4 && d <= 7],
    ['8–14 days', (d) => d >= 8 && d <= 14],
    ['15–30 days', (d) => d >= 15 && d <= 30],
    ['30+ days', (d) => d > 30],
  ];
  return buckets.map(([label, f]) => ({ label, count: days.filter(f).length }));
}

export function weekdayPerformance(apps: Application[]): { day: string; total: number; positiveRate: number | null }[] {
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const rows = names.map((day) => ({ day, total: 0, positive: 0 }));
  for (const a of apps.filter(isApplied)) {
    const d = toDate(a.appliedAt);
    if (!d) continue;
    const idx = (d.getDay() + 6) % 7;
    rows[idx].total++;
    if (isPositive(a)) rows[idx].positive++;
  }
  return rows.map((r) => ({ day: r.day, total: r.total, positiveRate: pct(r.positive, r.total) }));
}

/* ───────────────────────── Outreach ───────────────────────── */

export const isOutreach = (i: Interaction) => i.direction === 'out' && i.kind !== 'note' && i.kind !== 'comment';
/** A response to outreach: a reply of any sentiment, or an accepted connection request. */
export const gotReply = (i: Interaction) => i.outcome === 'replied' || i.outcome === 'positive' || i.outcome === 'negative' || i.outcome === 'accepted';

export interface RateRow {
  key: string;
  label: string;
  sent: number;
  replied: number;
  rate: number | null;
}

function rateRows(items: Interaction[], keyFn: (i: Interaction) => string | undefined, labelFn: (k: string) => string): RateRow[] {
  const m = new Map<string, { sent: number; replied: number }>();
  for (const i of items) {
    const k = keyFn(i);
    if (!k) continue;
    const row = m.get(k) ?? { sent: 0, replied: 0 };
    row.sent++;
    if (gotReply(i)) row.replied++;
    m.set(k, row);
  }
  return [...m.entries()]
    .map(([key, v]) => ({ key, label: labelFn(key), sent: v.sent, replied: v.replied, rate: pct(v.replied, v.sent) }))
    .sort((a, b) => b.sent - a.sent);
}

export function outreachStats(interactions: Interaction[], contacts: Contact[], templates: Template[]) {
  const out = interactions.filter(isOutreach);
  const replied = out.filter(gotReply);
  const tMap = new Map(templates.map((t) => [t.id, t]));
  const cMap = new Map(contacts.map((c) => [c.id, c]));
  const contacted = contacts.filter((c) => c.stage !== 'target' && c.stage !== 'network' && out.some((i) => i.contactId === c.id));
  const contactsReplied = contacted.filter((c) => interactions.some((i) => i.contactId === c.id && i.direction === 'in'));
  return {
    sent: out.length,
    replied: replied.length,
    replyRate: pct(replied.length, out.length),
    positive: out.filter((i) => i.outcome === 'positive').length,
    contactsReached: contacted.length,
    contactReplyRate: pct(contactsReplied.length, contacted.length),
    referrals: contacts.filter((c) => c.stage === 'referred').length,
    byTemplate: rateRows(out, (i) => i.templateId, (k) => tMap.get(k)?.name ?? 'Deleted template'),
    byChannel: rateRows(out, (i) => i.channel, (k) => k),
    byKind: rateRows(out, (i) => i.kind, (k) => k),
    byRelationship: rateRows(out, (i) => (i.contactId ? cMap.get(i.contactId)?.relationship : undefined), (k) => k),
  };
}

export function templateStats(interactions: Interaction[]): Map<ID, { sent: number; replied: number; rate: number | null }> {
  const m = new Map<ID, { sent: number; replied: number; rate: number | null }>();
  for (const i of interactions) {
    if (!i.templateId || !isOutreach(i)) continue;
    const r = m.get(i.templateId) ?? { sent: 0, replied: 0, rate: null };
    r.sent++;
    if (gotReply(i)) r.replied++;
    r.rate = pct(r.replied, r.sent);
    m.set(i.templateId, r);
  }
  return m;
}

/* ───────────────────────── Time series & activity ───────────────────────── */

export interface WeekRow {
  key: string;
  label: string;
  start: Date;
  applications: number;
  outreach: number;
  responses: number;
  interviews: number;
}

export function weeklySeries(
  apps: Application[],
  interactions: Interaction[],
  interviews: Interview[],
  weeks = 12,
  weekStartsOn: 0 | 1 = 1,
  now = new Date(),
): WeekRow[] {
  const first = startOfWeek(subWeeks(now, weeks - 1), { weekStartsOn });
  const rows: WeekRow[] = Array.from({ length: weeks }, (_, i) => {
    const start = addDays(first, i * 7);
    return { key: dayKey(start), label: format(start, 'd MMM'), start, applications: 0, outreach: 0, responses: 0, interviews: 0 };
  });
  const idx = (iso: string | undefined) => {
    const d = toDate(iso);
    if (!d) return -1;
    const i = Math.floor(differenceInCalendarDays(d, first) / 7);
    return i >= 0 && i < weeks ? i : -1;
  };
  for (const a of apps) {
    const i = idx(a.appliedAt);
    if (i >= 0 && isApplied(a)) rows[i].applications++;
    const r = idx(a.respondedAt);
    if (r >= 0) rows[r].responses++;
  }
  for (const it of interactions) {
    if (!isOutreach(it)) continue;
    const i = idx(it.date);
    if (i >= 0) rows[i].outreach++;
  }
  for (const iv of interviews) {
    const i = idx(iv.scheduledAt);
    if (i >= 0 && iv.outcome !== 'cancelled') rows[i].interviews++;
  }
  return rows;
}

export interface DayActivity {
  applications: number;
  outreach: number;
  interviews: number;
  tasks: number;
  total: number;
}

export function activityByDay(apps: Application[], interactions: Interaction[], interviews: Interview[], tasks: Task[]): Map<string, DayActivity> {
  const m = new Map<string, DayActivity>();
  const bump = (iso: string | undefined, field: keyof Omit<DayActivity, 'total'>) => {
    const d = toDate(iso);
    if (!d) return;
    const k = dayKey(d);
    const row = m.get(k) ?? { applications: 0, outreach: 0, interviews: 0, tasks: 0, total: 0 };
    row[field]++;
    row.total++;
    m.set(k, row);
  };
  for (const a of apps) if (isApplied(a)) bump(a.appliedAt, 'applications');
  for (const i of interactions) if (i.direction === 'out' && i.kind !== 'note') bump(i.date, 'outreach');
  for (const iv of interviews) if (iv.outcome !== 'cancelled' && toDate(iv.scheduledAt)! <= new Date()) bump(iv.scheduledAt, 'interviews');
  for (const t of tasks) if (t.done) bump(t.doneAt, 'tasks');
  return m;
}

export function streak(activity: Map<string, DayActivity>, now = new Date()): { current: number; best: number; todayDone: boolean } {
  const todayDone = (activity.get(dayKey(now))?.total ?? 0) > 0;
  let current = 0;
  let d = todayDone ? now : addDays(now, -1);
  while ((activity.get(dayKey(d))?.total ?? 0) > 0) {
    current++;
    d = addDays(d, -1);
  }
  const keys = [...activity.keys()].filter((k) => (activity.get(k)?.total ?? 0) > 0).sort();
  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const k of keys) {
    const cur = new Date(`${k}T12:00:00`);
    run = prev && differenceInCalendarDays(cur, prev) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return { current, best: Math.max(best, current), todayDone };
}

/* ───────────────────────── Period KPIs ───────────────────────── */

export interface PeriodKPIs {
  applied: number;
  responses: number;
  responseRate: number | null;
  positives: number;
  positiveRate: number | null;
  interviews: number;
  offers: number;
  outreach: number;
  replies: number;
  replyRate: number | null;
}

export function periodKPIs(apps: Application[], interactions: Interaction[], interviews: Interview[], from: Date, to: Date): PeriodKPIs {
  const inRange = (iso?: string) => {
    const d = toDate(iso);
    return !!d && d >= from && d <= to;
  };
  const cohort = apps.filter((a) => isApplied(a) && inRange(a.appliedAt));
  const responses = cohort.filter(hasResponse).length;
  const positives = cohort.filter(isPositive).length;
  const out = interactions.filter((i) => isOutreach(i) && inRange(i.date));
  const replies = out.filter(gotReply).length;
  return {
    applied: cohort.length,
    responses,
    responseRate: pct(responses, cohort.length),
    positives,
    positiveRate: pct(positives, cohort.length),
    interviews: interviews.filter((iv) => iv.outcome !== 'cancelled' && inRange(iv.scheduledAt)).length,
    offers: apps.filter((a) => a.history?.some((h) => h.stage === 'offer' && inRange(h.at))).length,
    outreach: out.length,
    replies,
    replyRate: pct(replies, out.length),
  };
}

export function weekProgress(apps: Application[], interactions: Interaction[], settings: Settings, now = new Date()) {
  const weekStart = startOfWeek(now, { weekStartsOn: settings.weekStartsOn });
  const todayStart = startOfDay(now);
  const appsThisWeek = apps.filter((a) => isApplied(a) && (toDate(a.appliedAt) ?? new Date(0)) >= weekStart).length;
  const out = interactions.filter(isOutreach);
  const outreachThisWeek = out.filter((i) => (toDate(i.date) ?? new Date(0)) >= weekStart).length;
  const outreachToday = out.filter((i) => (toDate(i.date) ?? new Date(0)) >= todayStart).length;
  const appsToday = apps.filter((a) => isApplied(a) && (toDate(a.appliedAt) ?? new Date(0)) >= todayStart).length;
  const daysLeft = 7 - differenceInCalendarDays(now, weekStart);
  return { weekStart, appsThisWeek, outreachThisWeek, outreachToday, appsToday, daysLeft };
}

/* ───────────────────────── Agenda ───────────────────────── */

export type AgendaKind = 'sequence' | 'contact' | 'app' | 'task' | 'interview' | 'thankyou' | 'deadline';
export type AgendaBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'someday';

export interface AgendaItem {
  key: string;
  kind: AgendaKind;
  title: string;
  subtitle: string;
  meta?: string;
  due?: string;
  bucket: AgendaBucket;
  appId?: ID;
  contactId?: ID;
  enrollmentId?: ID;
  taskId?: ID;
  interviewId?: ID;
  templateId?: ID;
  channel?: Channel;
  priority: number;
}

export function bucketOf(due: string | undefined, now = new Date()): AgendaBucket {
  const d = toDate(due);
  if (!d) return 'someday';
  const diff = differenceInCalendarDays(d, now);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'week';
  return 'later';
}

export const BUCKET_LABEL: Record<AgendaBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'Next 7 days',
  later: 'Later',
  someday: 'No date',
};

export function buildAgenda(
  data: {
    apps: Application[];
    contacts: Contact[];
    enrollments: Enrollment[];
    sequences: Sequence[];
    tasks: Task[];
    interviews: Interview[];
  },
  now = new Date(),
): AgendaItem[] {
  const items: AgendaItem[] = [];
  const seqMap = new Map(data.sequences.map((s) => [s.id, s]));
  const cMap = new Map(data.contacts.map((c) => [c.id, c]));
  const aMap = new Map(data.apps.map((a) => [a.id, a]));
  const activeEnrolledContacts = new Set<ID>();

  for (const e of data.enrollments) {
    if (e.status !== 'active') continue;
    activeEnrolledContacts.add(e.contactId);
    const seq = seqMap.get(e.sequenceId);
    const step = seq?.steps[e.stepIndex];
    const c = cMap.get(e.contactId);
    if (!seq || !step || !c) continue;
    items.push({
      key: `seq-${e.id}`,
      kind: 'sequence',
      title: step.title,
      subtitle: `${c.name}${c.company ? ` · ${c.company}` : ''}`,
      meta: `Step ${e.stepIndex + 1}/${seq.steps.length} · ${seq.name}`,
      due: e.nextDueAt,
      bucket: bucketOf(e.nextDueAt, now),
      contactId: c.id,
      appId: e.applicationId,
      enrollmentId: e.id,
      templateId: step.templateId,
      channel: step.channel,
      priority: c.priority,
    });
  }

  for (const c of data.contacts) {
    if (!c.nextFollowUpAt || activeEnrolledContacts.has(c.id) || c.stage === 'closed') continue;
    items.push({
      key: `contact-${c.id}`,
      kind: 'contact',
      title: `Follow up with ${firstName(c.name)}`,
      subtitle: `${c.name}${c.company ? ` · ${c.company}` : ''}`,
      meta: c.lastContactedAt ? `Last touch ${relDay(c.lastContactedAt)}` : undefined,
      due: c.nextFollowUpAt,
      bucket: bucketOf(c.nextFollowUpAt, now),
      contactId: c.id,
      templateId: 'tpl-fu-bump',
      priority: c.priority,
    });
  }

  for (const a of data.apps) {
    if (isClosed(a) || a.archived) continue;
    if (a.nextActionAt) {
      items.push({
        key: `app-${a.id}`,
        kind: 'app',
        title: a.nextAction || 'Next step',
        subtitle: `${a.role} · ${a.company}`,
        meta: a.appliedAt ? `Applied ${relDay(a.appliedAt)}` : STAGE_MAP[a.status].label,
        due: a.nextActionAt,
        bucket: bucketOf(a.nextActionAt, now),
        appId: a.id,
        priority: a.priority,
      });
    }
    if (a.status === 'wishlist' && a.deadline) {
      const diff = differenceInCalendarDays(toDate(a.deadline)!, now);
      if (diff >= -1 && diff <= 7) {
        items.push({
          key: `deadline-${a.id}`,
          kind: 'deadline',
          title: 'Apply before the deadline',
          subtitle: `${a.role} · ${a.company}`,
          due: a.deadline,
          bucket: bucketOf(a.deadline, now),
          appId: a.id,
          priority: 3,
        });
      }
    }
  }

  for (const t of data.tasks) {
    if (t.done) continue;
    const a = t.applicationId ? aMap.get(t.applicationId) : undefined;
    const c = t.contactId ? cMap.get(t.contactId) : undefined;
    items.push({
      key: `task-${t.id}`,
      kind: 'task',
      title: t.title,
      subtitle: a ? `${a.role} · ${a.company}` : c ? c.name : 'Task',
      due: t.dueAt,
      bucket: bucketOf(t.dueAt, now),
      taskId: t.id,
      appId: t.applicationId,
      contactId: t.contactId,
      priority: t.priority,
    });
  }

  for (const iv of data.interviews) {
    const a = aMap.get(iv.applicationId);
    const when = toDate(iv.scheduledAt);
    if (!a || !when) continue;
    const diff = differenceInCalendarDays(when, now);
    if (iv.outcome === 'scheduled' && when >= startOfDay(now) && diff <= 30) {
      items.push({
        key: `iv-${iv.id}`,
        kind: 'interview',
        title: `${iv.round} — ${a.company}`,
        subtitle: `${INTERVIEW_TYPE_LABEL[iv.type]} · ${fmtTime(iv.scheduledAt)}`,
        meta: a.role,
        due: iv.scheduledAt,
        bucket: bucketOf(iv.scheduledAt, now),
        appId: a.id,
        interviewId: iv.id,
        priority: 3,
      });
    }
    if (when < now && diff >= -3 && !iv.thankYouSent && iv.outcome !== 'cancelled' && iv.type !== 'take_home') {
      items.push({
        key: `ty-${iv.id}`,
        kind: 'thankyou',
        title: `Send a thank-you note to ${a.company}`,
        subtitle: `${iv.round}${iv.interviewers ? ` · ${iv.interviewers}` : ''}`,
        due: iv.scheduledAt,
        bucket: bucketOf(iv.scheduledAt, now) === 'overdue' ? 'overdue' : 'today',
        appId: a.id,
        interviewId: iv.id,
        templateId: 'tpl-ty-interview',
        priority: 3,
      });
    }
  }

  const order: Record<AgendaBucket, number> = { overdue: 0, today: 1, tomorrow: 2, week: 3, later: 4, someday: 5 };
  return items.sort(
    (a, b) => order[a.bucket] - order[b.bucket] || (a.due ?? '9').localeCompare(b.due ?? '9') || b.priority - a.priority,
  );
}
