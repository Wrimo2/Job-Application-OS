import { differenceInCalendarDays } from 'date-fns';
import { METHOD_MAP, platformMeta } from './constants';
import type { Application, Contact, DocumentFile, Enrollment, Interaction, Interview, Offer, Settings } from './types';
import {
  breakdownBy,
  closedFrom,
  daysSinceApplied,
  isApplied,
  isPositive,
  outreachStats,
  responseDays,
  weekProgress,
  type DayActivity,
  streak as calcStreak,
} from './stats';
import { companyKey, fmtDate, fmtPct, percentile, plural, relDay, toDate } from './utils';
import type { Template } from './types';

export type InsightTone = 'action' | 'warning' | 'tip' | 'win';
export type InsightIcon = 'clock' | 'ghost' | 'chart' | 'users' | 'target' | 'send' | 'brain' | 'calendar' | 'bookmark' | 'flame' | 'file' | 'gift' | 'check' | 'zap';

export interface Insight {
  id: string;
  tone: InsightTone;
  icon: InsightIcon;
  title: string;
  body: string;
  metric?: string;
  cta?: { label: string; to: string };
  priority: number;
}

interface Input {
  apps: Application[];
  contacts: Contact[];
  interactions: Interaction[];
  interviews: Interview[];
  enrollments: Enrollment[];
  templates: Template[];
  documents: DocumentFile[];
  offers: Offer[];
  activity: Map<string, DayActivity>;
  settings: Settings;
  now?: Date;
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : a > 0 ? Infinity : 1);
const fmtX = (r: number) => (Number.isFinite(r) ? `${r.toFixed(1).replace(/\.0$/, '')}×` : 'far');

