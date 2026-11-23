import type { Application, Channel, Contact, Profile, Sequence, Template, TemplateCategory } from './types';
import { firstName } from './utils';

/* ───────────────────────── Variables ───────────────────────── */

export interface TemplateVar {
  key: string;
  label: string;
  group: 'Recipient' | 'Job' | 'You';
}

export const TEMPLATE_VARS: TemplateVar[] = [
  { key: 'firstName', label: 'First name', group: 'Recipient' },
  { key: 'fullName', label: 'Full name', group: 'Recipient' },
  { key: 'contactTitle', label: 'Their title', group: 'Recipient' },
  { key: 'mutualConnection', label: 'Mutual connection', group: 'Recipient' },
  { key: 'commonGround', label: 'Common ground', group: 'Recipient' },
  { key: 'company', label: 'Company', group: 'Job' },
  { key: 'role', label: 'Role', group: 'Job' },
  { key: 'jobLink', label: 'Job link', group: 'Job' },
  { key: 'myName', label: 'Your name', group: 'You' },
  { key: 'myFirstName', label: 'Your first name', group: 'You' },
  { key: 'myRole', label: 'Your role', group: 'You' },
  { key: 'myCompany', label: 'Your company', group: 'You' },
  { key: 'myExperience', label: 'Years of exp.', group: 'You' },
  { key: 'mySkills', label: 'Top skills', group: 'You' },
  { key: 'myAchievement', label: 'Best achievement', group: 'You' },
  { key: 'myPitch', label: 'Elevator pitch', group: 'You' },
  { key: 'mySchool', label: 'School / college', group: 'You' },
  { key: 'targetRole', label: 'Target role', group: 'You' },
  { key: 'myLinkedIn', label: 'Your LinkedIn', group: 'You' },
  { key: 'myPortfolio', label: 'Portfolio / GitHub', group: 'You' },
  { key: 'myEmail', label: 'Your email', group: 'You' },
  { key: 'myPhone', label: 'Your phone', group: 'You' },
  { key: 'noticePeriod', label: 'Notice period', group: 'You' },
  { key: 'currentCtc', label: 'Current CTC', group: 'You' },
  { key: 'expectedCtc', label: 'Expected CTC', group: 'You' },
];

export function buildContext(args: {
  profile: Profile;
  contact?: Contact | null;
  application?: Application | null;
}): Record<string, string> {
  const { profile, contact, application } = args;
  const role = application?.role || profile.targetRoles[0] || '';
  return {
    firstName: firstName(contact?.name),
    fullName: contact?.name ?? '',
    contactTitle: contact?.title ?? '',
    mutualConnection: contact?.mutualConnection ?? '',
    commonGround: contact?.commonGround ?? '',
    company: application?.company || contact?.company || '',
    role,
    jobLink: application?.url ?? '',
    myName: profile.name,
    myFirstName: firstName(profile.name),
    myRole: profile.currentRole || profile.headline,
    myCompany: profile.currentCompany,
    myExperience: profile.experienceYears !== undefined && profile.experienceYears !== null ? String(profile.experienceYears) : '',
    mySkills: profile.skills.slice(0, 3).join(', '),
    myAchievement: profile.achievement,
    myPitch: profile.pitch,
    mySchool: profile.school,
    targetRole: profile.targetRoles[0] || role,
    myLinkedIn: profile.linkedin,
    myPortfolio: profile.portfolio || profile.github,
    myEmail: profile.email,
    myPhone: profile.phone,
    noticePeriod: profile.noticePeriod,
    currentCtc: profile.currentCtc,
    expectedCtc: profile.expectedCtc,
  };
}

export function renderTemplate(text: string, ctx: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const out = (text ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => {
    const v = ctx[key];
    if (v && v.trim()) return v.trim();
    missing.add(key);
    return `[${key}]`;
  });
  return { text: out, missing: [...missing] };
}

export const varLabel = (key: string) => TEMPLATE_VARS.find((v) => v.key === key)?.label ?? key;

/* ───────────────────────── Message analyzer ───────────────────────── */

export interface MessageCheck {
  id: string;
  label: string;
  pass: boolean;
  tip: string;
  weight: number;
}

