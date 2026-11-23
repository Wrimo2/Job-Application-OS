import type {
  AccentKey,
  ApplyMethod,
  Channel,
  CompanyTier,
  ContactStage,
  InteractionKind,
  InterviewType,
  JobType,
  OfferFactor,
  QuestionCategory,
  Relationship,
  Stage,
  TemplateCategory,
  Warmth,
  WorkMode,
} from './types';

/* ───────────────────────── Application stages ───────────────────────── */

export interface StageMeta {
  id: Stage;
  label: string;
  hint: string;
  dot: string;
  chip: string;
  bar: string;
}

export const STAGES: StageMeta[] = [
  { id: 'wishlist', label: 'Wishlist', hint: 'Saved — not applied yet', dot: 'bg-slate-400', bar: 'bg-slate-400', chip: 'bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300' },
  { id: 'applied', label: 'Applied', hint: 'Waiting for a response', dot: 'bg-blue-500', bar: 'bg-blue-500', chip: 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300' },
  { id: 'screening', label: 'Screening', hint: 'Recruiter / HR call', dot: 'bg-cyan-500', bar: 'bg-cyan-500', chip: 'bg-cyan-500/10 text-cyan-700 ring-cyan-500/20 dark:text-cyan-300' },
  { id: 'assessment', label: 'Assessment', hint: 'Test, assignment or take-home', dot: 'bg-amber-500', bar: 'bg-amber-500', chip: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300' },
  { id: 'interviewing', label: 'Interviewing', hint: 'Interview rounds in progress', dot: 'bg-violet-500', bar: 'bg-violet-500', chip: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300' },
  { id: 'offer', label: 'Offer', hint: 'Offer received 🎉', dot: 'bg-emerald-500', bar: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300' },
  { id: 'accepted', label: 'Accepted', hint: 'You said yes!', dot: 'bg-green-600', bar: 'bg-green-600', chip: 'bg-green-600/10 text-green-700 ring-green-600/25 dark:text-green-300' },
  { id: 'rejected', label: 'Rejected', hint: 'Not moving forward', dot: 'bg-rose-500', bar: 'bg-rose-500', chip: 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300' },
  { id: 'withdrawn', label: 'Withdrawn', hint: 'You stepped back', dot: 'bg-zinc-400', bar: 'bg-zinc-400', chip: 'bg-zinc-500/10 text-zinc-700 ring-zinc-500/20 dark:text-zinc-300' },
  { id: 'ghosted', label: 'Ghosted', hint: 'No response for weeks', dot: 'bg-stone-400', bar: 'bg-stone-400', chip: 'bg-stone-500/10 text-stone-600 ring-stone-500/20 dark:text-stone-300' },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s])) as Record<Stage, StageMeta>;
export const BOARD_STAGES: Stage[] = ['wishlist', 'applied', 'screening', 'assessment', 'interviewing', 'offer'];
export const CLOSED_STAGES: Stage[] = ['accepted', 'rejected', 'withdrawn', 'ghosted'];
export const ACTIVE_STAGES: Stage[] = BOARD_STAGES;
/** Progress rank along the happy path. Closed outcomes are -1 (use history for how far it got). */
export const STAGE_RANK: Record<Stage, number> = {
  wishlist: 0,
  applied: 1,
  screening: 2,
  assessment: 3,
  interviewing: 4,
  offer: 5,
  accepted: 6,
  rejected: -1,
  withdrawn: -1,
  ghosted: -1,
};

/* ───────────────────────── Platforms ───────────────────────── */

export interface PlatformMeta {
  id: string;
  label: string;
  color: string;
  domains: string[];
}

export const PLATFORMS: PlatformMeta[] = [
  { id: 'linkedin', label: 'LinkedIn', color: '#0a66c2', domains: ['linkedin.com', 'lnkd.in'] },
  { id: 'naukri', label: 'Naukri', color: '#4a6cf7', domains: ['naukri.com'] },
  { id: 'company_site', label: 'Company website', color: '#64748b', domains: ['greenhouse.io', 'lever.co', 'ashbyhq.com', 'myworkdayjobs.com', 'workday.com', 'smartrecruiters.com', 'icims.com', 'taleo.net', 'successfactors.com', 'bamboohr.com', 'recruitee.com', 'workable.com', 'jobvite.com', 'teamtailor.com', 'keka.com', 'darwinbox.in', 'zohorecruit.com', 'freshteam.com', 'personio.de', 'rippling.com'] },
  { id: 'referral', label: 'Referral / Network', color: '#16a34a', domains: [] },
  { id: 'indeed', label: 'Indeed', color: '#2557a7', domains: ['indeed.com', 'indeed.co.in'] },
  { id: 'wellfound', label: 'Wellfound', color: '#e11d48', domains: ['wellfound.com', 'angel.co'] },
  { id: 'instahyre', label: 'Instahyre', color: '#0ea5e9', domains: ['instahyre.com'] },
  { id: 'cutshort', label: 'Cutshort', color: '#7c3aed', domains: ['cutshort.io'] },
  { id: 'glassdoor', label: 'Glassdoor', color: '#0caa41', domains: ['glassdoor.com', 'glassdoor.co.in'] },
  { id: 'foundit', label: 'Foundit (Monster)', color: '#6d28d9', domains: ['foundit.in', 'monsterindia.com', 'monster.com'] },
  { id: 'iimjobs', label: 'IIMJobs', color: '#b45309', domains: ['iimjobs.com'] },
  { id: 'hirist', label: 'Hirist', color: '#0f766e', domains: ['hirist.tech', 'hirist.com'] },
  { id: 'internshala', label: 'Internshala', color: '#0891b2', domains: ['internshala.com'] },
  { id: 'apna', label: 'Apna', color: '#ca8a04', domains: ['apna.co'] },
  { id: 'shine', label: 'Shine', color: '#f59e0b', domains: ['shine.com'] },
  { id: 'yc', label: 'YC Work at a Startup', color: '#f97316', domains: ['workatastartup.com', 'ycombinator.com'] },
  { id: 'twitter', label: 'X / Twitter', color: '#525252', domains: ['x.com', 'twitter.com'] },
  { id: 'instagram', label: 'Instagram', color: '#db2777', domains: ['instagram.com'] },
  { id: 'whatsapp', label: 'WhatsApp / Telegram', color: '#22c55e', domains: ['whatsapp.com', 'wa.me', 't.me', 'telegram.me'] },
  { id: 'reddit', label: 'Reddit', color: '#ff4500', domains: ['reddit.com'] },
  { id: 'recruiter', label: 'Recruiter reached out', color: '#ec4899', domains: [] },
  { id: 'event', label: 'Job fair / Event', color: '#a16207', domains: [] },
  { id: 'other', label: 'Other', color: '#94a3b8', domains: [] },
];

export const PLATFORM_MAP: Record<string, PlatformMeta> = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));

export function platformMeta(id: string | undefined): PlatformMeta {
  if (!id) return PLATFORM_MAP.other;
  return PLATFORM_MAP[id] ?? { id, label: id, color: '#94a3b8', domains: [] };
}

export const METHODS: { id: ApplyMethod; label: string; hint: string }[] = [
  { id: 'easy_apply', label: 'Easy / quick apply', hint: 'One-click apply on a job board' },
  { id: 'company_portal', label: 'Company careers portal', hint: 'Applied on the company site / ATS' },
  { id: 'referral', label: 'Referral', hint: 'Someone referred you internally' },
  { id: 'cold_email', label: 'Cold email / DM', hint: 'You pitched a hiring manager or recruiter directly' },
  { id: 'recruiter_inbound', label: 'Recruiter reached out', hint: 'Inbound — they found you' },
  { id: 'other', label: 'Other', hint: '' },
];
export const METHOD_MAP = Object.fromEntries(METHODS.map((m) => [m.id, m])) as Record<ApplyMethod, (typeof METHODS)[number]>;

export const WORK_MODES: { id: WorkMode; label: string }[] = [
  { id: 'remote', label: 'Remote' },
  { id: 'hybrid', label: 'Hybrid' },
  { id: 'onsite', label: 'On-site' },
];
export const WORK_MODE_LABEL = Object.fromEntries(WORK_MODES.map((w) => [w.id, w.label])) as Record<WorkMode, string>;

export const JOB_TYPES: { id: JobType; label: string }[] = [
  { id: 'full_time', label: 'Full-time' },
  { id: 'contract', label: 'Contract' },
  { id: 'internship', label: 'Internship' },
  { id: 'part_time', label: 'Part-time' },
  { id: 'freelance', label: 'Freelance' },
];
export const JOB_TYPE_LABEL = Object.fromEntries(JOB_TYPES.map((w) => [w.id, w.label])) as Record<JobType, string>;

export const REJECTION_REASONS = [
  'No response / auto-rejection',
  'Not enough experience',
  'Skills mismatch',
  'Failed technical round',
  'Failed assessment',
  'Culture / team fit',
  'Salary mismatch',
  'Position filled / on hold',
  'Location / visa',
  'Other',
];

/* ───────────────────────── Network ───────────────────────── */

export interface ContactStageMeta {
  id: ContactStage;
  label: string;
  hint: string;
  dot: string;
  chip: string;
}

export const CONTACT_STAGES: ContactStageMeta[] = [
  { id: 'target', label: 'To reach out', hint: 'People you plan to contact', dot: 'bg-sky-500', chip: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300' },
  { id: 'contacted', label: 'Contacted', hint: 'Waiting for a reply', dot: 'bg-blue-500', chip: 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300' },
  { id: 'replied', label: 'Replied', hint: 'They wrote back', dot: 'bg-violet-500', chip: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300' },
  { id: 'engaged', label: 'In conversation', hint: 'Call, chat or ongoing thread', dot: 'bg-fuchsia-500', chip: 'bg-fuchsia-500/10 text-fuchsia-700 ring-fuchsia-500/20 dark:text-fuchsia-300' },
  { id: 'referred', label: 'Referred / Champion', hint: 'Referred you or actively helping', dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300' },
  { id: 'network', label: 'Network', hint: 'Connected — keep warm', dot: 'bg-slate-400', chip: 'bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300' },
  { id: 'no_response', label: 'No response', hint: 'Sequence finished, no reply', dot: 'bg-zinc-400', chip: 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:text-zinc-300' },
  { id: 'closed', label: 'Closed', hint: 'Not pursuing', dot: 'bg-stone-400', chip: 'bg-stone-500/10 text-stone-600 ring-stone-500/20 dark:text-stone-300' },
];
export const CONTACT_STAGE_MAP = Object.fromEntries(CONTACT_STAGES.map((s) => [s.id, s])) as Record<ContactStage, ContactStageMeta>;
export const CONTACT_BOARD_STAGES: ContactStage[] = ['target', 'contacted', 'replied', 'engaged', 'referred'];

export const RELATIONSHIPS: { id: Relationship; label: string; chip: string }[] = [
  { id: 'recruiter', label: 'Recruiter / TA', chip: 'bg-pink-500/10 text-pink-700 ring-pink-500/20 dark:text-pink-300' },
  { id: 'hiring_manager', label: 'Hiring manager', chip: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300' },
  { id: 'engineer', label: 'Peer (same role)', chip: 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300' },
  { id: 'employee', label: 'Employee', chip: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300' },
  { id: 'alumni', label: 'Alumni', chip: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300' },
  { id: 'founder', label: 'Founder', chip: 'bg-orange-500/10 text-orange-700 ring-orange-500/20 dark:text-orange-300' },
  { id: 'leader', label: 'Leader / Exec', chip: 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300' },
  { id: 'mentor', label: 'Mentor', chip: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300' },
  { id: 'friend', label: 'Friend / Ex-colleague', chip: 'bg-teal-500/10 text-teal-700 ring-teal-500/20 dark:text-teal-300' },
  { id: 'other', label: 'Other', chip: 'bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300' },
];
export const RELATIONSHIP_MAP = Object.fromEntries(RELATIONSHIPS.map((r) => [r.id, r])) as Record<Relationship, (typeof RELATIONSHIPS)[number]>;

export const WARMTH: { id: Warmth; label: string; emoji: string; chip: string }[] = [
  { id: 'cold', label: 'Cold', emoji: '❄️', chip: 'bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-300' },
  { id: 'warm', label: 'Warm', emoji: '☀️', chip: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300' },
  { id: 'hot', label: 'Hot', emoji: '🔥', chip: 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300' },
];
export const WARMTH_MAP = Object.fromEntries(WARMTH.map((w) => [w.id, w])) as Record<Warmth, (typeof WARMTH)[number]>;

export const CHANNELS: { id: Channel; label: string }[] = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'email', label: 'Email' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'naukri', label: 'Naukri' },
  { id: 'phone', label: 'Phone' },
  { id: 'in_person', label: 'In person' },
  { id: 'other', label: 'Other' },
];
export const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.id, c.label])) as Record<Channel, string>;

export const INTERACTION_KINDS: { id: InteractionKind; label: string; outbound: boolean }[] = [
  { id: 'connection_request', label: 'Connection request', outbound: true },
  { id: 'message', label: 'Message / DM', outbound: true },
  { id: 'email', label: 'Email', outbound: true },
  { id: 'inmail', label: 'InMail', outbound: true },
  { id: 'follow_up', label: 'Follow-up', outbound: true },
  { id: 'referral_request', label: 'Referral ask', outbound: true },
  { id: 'comment', label: 'Engaged with their post', outbound: true },
  { id: 'call', label: 'Call', outbound: true },
  { id: 'meeting', label: 'Meeting / coffee chat', outbound: true },
  { id: 'thank_you', label: 'Thank-you note', outbound: true },
  { id: 'reply', label: 'They replied', outbound: false },
  { id: 'note', label: 'Note', outbound: false },
];
export const KIND_LABEL = Object.fromEntries(INTERACTION_KINDS.map((k) => [k.id, k.label])) as Record<InteractionKind, string>;

/* ───────────────────────── Outreach engine ───────────────────────── */

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string; hint: string }[] = [
  { id: 'connection_note', label: 'Connection note', hint: 'Short LinkedIn invite note' },
  { id: 'linkedin_message', label: 'LinkedIn DM', hint: 'After they accept' },
  { id: 'referral', label: 'Referral ask', hint: 'Ask an employee to refer you' },
  { id: 'cold_email', label: 'Cold email', hint: 'Pitch a hiring manager directly' },
  { id: 'recruiter', label: 'Recruiter', hint: 'Talent acquisition & HR' },
  { id: 'follow_up', label: 'Follow-up', hint: 'Bumps, nudges & break-ups' },
  { id: 'networking', label: 'Networking', hint: 'Advice calls & reconnects' },
  { id: 'thank_you', label: 'Thank you', hint: 'After interviews & help' },
  { id: 'negotiation', label: 'Offer & negotiation', hint: 'Counter-offers & decisions' },
  { id: 'other', label: 'Other', hint: '' },
];
export const TEMPLATE_CATEGORY_LABEL = Object.fromEntries(TEMPLATE_CATEGORIES.map((c) => [c.id, c.label])) as Record<TemplateCategory, string>;

/** Character guidance per message type. */
export function channelLimit(category: TemplateCategory | undefined, channel: Channel): { max?: number; soft?: number; note: string } {
  if (category === 'connection_note') return { max: 300, soft: 200, note: 'LinkedIn invite notes: ~200 chars on free accounts, 300 on Premium' };
  if (channel === 'twitter') return { max: 10000, soft: 280, note: 'Keep X DMs short — under 280 chars reads best' };
  if (channel === 'linkedin') return { max: 8000, soft: 600, note: 'LinkedIn DMs: aim for under ~600 chars (mobile-friendly)' };
  if (channel === 'whatsapp') return { soft: 400, note: 'Keep WhatsApp messages brief and polite' };
  if (channel === 'email') return { soft: 900, note: 'Cold emails: ~75–150 words get the best replies' };
  return { note: '' };
}

/* ───────────────────────── Interviews & prep ───────────────────────── */

export const INTERVIEW_TYPES: { id: InterviewType; label: string }[] = [
  { id: 'phone_screen', label: 'Recruiter / phone screen' },
  { id: 'technical', label: 'Technical' },
  { id: 'coding', label: 'Coding / DSA' },
  { id: 'system_design', label: 'System design' },
  { id: 'take_home', label: 'Take-home assignment' },
  { id: 'case', label: 'Case study' },
  { id: 'behavioral', label: 'Behavioral' },
  { id: 'hiring_manager', label: 'Hiring manager' },
  { id: 'panel', label: 'Panel' },
  { id: 'onsite', label: 'Onsite / final loop' },
  { id: 'hr', label: 'HR / culture fit' },
  { id: 'other', label: 'Other' },
];
export const INTERVIEW_TYPE_LABEL = Object.fromEntries(INTERVIEW_TYPES.map((t) => [t.id, t.label])) as Record<InterviewType, string>;

export const DEFAULT_CHECKLIST = [
  'Research the company, product & recent news',
  'Re-read the JD and map your experience to it',
  'Prepare 3 STAR stories for likely questions',
  'Prepare 3 thoughtful questions to ask',
  'Look up your interviewers on LinkedIn',
  'Test camera, mic & meeting link',
];

export const QUESTION_CATEGORIES: { id: QuestionCategory; label: string }[] = [
  { id: 'behavioral', label: 'Behavioral' },
  { id: 'technical', label: 'Technical' },
  { id: 'system_design', label: 'System design' },
  { id: 'hr', label: 'HR / salary' },
  { id: 'company', label: 'Company-specific' },
  { id: 'other', label: 'Other' },
];
export const QUESTION_CATEGORY_LABEL = Object.fromEntries(QUESTION_CATEGORIES.map((c) => [c.id, c.label])) as Record<QuestionCategory, string>;

export const COMPETENCIES = [
  'Leadership',
  'Ownership',
  'Conflict',
  'Failure & learning',
  'Teamwork',
  'Impact & results',
  'Ambiguity',
  'Customer focus',
  'Tight deadline',
  'Influence',
  'Mentoring',
  'Technical depth',
  'Innovation',
  'Prioritization',
];

export const COMPANY_TIERS: { id: CompanyTier; label: string; chip: string; emoji: string }[] = [
  { id: 'dream', label: 'Dream', emoji: '🌟', chip: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300' },
  { id: 'target', label: 'Target', emoji: '🎯', chip: 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300' },
  { id: 'backup', label: 'Backup', emoji: '🛟', chip: 'bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300' },
  { id: 'none', label: 'Unranked', emoji: '·', chip: 'bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:text-zinc-300' },
];
export const COMPANY_TIER_MAP = Object.fromEntries(COMPANY_TIERS.map((t) => [t.id, t])) as Record<CompanyTier, (typeof COMPANY_TIERS)[number]>;

export const OFFER_FACTORS: { id: OfferFactor; label: string; hint: string }[] = [
  { id: 'growth', label: 'Career growth', hint: 'Scope, title, trajectory' },
  { id: 'learning', label: 'Learning', hint: 'Team quality, mentorship, tech' },
  { id: 'culture', label: 'Culture & team', hint: 'People you would work with' },
  { id: 'wlb', label: 'Work-life balance', hint: 'Hours, flexibility, commute' },
  { id: 'stability', label: 'Stability', hint: 'Funding, runway, market' },
  { id: 'brand', label: 'Brand value', hint: 'How it reads on your resume' },
];

/* ───────────────────────── Appearance ───────────────────────── */

export const ACCENTS: { id: AccentKey; label: string; swatch: string }[] = [
  { id: 'indigo', label: 'Indigo', swatch: '#4f46e5' },
  { id: 'violet', label: 'Violet', swatch: '#7c3aed' },
  { id: 'blue', label: 'Blue', swatch: '#2563eb' },
  { id: 'emerald', label: 'Emerald', swatch: '#059669' },
  { id: 'rose', label: 'Rose', swatch: '#e11d48' },
  { id: 'orange', label: 'Orange', swatch: '#ea580c' },
];

export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: 'INR', symbol: '₹', label: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)' },
  { code: 'AED', symbol: 'AED ', label: 'UAE Dirham (AED)' },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar (S$)' },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar (C$)' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (A$)' },
];