export function generateInsights(input: Input): Insight[] {
  const { apps, contacts, interactions, interviews, enrollments, templates, documents, offers, activity, settings } = input;
  const now = input.now ?? new Date();
  const out: Insight[] = [];
  const applied = apps.filter(isApplied);

  /* Follow-ups & ghosting */
  const waiting = apps.filter((a) => a.status === 'applied' && !a.archived);
  const stale = waiting.filter((a) => {
    const d = daysSinceApplied(a, now);
    return d !== null && d >= settings.followUpDays && d < settings.ghostDays;
  });
  const ghosts = waiting.filter((a) => (daysSinceApplied(a, now) ?? 0) >= settings.ghostDays);
  if (stale.length) {
    out.push({
      id: 'stale',
      tone: 'action',
      icon: 'clock',
      title: `${plural(stale.length, 'application')} waiting ${settings.followUpDays}+ days`,
      body: 'No reply yet. A short, polite follow-up to the recruiter or hiring manager often revives an application — find them and send a 3-line note.',
      cta: { label: 'Review them', to: '/applications?quick=stale' },
      priority: 90,
    });
  }
  if (ghosts.length) {
    out.push({
      id: 'ghosts',
      tone: 'warning',
      icon: 'ghost',
      title: `${plural(ghosts.length, 'application')} likely ghosted`,
      body: `No response in ${settings.ghostDays}+ days. Send one last nudge or mark them as ghosted so your pipeline and stats stay honest.`,
      cta: { label: 'Clean up', to: '/applications?quick=ghost' },
      priority: 70,
    });
  }

  /* Pace vs weekly goals */
  const wk = weekProgress(apps, interactions, settings, now);
  const elapsed = Math.max(1, 7 - wk.daysLeft + 1);
  const appGoal = settings.goals.applicationsPerWeek;
  if (appGoal > 0) {
    if (wk.appsThisWeek >= appGoal) {
      out.push({ id: 'goal-apps-hit', tone: 'win', icon: 'check', title: 'Weekly application goal hit 🎉', body: `${wk.appsThisWeek}/${appGoal} applications this week. Quality over quantity now — spend extra time on outreach for your top picks.`, priority: 30 });
    } else {
      const expected = (appGoal * elapsed) / 7;
      const remaining = appGoal - wk.appsThisWeek;
      if (wk.appsThisWeek < expected * 0.7 && wk.daysLeft > 0) {
        out.push({
          id: 'goal-apps',
          tone: 'action',
          icon: 'target',
          title: `${wk.appsThisWeek}/${appGoal} applications this week`,
          body: `About ${Math.ceil(remaining / Math.max(1, wk.daysLeft))} a day for the next ${plural(wk.daysLeft, 'day')} gets you to your goal. Start with jobs posted in the last 24 hours.`,
          cta: { label: 'Find fresh jobs', to: '/outreach/toolkit' },
          priority: 60,
        });
      }
    }
  }
  const outGoal = settings.goals.outreachPerWeek;
  if (outGoal > 0 && wk.outreachThisWeek < (outGoal * elapsed) / 7 * 0.7 && wk.daysLeft > 0) {
    out.push({
      id: 'goal-outreach',
      tone: 'action',
      icon: 'send',
      title: `${wk.outreachThisWeek}/${outGoal} outreach messages this week`,
      body: `Outreach is what turns applications into conversations. ${Math.ceil((outGoal - wk.outreachThisWeek) / Math.max(1, wk.daysLeft))} messages a day keeps you on track.`,
      cta: { label: 'Open outreach queue', to: '/outreach' },
      priority: 58,
    });
  }

  /* Platform effectiveness */
  const byPlatform = breakdownBy(apps, (a) => a.platform, (k) => platformMeta(k).label).filter((b) => b.total >= 4);
  if (byPlatform.length >= 2) {
    const sorted = [...byPlatform].sort((a, b) => (b.positiveRate ?? 0) - (a.positiveRate ?? 0));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const r = ratio(best.positiveRate ?? 0, worst.positiveRate ?? 0);
    if ((best.positiveRate ?? 0) > 0 && r >= 1.8) {
      out.push({
        id: 'platform',
        tone: 'tip',
        icon: 'chart',
        title: `${best.label} works ${fmtX(r)} better than ${worst.label}`,
        body: `${fmtPct(best.positiveRate)} of your ${best.label} applications reach screening vs ${fmtPct(worst.positiveRate)} on ${worst.label}. Shift more of your time to what's working.`,
        metric: fmtPct(best.positiveRate),
        cta: { label: 'See analytics', to: '/analytics' },
        priority: 55,
      });
    }
  }

  /* Referral power */
  const isRef = (a: Application) => a.method === 'referral' || !!a.referrerId || a.platform === 'referral';
  const ref = applied.filter(isRef);
  const nonRef = applied.filter((a) => !isRef(a));
  if (ref.length >= 2 && nonRef.length >= 4) {
    const rr = (ref.filter(isPositive).length / ref.length) * 100;
    const nr = (nonRef.filter(isPositive).length / nonRef.length) * 100;
    if (rr > nr) {
      out.push({
        id: 'referrals',
        tone: 'tip',
        icon: 'users',
        title: `Referrals convert ${fmtX(ratio(rr, nr))} better for you`,
        body: `${fmtPct(rr)} of referred applications reach screening vs ${fmtPct(nr)} without one. Before applying cold, look for someone inside.`,
        metric: fmtPct(rr),
        cta: { label: 'Start a referral hunt', to: '/outreach/sequences' },
        priority: 57,
      });
    }
  }

  /* People you already know at companies you're applying to */
  // Only people who could plausibly refer you (not recruiters/HMs), and who aren't already linked to that application.
  const REFERRER_RELS = ['employee', 'engineer', 'alumni', 'friend', 'mentor', 'leader'];
  const byCompany = new Map<string, Contact[]>();
  for (const c of contacts) {
    if (!c.company || c.stage === 'closed' || c.stage === 'no_response' || !REFERRER_RELS.includes(c.relationship)) continue;
    const k = companyKey(c.company);
    byCompany.set(k, [...(byCompany.get(k) ?? []), c]);
  }
  const openNoRef = apps.filter(
    (a) =>
      (a.status === 'wishlist' || a.status === 'applied') &&
      !a.referrerId &&
      (byCompany.get(companyKey(a.company)) ?? []).some((c) => !a.contactIds.includes(c.id) && !c.applicationIds.includes(a.id)),
  );
  if (openNoRef.length) {
    const names = [...new Set(openNoRef.map((a) => a.company))];
    out.push({
      id: 'known-people',
      tone: 'action',
      icon: 'users',
      title: `You know people at ${names.slice(0, 2).join(' & ')}${names.length > 2 ? ` +${names.length - 2}` : ''}`,
      body: 'You have friends, peers or alumni at companies you’re applying to — but haven’t asked for a referral. A warm referral is usually your strongest way in.',
      cta: { label: 'See companies', to: '/companies' },
      priority: 80,
    });
  }

  /* Outreach performance */
  const os = outreachStats(interactions, contacts, templates);
  const awaitingOld = interactions.filter((i) => i.direction === 'out' && i.outcome === 'awaiting' && differenceInCalendarDays(now, toDate(i.date)!) > 14);
  if (os.sent >= 15 && (os.replyRate ?? 0) < 18) {
    const best = os.byTemplate.filter((t) => t.sent >= 4).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0];
    out.push({
      id: 'reply-rate',
      tone: 'tip',
      icon: 'zap',
      title: `Reply rate is ${fmtPct(os.replyRate)} — let's lift it`,
      body: best && (best.rate ?? 0) > (os.replyRate ?? 0)
        ? `Your best template, “${best.label}”, gets ${fmtPct(best.rate)}. Use it more, keep messages short, and lead with something specific about them.`
        : 'Shorter, more personal messages win. Mention a post, shared school or mutual, and end with one easy ask.',
      cta: { label: 'Open templates', to: '/outreach/templates' },
      priority: 50,
    });
  } else if (os.sent >= 15 && (os.replyRate ?? 0) >= 30) {
    out.push({ id: 'reply-win', tone: 'win', icon: 'zap', title: `${fmtPct(os.replyRate)} reply rate — excellent`, body: 'Your outreach is landing. Scale up volume on the templates and channels that work best.', priority: 25 });
  }
  if (awaitingOld.length >= 5) {
    out.push({
      id: 'hygiene',
      tone: 'tip',
      icon: 'check',
      title: `${awaitingOld.length} messages still “awaiting” after 2 weeks`,
      body: 'Did some of them reply? Mark replies (or no reply) so your reply-rate stats and template rankings stay accurate.',
      cta: { label: 'Review contacts', to: '/contacts?quick=awaiting' },
      priority: 20,
    });
  }

  /* Rejection pattern */
  const rejected = apps.filter((a) => a.status === 'rejected');
  if (rejected.length >= 4) {
    const atResume = rejected.filter((a) => closedFrom(a) === 'applied').length / rejected.length;
    const atInterview = rejected.filter((a) => ['interviewing', 'offer'].includes(closedFrom(a))).length / rejected.length;
    const atAssessment = rejected.filter((a) => closedFrom(a) === 'assessment').length / rejected.length;
    if (atResume >= 0.6) {
      out.push({ id: 'rej-resume', tone: 'tip', icon: 'file', title: `${fmtPct(atResume * 100)} of rejections happen at the resume screen`, body: 'That’s a targeting or resume problem, not an interview one. Tailor your resume to each JD — paste the JD into an application to see missing keywords.', cta: { label: 'Open applications', to: '/applications' }, priority: 52 });
    } else if (atInterview >= 0.4) {
      out.push({ id: 'rej-interview', tone: 'tip', icon: 'brain', title: 'You get interviews — the later rounds are the bottleneck', body: `${fmtPct(atInterview * 100)} of rejections come after interviews. Build STAR stories for common questions and practice with your question bank.`, cta: { label: 'Interview prep', to: '/interviews/stories' }, priority: 52 });
    } else if (atAssessment >= 0.35) {
      out.push({ id: 'rej-assessment', tone: 'tip', icon: 'brain', title: 'Assessments are your bottleneck', body: 'A big share of rejections follow tests or take-homes. Practice timed problems and clarify evaluation criteria before you start.', priority: 50 });
    }
  }

  /* Upcoming interview prep */
  for (const iv of interviews) {
    const when = toDate(iv.scheduledAt);
    if (!when || iv.outcome !== 'scheduled') continue;
    const diff = differenceInCalendarDays(when, now);
    if (diff < 0 || diff > 3 || when < now) continue;
    const done = iv.checklist.filter((c) => c.done).length;
    if (done / Math.max(1, iv.checklist.length) >= 0.8) continue;
    const app = apps.find((a) => a.id === iv.applicationId);
    if (!app) continue;
    out.push({
      id: `prep-${iv.id}`,
      tone: 'action',
      icon: 'calendar',
      title: `Prep for ${app.company} — ${relDay(iv.scheduledAt)}`,
      body: `${iv.round}: ${done}/${iv.checklist.length} prep steps done. Research the team, rehearse 3 stories and prepare questions to ask.`,
      cta: { label: 'Open prep', to: `/interviews?focus=${iv.id}` },
      priority: 95 - diff,
    });
  }

  /* Stale wishlist */
  const staleWish = apps.filter((a) => a.status === 'wishlist' && differenceInCalendarDays(now, toDate(a.createdAt)!) >= settings.staleWishlistDays);
  if (staleWish.length >= 2) {
    out.push({ id: 'wishlist', tone: 'action', icon: 'bookmark', title: `${plural(staleWish.length, 'saved job')} going stale`, body: 'Fresh postings get the most attention. Apply to the ones you love today — and archive the rest to keep your board clean.', cta: { label: 'Open wishlist', to: '/applications?quick=wishlist' }, priority: 62 });
  }

  /* Network health */
  const cold = contacts.filter((c) => (c.warmth === 'warm' || c.warmth === 'hot') && ['network', 'engaged', 'replied', 'referred'].includes(c.stage) && (!c.lastContactedAt || differenceInCalendarDays(now, toDate(c.lastContactedAt)!) > 30));
  if (cold.length >= 2) {
    out.push({ id: 'cold-network', tone: 'tip', icon: 'users', title: `${plural(cold.length, 'warm contact')} going cold`, body: 'No touchpoint in 30+ days. A quick “how are things?” or congrats on their news keeps relationships alive — before you need them.', cta: { label: 'Reconnect', to: '/contacts?quick=cold' }, priority: 35 });
  }
  const targets = contacts.filter((c) => c.stage === 'target' && !enrollments.some((e) => e.contactId === c.id && (e.status === 'active' || e.status === 'paused')));
  if (targets.length >= 3) {
    out.push({ id: 'targets', tone: 'action', icon: 'send', title: `${targets.length} people waiting in “To reach out”`, body: 'Put them in a sequence — Pursuit schedules every follow-up and drafts each message for you.', cta: { label: 'Start outreach', to: '/contacts?quick=targets' }, priority: 64 });
  }
  const finishedNoReply = enrollments.filter((e) => e.status === 'completed' && contacts.find((c) => c.id === e.contactId)?.stage === 'contacted');
  if (finishedNoReply.length >= 2) {
    out.push({ id: 'seq-done', tone: 'tip', icon: 'check', title: `${plural(finishedNoReply.length, 'sequence')} finished without a reply`, body: 'Mark them “No response” and move on — or try a different channel (email instead of LinkedIn) or a different person on the team.', cta: { label: 'Review', to: '/contacts?quick=awaiting' }, priority: 22 });
  }

  /* Personalized follow-up timing */
  const rds = applied.map(responseDays).filter((x): x is number => x !== null);
  if (rds.length >= 5) {
    const p80 = percentile(rds, 80)!;
    out.push({ id: 'timing', tone: 'tip', icon: 'clock', title: `80% of your responses arrive within ${plural(p80, 'day')}`, body: `If you haven't heard back after ~${p80} days, the odds drop fast — that's your cue to follow up or move on.${Math.abs(p80 - settings.followUpDays) >= 3 ? ` (Your follow-up reminder is set to ${settings.followUpDays} days.)` : ''}`, metric: `${p80}d`, cta: { label: 'Adjust reminders', to: '/settings/automation' }, priority: 28 });
  }

  /* Resume A/B */
  const byResume = breakdownBy(apps, (a) => a.resumeId, (k) => documents.find((d) => d.id === k)?.name ?? 'Unknown').filter((b) => b.key !== 'unknown' && b.total >= 4);
  if (byResume.length >= 2) {
    const s = [...byResume].sort((a, b) => (b.positiveRate ?? 0) - (a.positiveRate ?? 0));
    const r = ratio(s[0].positiveRate ?? 0, s[s.length - 1].positiveRate ?? 0);
    if ((s[0].positiveRate ?? 0) > 0 && r >= 1.5) {
      out.push({ id: 'resume-ab', tone: 'tip', icon: 'file', title: `“${s[0].label}” is your best resume`, body: `It gets screening calls ${fmtX(r)} as often as “${s[s.length - 1].label}” (${fmtPct(s[0].positiveRate)} vs ${fmtPct(s[s.length - 1].positiveRate)}). Make it your default.`, cta: { label: 'Documents', to: '/documents' }, priority: 45 });
    }
  }

  /* Easy apply double-tap */
  const easy = applied.filter((a) => a.method === 'easy_apply');
  const direct = applied.filter((a) => a.method !== 'easy_apply');
  if (easy.length >= 6 && direct.length >= 3) {
    const er = (easy.filter(isPositive).length / easy.length) * 100;
    const dr = (direct.filter(isPositive).length / direct.length) * 100;
    if (dr > er * 1.5) {
      out.push({ id: 'easy-apply', tone: 'tip', icon: 'zap', title: 'Easy Apply alone is a numbers game', body: `Only ${fmtPct(er)} of your ${METHOD_MAP.easy_apply.label.toLowerCase()} applications reach screening vs ${fmtPct(dr)} for other methods. Pair each one with a DM to the recruiter — the “apply + reach out” double-tap.`, cta: { label: 'Recruiter sequence', to: '/outreach/sequences' }, priority: 48 });
    }
  }

  /* Offers */
  for (const o of offers) {
    if (o.status !== 'pending' && o.status !== 'negotiating') continue;
    const d = toDate(o.deadline);
    if (!d) continue;
    const diff = differenceInCalendarDays(d, now);
    if (diff >= 0 && diff <= 5) out.push({ id: `offer-${o.id}`, tone: 'action', icon: 'gift', title: `Decide on ${o.company} by ${fmtDate(o.deadline)}`, body: 'Compare it side-by-side with your other options, and consider negotiating — most offers have some flexibility.', cta: { label: 'Compare offers', to: '/offers' }, priority: 99 });
  }

  /* Streak */
  const st = calcStreak(activity, now);
  if (st.current >= 3) {
    out.push({ id: 'streak', tone: 'win', icon: 'flame', title: `${st.current}-day streak 🔥`, body: st.todayDone ? 'Consistency compounds. You showed up today — nice.' : 'Do one thing today — an application or a message — to keep it alive.', priority: st.todayDone ? 15 : 66 });
  }

  const toneWeight: Record<InsightTone, number> = { action: 3, warning: 2, tip: 1, win: 0 };
  return out.sort((a, b) => b.priority - a.priority || toneWeight[b.tone] - toneWeight[a.tone]);
}