export interface MessageAnalysis {
  score: number;
  checks: MessageCheck[];
  words: number;
  chars: number;
  readSecs: number;
  questions: number;
  placeholders: string[];
  grade: 'Needs work' | 'Decent' | 'Strong' | 'Excellent';
}

const CLICHES = [
  'hope this email finds you well',
  'hope this message finds you well',
  'to whom it may concern',
  'dear sir',
  'dear madam',
  'respected sir',
  'respected ma',
  'i am writing to',
  'kindly do the needful',
  'please find attached',
  'i know you are busy',
  "i know you're busy",
  'any opportunity',
  'any job',
  'any openings',
  'pick your brain',
  'just checking in',
  'sorry to bother',
  'revert back',
  'greetings of the day',
  'esteemed organization',
  'apologies for the intrusion',
  'i am a hard worker',
  'passionate about everything',
];

const ASK_PATTERNS = [
  /\?/,
  /would you (be )?(open|willing|comfortable|mind)/i,
  /could (you|we)/i,
  /can (you|we)/i,
  /\b15[- ]?min/i,
  /\bquick (call|chat)/i,
  /let me know/i,
  /refer(ral| me)/i,
];

const PERSONAL_PATTERNS = [
  /\byour (post|article|talk|podcast|work on|team'?s work|journey|recent)/i,
  /\b(i saw|i noticed|i read|i loved|i enjoyed|congrat)/i,
  /\b(fellow|alum|alumni|mutual|we both|also from)\b/i,
  /\b(admire|big fan)\b/i,
];

export function analyzeMessage(
  body: string,
  opts: { channel: Channel; category?: TemplateCategory; subject?: string; recipientFirstName?: string; company?: string },
): MessageAnalysis {
  const text = body ?? '';
  const lower = text.toLowerCase();
  const words = (text.match(/\b[\w'’-]+\b/g) ?? []).length;
  const chars = text.length;
  const questions = (text.match(/\?/g) ?? []).length;
  const placeholders = Array.from(new Set([...(text.match(/\[[^\]\n]{1,60}\]/g) ?? []), ...(text.match(/\{\{\s*\w+\s*\}\}/g) ?? [])]));
  const isNote = opts.category === 'connection_note';
  const isEmail = opts.channel === 'email';
  const iCount = (lower.match(/\b(i|i'm|i’m|i've|me|my|mine)\b/g) ?? []).length;
  const youCount = (lower.match(/\b(you|your|you're|you’re|yours|team|company)\b/g) ?? []).length;

  let lengthPass = true;
  let lengthTip = '';
  if (isNote) {
    lengthPass = chars >= 60 && chars <= 200;
    lengthTip = chars > 300 ? 'Over the 300-char LinkedIn limit — cut it down.' : chars > 200 ? 'Over ~200 chars won’t fit a free-account invite note.' : chars < 60 ? 'Too thin — add why you want to connect.' : 'Fits a LinkedIn invite note.';
  } else if (opts.channel === 'twitter') {
    lengthPass = chars >= 60 && chars <= 280;
    lengthTip = chars < 60 ? 'Too thin — say who you are and why you’re reaching out.' : lengthPass ? 'Tweet-length — easy to read.' : 'Trim to under 280 characters.';
  } else if (isEmail) {
    lengthPass = words >= 40 && words <= 160;
    lengthTip = words < 40 ? 'A little thin — add one line of proof.' : words > 160 ? 'Cold emails over ~150 words get skimmed. Cut ruthlessly.' : 'Good length (40–160 words).';
  } else {
    lengthPass = chars >= 120 && chars <= 650;
    lengthTip = chars < 120 ? 'Too thin — add context, one line of proof and a clear ask.' : lengthPass ? 'Short enough to read on a phone.' : 'Long DMs get ignored — aim for under ~600 characters.';
  }

  const nameKnown = !!opts.recipientFirstName;
  const namePass = nameKnown
    ? lower.includes(opts.recipientFirstName!.toLowerCase())
    : /\b(hi|hey|hello|dear)\s+[A-Z][a-z]+/.test(text);
  const companyPass = opts.company ? lower.includes(opts.company.toLowerCase()) : true;
  const askPass = ASK_PATTERNS.some((r) => r.test(text));
  const proofPass = /\d/.test(text.replace(/\b(15|30)[- ]?min(ute)?s?\b/gi, ''));
  const youPass = iCount === 0 ? true : youCount >= Math.ceil(iCount * 0.5);
  const cliches = CLICHES.filter((c) => lower.includes(c));
  const personalPass = PERSONAL_PATTERNS.some((r) => r.test(text));

  const checks: MessageCheck[] = [
    { id: 'placeholders', label: 'No unfilled placeholders', pass: placeholders.length === 0, weight: 18, tip: placeholders.length ? `Fill in: ${placeholders.slice(0, 4).join(', ')}` : 'Everything is filled in.' },
    { id: 'name', label: 'Uses their name', pass: namePass, weight: 12, tip: namePass ? 'Personal greeting.' : 'Open with their first name — generic greetings get ignored.' },
    { id: 'length', label: isNote ? 'Fits the invite limit' : 'Right length', pass: lengthPass, weight: 16, tip: lengthTip },
    { id: 'ask', label: 'One clear ask', pass: askPass, weight: 14, tip: askPass ? 'There’s a clear call to action.' : 'End with one specific, easy-to-say-yes ask (e.g. a 15-min chat).' },
    { id: 'personal', label: 'Personalized hook', pass: personalPass, weight: 12, tip: personalPass ? 'Shows you did your homework.' : 'Mention something specific: their post, a mutual, shared school or team news.' },
    { id: 'proof', label: 'Proof (a number or result)', pass: proofPass, weight: 10, tip: proofPass ? 'Concrete proof builds credibility.' : 'Add one quantified result (e.g. “cut load time 40%”).' },
    { id: 'you', label: 'About them, not just you', pass: youPass, weight: 8, tip: youPass ? 'Balanced “you” vs “I”.' : `“I/me/my” appears ${iCount}× vs “you/your” ${youCount}× — reframe around them.` },
    { id: 'cliche', label: 'No clichés', pass: cliches.length === 0, weight: 10, tip: cliches.length ? `Drop: “${cliches[0]}”` : 'Fresh, natural language.' },
  ];
  if (opts.company) {
    checks.splice(2, 0, { id: 'company', label: 'Mentions the company', pass: companyPass, weight: 8, tip: companyPass ? 'Specific to this company.' : `Mention ${opts.company} so it doesn’t read like a mass message.` });
  }
  if (isEmail) {
    const subj = (opts.subject ?? '').trim();
    const subjPass = subj.length >= 8 && subj.length <= 60;
    checks.push({ id: 'subject', label: 'Strong subject line', pass: subjPass, weight: 8, tip: subj ? (subjPass ? 'Short and specific.' : 'Keep subjects under ~60 chars and specific.') : 'Add a short, specific subject line.' });
  }
  if (isNote) {
    const idx = checks.findIndex((c) => c.id === 'proof');
    if (idx >= 0) checks[idx].weight = 4;
  }
  const total = checks.reduce((a, c) => a + c.weight, 0);
  const got = checks.filter((c) => c.pass).reduce((a, c) => a + c.weight, 0);
  // Many checks pass vacuously on a near-empty draft, so scale the score down until there's real content.
  const raw = text.trim() ? (got / total) * 100 : 0;
  const score = Math.round(words < 12 ? (raw * Math.max(words, 1)) / 12 : raw);
  const grade = score >= 90 ? 'Excellent' : score >= 75 ? 'Strong' : score >= 55 ? 'Decent' : 'Needs work';
  return { score, checks, words, chars, readSecs: Math.max(1, Math.round((words / 230) * 60)), questions, placeholders, grade };
}

/* ───────────────────────── Default templates ───────────────────────── */

type Seed = Pick<Template, 'id' | 'name' | 'category' | 'channel' | 'body'> & { subject?: string };

const T: Seed[] = [
  {
    id: 'tpl-conn-peer',
    name: 'Invite — peer at target company',
    category: 'connection_note',
    channel: 'linkedin',
    body: "Hi {{firstName}}, I'm a {{myRole}} and {{company}} is one of the teams I admire most. I'd love to connect and learn how you've found working there!",
  },
  {
    id: 'tpl-conn-recruiter',
    name: 'Invite — recruiter after applying',
    category: 'connection_note',
    channel: 'linkedin',
    body: "Hi {{firstName}}, I'm a {{myRole}} with {{myExperience}}+ yrs in {{mySkills}}. I just applied for the {{role}} role at {{company}} and would love to connect.",
  },
  {
    id: 'tpl-conn-hm',
    name: 'Invite — hiring manager',
    category: 'connection_note',
    channel: 'linkedin',
    body: "Hi {{firstName}}, saw you're hiring a {{role}} at {{company}}. I recently {{myAchievement}} — would love to connect and follow your team's work.",
  },
  {
    id: 'tpl-conn-alumni',
    name: 'Invite — fellow alum',
    category: 'connection_note',
    channel: 'linkedin',
    body: "Hi {{firstName}}, fellow {{mySchool}} alum here! I'm exploring {{role}} roles and loved seeing your journey at {{company}}. Would be great to connect.",
  },
  {
    id: 'tpl-dm-referral',
    name: 'Referral ask — after they accept',
    category: 'referral',
    channel: 'linkedin',
    body: "Hi {{firstName}}, thanks for connecting!\n\nI'm applying for the {{role}} role at {{company}} ({{jobLink}}). Quick context: I'm a {{myRole}} with {{myExperience}} years of experience, and recently I {{myAchievement}}.\n\nWould you be comfortable referring me? I'll send a short blurb and my resume so it takes you less than 2 minutes. Totally fine if not — any advice on the team would help a lot too.\n\nThanks,\n{{myFirstName}}",
  },
  {
    id: 'tpl-referral-blurb',
    name: 'Forwardable referral blurb',
    category: 'referral',
    channel: 'email',
    subject: 'Referral blurb — {{myName}} for {{role}}',
    body: "Hi {{firstName}}, thank you again! Here's a short blurb you can paste into the referral form:\n\n\"{{myName}} is a {{myRole}} with {{myExperience}} years of experience in {{mySkills}}. Most recently, {{myFirstName}} {{myAchievement}}. Applying for: {{role}} ({{jobLink}}).\"\n\nMy resume is attached. Really appreciate you doing this!\n{{myFirstName}}",
  },
  {
    id: 'tpl-dm-advice',
    name: '15-min advice chat',
    category: 'networking',
    channel: 'linkedin',
    body: "Hi {{firstName}}, thanks for connecting!\n\nI'm exploring {{role}} roles and {{company}} is near the top of my list. Would you be open to a 15-minute chat sometime next week? I'd love to hear how the team works and what makes people successful there.\n\nHappy to work around your schedule — and no worries at all if now isn't a good time.",
  },
  {
    id: 'tpl-dm-recruiter',
    name: 'Recruiter DM — profile snapshot',
    category: 'recruiter',
    channel: 'linkedin',
    body: "Hi {{firstName}}, thanks for connecting! I applied for the {{role}} position at {{company}} and wanted to share a quick snapshot:\n\n• {{myExperience}} yrs as a {{myRole}}\n• Strong in {{mySkills}}\n• Recently {{myAchievement}}\n\nCould you let me know if my profile is a fit, or point me to the right person? Thank you!",
  },
  {
    id: 'tpl-email-hm',
    name: 'Cold email — hiring manager',
    category: 'cold_email',
    channel: 'email',
    subject: '{{role}} — quick note from a {{myRole}}',
    body: "Hi {{firstName}},\n\nI saw {{company}} is hiring a {{role}} and wanted to reach out to you directly.\n\nI'm a {{myRole}} with {{myExperience}} years of experience in {{mySkills}}. Recently, I {{myAchievement}} — and I'd love to bring that kind of impact to your team.\n\nI've applied through the careers page as well. Would you be open to a quick 15-minute call this week or next?\n\nBest,\n{{myName}}\n{{myLinkedIn}} · {{myPortfolio}}",
  },
  {
    id: 'tpl-email-recruiter',
    name: 'Cold email — recruiter',
    category: 'recruiter',
    channel: 'email',
    subject: 'Application for {{role}} — {{myName}}',
    body: "Hi {{firstName}},\n\nI recently applied for the {{role}} position at {{company}} and wanted to introduce myself.\n\n• {{myExperience}} years as a {{myRole}}\n• Core skills: {{mySkills}}\n• Recent win: {{myAchievement}}\n• Notice period: {{noticePeriod}}\n\nCould you take a look at my profile? Happy to share anything else that helps.\n\nThanks for your time,\n{{myName}}\n{{myPhone}} · {{myLinkedIn}}",
  },
  {
    id: 'tpl-recruiter-reply',
    name: 'Reply to an inbound recruiter',
    category: 'recruiter',
    channel: 'linkedin',
    body: "Hi {{firstName}}, thanks for reaching out about the {{role}} opportunity at {{company}} — it sounds interesting!\n\nQuick summary:\n• Experience: {{myExperience}} years as {{myRole}}\n• Current CTC: {{currentCtc}} · Expected: {{expectedCtc}}\n• Notice period: {{noticePeriod}}\n\nCould you share the JD and next steps? Happy to hop on a call.",
  },
  {
    id: 'tpl-fu-bump',
    name: 'Follow-up #1 — gentle bump',
    category: 'follow_up',
    channel: 'linkedin',
    body: "Hi {{firstName}}, just floating this back to the top of your inbox in case it got buried. I'm still very excited about the {{role}} role at {{company}} — would really value your thoughts whenever you have a moment. Thank you!",
  },
  {
    id: 'tpl-fu-value',
    name: 'Follow-up #2 — add value',
    category: 'follow_up',
    channel: 'email',
    subject: 'Re: {{role}} at {{company}}',
    body: "Hi {{firstName}},\n\nFollowing up with something that might be useful: [one specific idea, observation or link about {{company}}'s product].\n\nI'm still keen on the {{role}} role and would love to chat if you have 15 minutes. Either way, thanks for reading!\n\n{{myFirstName}}",
  },
  {
    id: 'tpl-fu-breakup',
    name: 'Final note — close the loop',
    category: 'follow_up',
    channel: 'email',
    subject: 'Closing the loop',
    body: "Hi {{firstName}},\n\nI don't want to crowd your inbox, so this will be my last note. If the {{role}} role — or something similar at {{company}} — opens up later, I'd love to be considered.\n\nWishing you and the team the best!\n{{myFirstName}}",
  },
  {
    id: 'tpl-fu-application',
    name: 'Application status check',
    category: 'follow_up',
    channel: 'email',
    subject: 'Following up on my {{role}} application',
    body: "Hi {{firstName}},\n\nI applied for the {{role}} position at {{company}} on [date] and wanted to follow up. I'm genuinely excited about it because [one specific reason — product, mission or team].\n\nIs there anything else I can share to help with the process?\n\nThank you,\n{{myName}}",
  },
  {
    id: 'tpl-ty-interview',
    name: 'Thank you — after interview',
    category: 'thank_you',
    channel: 'email',
    subject: 'Thank you — {{role}} interview',
    body: "Hi {{firstName}},\n\nThank you for taking the time to speak with me today. I really enjoyed our conversation about [specific topic you discussed], and it made me even more excited about the {{role}} role at {{company}}.\n\n[Optional: one line adding to an answer you gave, or a quick idea.]\n\nLooking forward to hearing about next steps.\n\nBest,\n{{myName}}",
  },
  {
    id: 'tpl-ty-referral',
    name: 'Thank you — after a referral',
    category: 'thank_you',
    channel: 'linkedin',
    body: "Hi {{firstName}}, thank you so much for referring me for the {{role}} role — I really appreciate you vouching for me. I'll keep you posted on how it goes, and please let me know if I can ever return the favor!",
  },
  {
    id: 'tpl-x-founder',
    name: 'X DM — startup founder',
    category: 'networking',
    channel: 'twitter',
    body: "Hey {{firstName}} — big fan of what you're building at {{company}}. I'm a {{myRole}} ({{mySkills}}) and recently {{myAchievement}}. Are you hiring for {{role}}? Here's my work: {{myPortfolio}}",
  },
  {
    id: 'tpl-reconnect',
    name: 'Warm reconnect',
    category: 'networking',
    channel: 'linkedin',
    body: "Hi {{firstName}}, it's been a while — hope all is great at {{company}}! I'm exploring new {{targetRole}} opportunities and would love to catch up and hear what you're working on. Any chance you have 15 minutes this week or next?",
  },
  {
    id: 'tpl-negotiate',
    name: 'Offer negotiation',
    category: 'negotiation',
    channel: 'email',
    subject: '{{role}} offer — next steps',
    body: "Hi {{firstName}},\n\nThank you again for the offer — I'm genuinely excited about joining {{company}}.\n\nBased on the scope of the role and the market for similar positions, I was hoping we could bring the base closer to [target number]. If that's difficult, I'm also open to discussing [joining bonus / equity / a 6-month review].\n\nI'm keen to make this work and can move quickly once we align.\n\nBest,\n{{myName}}",
  },
];

export function defaultTemplates(now: string): Template[] {
  return T.map((t) => ({ ...t, builtIn: true, favorite: false, createdAt: now, updatedAt: now }));
}

/* ───────────────────────── Default sequences ───────────────────────── */

export function defaultSequences(now: string): Sequence[] {
  const s = (
    id: string,
    name: string,
    description: string,
    steps: [number, Sequence['steps'][number]['channel'], Sequence['steps'][number]['kind'], string, string?][],
  ): Sequence => ({
    id,
    name,
    description,
    builtIn: true,
    createdAt: now,
    updatedAt: now,
    steps: steps.map(([day, channel, kind, title, templateId], i) => ({ id: `${id}-s${i}`, day, channel, kind, title, templateId })),
  });
  return [
    s('seq-referral', 'Referral hunt (LinkedIn)', 'Warm up an employee at your target company, connect, then ask for a referral. Referrals are typically the highest-converting way in.', [
      [0, 'linkedin', 'comment', 'Warm up: react or leave a thoughtful comment on a recent post'],
      [1, 'linkedin', 'connection_request', 'Send a connection request with a short note', 'tpl-conn-peer'],
      [3, 'linkedin', 'referral_request', 'Thank them for connecting + ask for a referral', 'tpl-dm-referral'],
      [8, 'linkedin', 'follow_up', 'Gentle bump', 'tpl-fu-bump'],
      [15, 'linkedin', 'follow_up', 'Final note — close the loop', 'tpl-fu-breakup'],
    ]),
    s('seq-recruiter', 'Recruiter direct', 'Apply, then go straight to the recruiter on LinkedIn and email with a crisp profile snapshot.', [
      [0, 'linkedin', 'connection_request', 'Connect with the recruiter', 'tpl-conn-recruiter'],
      [1, 'email', 'email', 'Email your profile snapshot', 'tpl-email-recruiter'],
      [7, 'email', 'follow_up', 'Application status check', 'tpl-fu-application'],
      [14, 'email', 'follow_up', 'Final note', 'tpl-fu-breakup'],
    ]),
    s('seq-hm', 'Hiring manager cold email', 'Bypass the queue: pitch the hiring manager with proof, then follow up with value — not just “bumping”.', [
      [0, 'email', 'email', 'Send the cold email', 'tpl-email-hm'],
      [4, 'email', 'follow_up', 'Gentle bump', 'tpl-fu-bump'],
      [10, 'email', 'follow_up', 'Add-value follow-up', 'tpl-fu-value'],
      [17, 'email', 'follow_up', 'Break-up email', 'tpl-fu-breakup'],
    ]),
    s('seq-advice', 'Informational chat', 'Ask for advice, not a job. People say yes to 15-minute chats — and often refer you afterwards.', [
      [0, 'linkedin', 'connection_request', 'Connect with a short note', 'tpl-conn-peer'],
      [2, 'linkedin', 'message', 'Ask for a 15-minute chat', 'tpl-dm-advice'],
      [8, 'linkedin', 'follow_up', 'Gentle bump', 'tpl-fu-bump'],
    ]),
    s('seq-reconnect', 'Warm network reconnect', 'Re-activate ex-colleagues, friends and alumni. Warm intros beat cold messages.', [
      [0, 'linkedin', 'message', 'Reconnect message', 'tpl-reconnect'],
      [5, 'linkedin', 'follow_up', 'Gentle bump', 'tpl-fu-bump'],
    ]),
    s('seq-founder', 'Startup founder (X + email)', 'Founders at early-stage startups often hire directly. Show your work, keep it short.', [
      [0, 'twitter', 'message', 'DM on X with your work', 'tpl-x-founder'],
      [3, 'email', 'email', 'Short cold email', 'tpl-email-hm'],
      [9, 'email', 'follow_up', 'Final note', 'tpl-fu-breakup'],
    ]),
  ];
}
