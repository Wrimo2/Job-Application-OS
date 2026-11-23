import { addDays, addMinutes, startOfDay } from 'date-fns';
import { db, getSettings, updateSettings } from './db';
import { DEFAULT_CHECKLIST } from './constants';
import type {
  Application,
  ApplyMethod,
  Channel,
  Company,
  CompanyTier,
  Contact,
  ContactStage,
  DocumentFile,
  Enrollment,
  Interaction,
  InteractionKind,
  InteractionOutcome,
  Interview,
  InterviewOutcome,
  InterviewType,
  Offer,
  Priority,
  Question,
  QuestionCategory,
  Relationship,
  Snippet,
  Stage,
  StarStory,
  Task,
  Warmth,
  WorkMode,
} from './types';
import { companyKey, uid } from './utils';

const at = (daysOffset: number, hour = 10, minute = 0) => {
  const d = startOfDay(addDays(new Date(), daysOffset));
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};
const ago = (days: number, hour = 10, minute = 0) => at(-days, hour, minute);

/* ───────────────────────── Companies ───────────────────────── */

const COMPANIES: [string, string, string, string, CompanyTier][] = [
  ['Razorpay', 'razorpay.com', 'Fintech', 'Bengaluru', 'dream'],
  ['Swiggy', 'swiggy.com', 'Food & quick commerce', 'Bengaluru', 'target'],
  ['Atlassian', 'atlassian.com', 'Developer tools', 'Bengaluru', 'dream'],
  ['CRED', 'cred.club', 'Fintech', 'Bengaluru', 'target'],
  ['Postman', 'postman.com', 'Developer tools', 'Bengaluru', 'dream'],
  ['Meesho', 'meesho.com', 'E-commerce', 'Bengaluru', 'target'],
  ['Groww', 'groww.in', 'Fintech', 'Bengaluru', 'target'],
  ['BrowserStack', 'browserstack.com', 'Developer tools', 'Mumbai', 'target'],
  ['Freshworks', 'freshworks.com', 'SaaS', 'Chennai', 'target'],
  ['Flipkart', 'flipkart.com', 'E-commerce', 'Bengaluru', 'target'],
  ['Zerodha', 'zerodha.com', 'Fintech', 'Bengaluru', 'target'],
  ['PhonePe', 'phonepe.com', 'Fintech', 'Bengaluru', 'target'],
  ['Microsoft', 'microsoft.com', 'Big tech', 'Hyderabad', 'dream'],
  ['Uber', 'uber.com', 'Mobility', 'Bengaluru', 'target'],
  ['Zepto', 'zeptonow.com', 'Quick commerce', 'Mumbai', 'backup'],
  ['Juspay', 'juspay.in', 'Fintech', 'Bengaluru', 'target'],
  ['Stripe', 'stripe.com', 'Fintech', 'Remote', 'dream'],
  ['Figma', 'figma.com', 'Design tools', 'Remote', 'dream'],
  ['Zoho', 'zoho.com', 'SaaS', 'Chennai', 'backup'],
  ['Chargebee', 'chargebee.com', 'SaaS', 'Chennai', 'backup'],
  ['Amazon', 'amazon.com', 'Big tech', 'Bengaluru', 'target'],
  ['Google', 'google.com', 'Big tech', 'Bengaluru', 'dream'],
  ['Notion', 'notion.so', 'Productivity', 'Remote', 'dream'],
  ['Hasura', 'hasura.io', 'Developer tools', 'Bengaluru', 'target'],
  ['Setu', 'setu.co', 'Fintech', 'Bengaluru', 'backup'],
  ['Paytm', 'paytm.com', 'Fintech', 'Noida', 'backup'],
  ['Ola', 'olacabs.com', 'Mobility', 'Bengaluru', 'backup'],
  ['ShareChat', 'sharechat.com', 'Social media', 'Bengaluru', 'backup'],
  ['Nykaa', 'nykaa.com', 'E-commerce', 'Mumbai', 'backup'],
  ['Dream11', 'dream11.com', 'Gaming', 'Mumbai', 'backup'],
  ['InMobi', 'inmobi.com', 'Adtech', 'Bengaluru', 'backup'],
  ['Unacademy', 'unacademy.com', 'Edtech', 'Bengaluru', 'backup'],
  ['Urban Company', 'urbancompany.com', 'Marketplace', 'Gurugram', 'backup'],
  ['Myntra', 'myntra.com', 'E-commerce', 'Bengaluru', 'target'],
  ['Sprinklr', 'sprinklr.com', 'SaaS', 'Gurugram', 'backup'],
  ['Adobe', 'adobe.com', 'Big tech', 'Noida', 'target'],
  ['Salesforce', 'salesforce.com', 'SaaS', 'Hyderabad', 'target'],
  ['Intuit', 'intuit.com', 'Fintech', 'Bengaluru', 'target'],
  ['Walmart Global Tech', 'walmart.com', 'Retail tech', 'Bengaluru', 'backup'],
  ['Zomato', 'zomato.com', 'Food delivery', 'Gurugram', 'target'],
  ['Canva', 'canva.com', 'Design tools', 'Remote', 'dream'],
  ['upGrad', 'upgrad.com', 'Edtech', 'Mumbai', 'backup'],
  ['Vercel', 'vercel.com', 'Developer tools', 'Remote', 'dream'],
  ['Cloudflare', 'cloudflare.com', 'Infrastructure', 'Bengaluru', 'dream'],
  ['Rippling', 'rippling.com', 'HR tech', 'Bengaluru', 'target'],
  ['slice', 'sliceit.com', 'Fintech', 'Bengaluru', 'target'],
  ['Jar', 'myjar.app', 'Fintech', 'Bengaluru', 'backup'],
  ['Atlan', 'atlan.com', 'Data tools', 'Remote', 'target'],
  ['Lumen Labs', '', 'AI startup', 'Bengaluru', 'none'],
];

/* ───────────────────────── Applications ───────────────────────── */

interface AppSpec {
  c: string;
  r: string;
  p: string;
  m: ApplyMethod;
  s: Stage;
  ago: number;
  steps?: [Stage, number][];
  loc?: string;
  wm?: WorkMode;
  sal?: [number, number];
  pr?: Priority;
  ex?: number;
  tags?: string[];
  reason?: string;
  resume?: 'v3' | 'v2';
  next?: [string, number];
  deadline?: number;
  notes?: string;
}

const L = (n: number) => n * 1e5;

const APPS: AppSpec[] = [
  { c: 'Razorpay', r: 'Senior Frontend Engineer', p: 'referral', m: 'referral', s: 'interviewing', ago: 24, steps: [['screening', 20], ['interviewing', 13]], loc: 'Bengaluru', wm: 'hybrid', sal: [L(28), L(38)], pr: 3, ex: 5, tags: ['fintech', 'dream'], resume: 'v3', next: ['Prepare for system design round', 1], notes: 'Team owns Checkout & Payment Links. Priya referred me. Focus areas: performance, design systems, accessibility.' },
  { c: 'Swiggy', r: 'SDE-2 (Frontend)', p: 'linkedin', m: 'easy_apply', s: 'interviewing', ago: 30, steps: [['screening', 25], ['interviewing', 18]], loc: 'Bengaluru', wm: 'hybrid', sal: [L(25), L(32)], pr: 3, ex: 4, resume: 'v3' },
  { c: 'Atlassian', r: 'Frontend Engineer (P40)', p: 'company_site', m: 'company_portal', s: 'screening', ago: 12, steps: [['screening', 6]], loc: 'Bengaluru', wm: 'remote', sal: [L(32), L(42)], pr: 3, ex: 5, tags: ['dream'], resume: 'v3', next: ['Prepare for recruiter call', 0] },
  { c: 'CRED', r: 'Frontend Engineer', p: 'instahyre', m: 'easy_apply', s: 'assessment', ago: 15, steps: [['screening', 9], ['assessment', 8]], loc: 'Bengaluru', wm: 'onsite', sal: [L(24), L(30)], pr: 2, ex: 4, resume: 'v3' },
  { c: 'Postman', r: 'Software Engineer, Frontend', p: 'linkedin', m: 'company_portal', s: 'screening', ago: 9, steps: [['screening', 4]], loc: 'Bengaluru', wm: 'hybrid', sal: [L(26), L(34)], pr: 3, ex: 5, resume: 'v3' },
  { c: 'Meesho', r: 'SDE-2 Web', p: 'naukri', m: 'easy_apply', s: 'assessment', ago: 11, steps: [['assessment', 7]], loc: 'Bengaluru', wm: 'hybrid', sal: [L(22), L(28)], pr: 2, ex: 3, resume: 'v3' },
  { c: 'Groww', r: 'Senior Frontend Engineer', p: 'referral', m: 'referral', s: 'interviewing', ago: 20, steps: [['screening', 16], ['interviewing', 10]], loc: 'Bengaluru', wm: 'onsite', sal: [L(27), L(35)], pr: 3, ex: 4, tags: ['fintech'], resume: 'v3' },
  { c: 'BrowserStack', r: 'Frontend Engineer II', p: 'company_site', m: 'company_portal', s: 'offer', ago: 40, steps: [['screening', 34], ['interviewing', 27], ['offer', 4]], loc: 'Mumbai', wm: 'hybrid', sal: [L(24), L(30)], pr: 3, ex: 4, resume: 'v3', next: ['Negotiate & decide on offer', 2] },
  { c: 'Freshworks', r: 'Senior Software Engineer (UI)', p: 'referral', m: 'referral', s: 'offer', ago: 45, steps: [['screening', 41], ['interviewing', 33], ['offer', 9]], loc: 'Chennai', wm: 'hybrid', sal: [L(22), L(28)], pr: 2, ex: 3, resume: 'v2' },
  { c: 'Flipkart', r: 'UI Engineer II', p: 'linkedin', m: 'easy_apply', s: 'applied', ago: 5, loc: 'Bengaluru', wm: 'hybrid', sal: [L(24), L(30)], pr: 2, ex: 4, resume: 'v3', next: ['Reply to Ananya with availability', 0] },
  { c: 'Zerodha', r: 'Frontend Developer', p: 'company_site', m: 'company_portal', s: 'applied', ago: 9, loc: 'Bengaluru', wm: 'onsite', sal: [L(20), L(26)], pr: 2, ex: 4, resume: 'v3' },
  { c: 'PhonePe', r: 'Senior Frontend Engineer', p: 'naukri', m: 'easy_apply', s: 'applied', ago: 3, loc: 'Bengaluru', wm: 'onsite', sal: [L(26), L(34)], pr: 3, ex: 4, resume: 'v3' },
  { c: 'Microsoft', r: 'Software Engineer II', p: 'company_site', m: 'company_portal', s: 'applied', ago: 2, loc: 'Hyderabad', wm: 'hybrid', sal: [L(30), L(40)], pr: 3, ex: 5, tags: ['dream'], resume: 'v3' },
  { c: 'Uber', r: 'Frontend Engineer II', p: 'linkedin', m: 'easy_apply', s: 'applied', ago: 13, loc: 'Bengaluru', wm: 'hybrid', sal: [L(30), L(40)], pr: 3, ex: 4, resume: 'v2' },
  { c: 'Zepto', r: 'SDE-2 Frontend', p: 'cutshort', m: 'easy_apply', s: 'applied', ago: 8, loc: 'Mumbai', wm: 'onsite', sal: [L(25), L(32)], pr: 1, ex: 2, resume: 'v2' },
  { c: 'Juspay', r: 'Product Engineer (Frontend)', p: 'linkedin', m: 'cold_email', s: 'applied', ago: 6, loc: 'Bengaluru', wm: 'onsite', sal: [L(20), L(28)], pr: 2, ex: 3, resume: 'v3' },
  { c: 'Stripe', r: 'Frontend Engineer', p: 'company_site', m: 'company_portal', s: 'applied', ago: 4, loc: 'Remote (India)', wm: 'remote', pr: 3, ex: 5, tags: ['dream', 'remote'], resume: 'v3' },
  { c: 'Figma', r: 'Software Engineer, Product', p: 'linkedin', m: 'easy_apply', s: 'applied', ago: 1, loc: 'Remote', wm: 'remote', pr: 3, ex: 5, tags: ['dream', 'remote'], resume: 'v3' },
  { c: 'Zoho', r: 'Member Technical Staff (UI)', p: 'naukri', m: 'easy_apply', s: 'applied', ago: 10, loc: 'Chennai', wm: 'onsite', sal: [L(14), L(20)], pr: 1, ex: 2, resume: 'v2', next: ['', -999] },
  { c: 'Chargebee', r: 'Senior Frontend Engineer', p: 'instahyre', m: 'easy_apply', s: 'applied', ago: 16, loc: 'Chennai', wm: 'hybrid', sal: [L(22), L(28)], pr: 1, ex: 3, resume: 'v2', next: ['', -999] },
  { c: 'Amazon', r: 'Frontend Engineer II', p: 'linkedin', m: 'easy_apply', s: 'applied', ago: 7, loc: 'Bengaluru', wm: 'onsite', sal: [L(30), L(42)], pr: 3, ex: 4, resume: 'v3' },
  { c: 'Google', r: 'Software Engineer III, Front End', p: 'company_site', m: 'company_portal', s: 'applied', ago: 0, loc: 'Bengaluru', wm: 'hybrid', pr: 3, ex: 5, tags: ['dream'], resume: 'v3' },
  { c: 'Notion', r: 'Software Engineer, Frontend', p: 'linkedin', m: 'easy_apply', s: 'applied', ago: 2, loc: 'Remote', wm: 'remote', pr: 2, ex: 5, tags: ['remote'], resume: 'v3' },
  { c: 'Hasura', r: 'Frontend Engineer', p: 'wellfound', m: 'easy_apply', s: 'applied', ago: 6, loc: 'Bengaluru', wm: 'remote', sal: [L(18), L(26)], pr: 2, ex: 3, resume: 'v3' },
  { c: 'Setu', r: 'Frontend Engineer', p: 'cutshort', m: 'easy_apply', s: 'applied', ago: 1, loc: 'Bengaluru', wm: 'hybrid', sal: [L(18), L(24)], pr: 1, ex: 3, resume: 'v3' },
  { c: 'Paytm', r: 'Frontend Developer', p: 'naukri', m: 'easy_apply', s: 'applied', ago: 26, loc: 'Noida', wm: 'onsite', sal: [L(16), L(22)], pr: 1, ex: 2, resume: 'v2', next: ['', -999] },
  { c: 'Ola', r: 'Senior UI Developer', p: 'naukri', m: 'easy_apply', s: 'applied', ago: 29, loc: 'Bengaluru', wm: 'onsite', pr: 1, ex: 2, resume: 'v2', next: ['', -999] },
  { c: 'ShareChat', r: 'Frontend Engineer', p: 'linkedin', m: 'easy_apply', s: 'applied', ago: 23, loc: 'Bengaluru', wm: 'hybrid', pr: 1, ex: 3, resume: 'v2', next: ['', -999] },
  { c: 'Nykaa', r: 'Frontend Developer', p: 'naukri', m: 'easy_apply', s: 'ghosted', ago: 48, steps: [['ghosted', 20]], loc: 'Mumbai', pr: 1, resume: 'v2' },
  { c: 'Dream11', r: 'UI Engineer', p: 'linkedin', m: 'easy_apply', s: 'ghosted', ago: 52, steps: [['ghosted', 25]], loc: 'Mumbai', pr: 2, resume: 'v2' },
  { c: 'InMobi', r: 'Frontend Engineer', p: 'indeed', m: 'easy_apply', s: 'ghosted', ago: 44, steps: [['ghosted', 18]], loc: 'Bengaluru', pr: 1, resume: 'v2' },
  { c: 'Unacademy', r: 'SDE-2 Frontend', p: 'naukri', m: 'easy_apply', s: 'ghosted', ago: 38, steps: [['ghosted', 12]], loc: 'Bengaluru', pr: 1, resume: 'v2' },
  { c: 'Urban Company', r: 'Frontend Engineer', p: 'linkedin', m: 'easy_apply', s: 'ghosted', ago: 35, steps: [['ghosted', 10]], loc: 'Gurugram', pr: 1, resume: 'v2' },
  { c: 'Myntra', r: 'SDE-2 (UI)', p: 'naukri', m: 'easy_apply', s: 'rejected', ago: 33, steps: [['rejected', 26]], loc: 'Bengaluru', pr: 2, reason: 'No response / auto-rejection', resume: 'v2' },
  { c: 'Sprinklr', r: 'Product Engineer', p: 'linkedin', m: 'easy_apply', s: 'rejected', ago: 40, steps: [['rejected', 35]], loc: 'Gurugram', pr: 1, reason: 'Skills mismatch', resume: 'v2' },
  { c: 'Adobe', r: 'Frontend Engineer', p: 'company_site', m: 'company_portal', s: 'rejected', ago: 50, steps: [['screening', 44], ['rejected', 40]], loc: 'Noida', pr: 2, reason: 'Not enough experience', resume: 'v2' },
  { c: 'Salesforce', r: 'MTS (Frontend)', p: 'linkedin', m: 'easy_apply', s: 'rejected', ago: 42, steps: [['screening', 37], ['interviewing', 32], ['rejected', 25]], loc: 'Hyderabad', pr: 2, reason: 'Failed technical round', resume: 'v2' },
  { c: 'Intuit', r: 'Software Engineer 2', p: 'referral', m: 'referral', s: 'rejected', ago: 55, steps: [['screening', 50], ['interviewing', 45], ['rejected', 36]], loc: 'Bengaluru', pr: 3, reason: 'Position filled / on hold', resume: 'v2' },
  { c: 'Walmart Global Tech', r: 'SDE-2 Frontend', p: 'naukri', m: 'easy_apply', s: 'rejected', ago: 47, steps: [['rejected', 41]], loc: 'Bengaluru', pr: 1, reason: 'No response / auto-rejection', resume: 'v2' },
  { c: 'Zomato', r: 'SDE-2 Frontend', p: 'naukri', m: 'easy_apply', s: 'rejected', ago: 31, steps: [['rejected', 27]], loc: 'Gurugram', pr: 2, reason: 'Skills mismatch', resume: 'v2' },
  { c: 'Canva', r: 'Frontend Engineer', p: 'linkedin', m: 'easy_apply', s: 'rejected', ago: 36, steps: [['assessment', 30], ['rejected', 26]], loc: 'Remote', pr: 2, reason: 'Failed assessment', resume: 'v2' },
  { c: 'upGrad', r: 'Frontend Engineer', p: 'linkedin', m: 'easy_apply', s: 'withdrawn', ago: 28, steps: [['screening', 24], ['withdrawn', 22]], loc: 'Mumbai', pr: 1, reason: 'Salary mismatch', resume: 'v2' },
  { c: 'Vercel', r: 'Software Engineer, Frontend', p: 'linkedin', m: 'easy_apply', s: 'wishlist', ago: 6, loc: 'Remote', wm: 'remote', pr: 3, ex: 5, tags: ['remote', 'dream'] },
  { c: 'Cloudflare', r: 'Frontend Engineer', p: 'company_site', m: 'company_portal', s: 'wishlist', ago: 1, loc: 'Bengaluru', wm: 'hybrid', pr: 2, ex: 4 },
  { c: 'Rippling', r: 'Frontend Engineer', p: 'linkedin', m: 'easy_apply', s: 'wishlist', ago: 8, loc: 'Bengaluru', wm: 'hybrid', pr: 2, ex: 4, deadline: 3 },
  { c: 'slice', r: 'Senior Frontend Engineer', p: 'instahyre', m: 'easy_apply', s: 'wishlist', ago: 2, loc: 'Bengaluru', wm: 'onsite', pr: 2, ex: 3 },
  { c: 'Jar', r: 'Frontend Engineer', p: 'wellfound', m: 'easy_apply', s: 'wishlist', ago: 7, loc: 'Bengaluru', wm: 'onsite', pr: 1, ex: 3 },
  { c: 'Atlan', r: 'Frontend Engineer', p: 'wellfound', m: 'easy_apply', s: 'wishlist', ago: 0, loc: 'Remote', wm: 'remote', pr: 2, ex: 4, tags: ['remote'] },
];

const JD_RAZORPAY = `About the role
We're looking for a Senior Frontend Engineer to join our Checkout team. You'll build fast, accessible and delightful payment experiences used by millions of customers.

What you'll do
- Own large features end-to-end using React, TypeScript and Redux
- Drive web performance: Core Web Vitals, code splitting, caching and CDN strategies
- Contribute to our design systems and component library (Storybook)
- Write robust unit testing with Jest and end-to-end tests with Cypress
- Collaborate cross-functional with product, design and backend teams
- Mentor engineers and lead code review practices

What we're looking for
- 4+ years building production web apps with React and TypeScript
- Deep knowledge of JavaScript, HTML, CSS and browser internals
- Experience with GraphQL or REST APIs, Node.js is a plus
- Strong understanding of accessibility and responsive design
- Experience with micro-frontends, webpack or Vite
- Experience in fintech / payments is a big plus
- Excellent communication and ownership`;

/* ───────────────────────── Contacts & touches ───────────────────────── */

type Touch = [daysAgo: number, kind: InteractionKind, channel: Channel, templateId: string | undefined, outcome: InteractionOutcome, replyAfter?: number];

interface ContactSpec {
  n: string;
  t: string;
  c: string;
  rel: Relationship;
  st: ContactStage;
  w: Warmth;
  pr?: Priority;
  app?: string;
  src?: string;
  cg?: string;
  mut?: string;
  email?: boolean;
  notes?: string;
  follow?: number;
  touches?: Touch[];
}

const CONTACTS: ContactSpec[] = [
  { n: 'Priya Sharma', t: 'Senior Software Engineer', c: 'Razorpay', rel: 'employee', st: 'referred', w: 'hot', pr: 3, app: 'Razorpay', src: 'LinkedIn search', cg: 'We both work on design systems — loved her React India talk', notes: 'Referred me for Senior FE. Offered to share interview tips for the system design round.', touches: [[28, 'comment', 'linkedin', undefined, 'no_reply'], [27, 'connection_request', 'linkedin', 'tpl-conn-peer', 'accepted'], [26, 'referral_request', 'linkedin', 'tpl-dm-referral', 'positive', 1], [24, 'thank_you', 'linkedin', 'tpl-ty-referral', 'replied', 0]] },
  { n: 'Rahul Verma', t: 'Engineering Manager, Web', c: 'Swiggy', rel: 'hiring_manager', st: 'engaged', w: 'warm', pr: 3, app: 'Swiggy', src: 'LinkedIn post', cg: 'Commented on his post about micro-frontends', follow: 3, touches: [[22, 'connection_request', 'linkedin', 'tpl-conn-hm', 'accepted'], [21, 'message', 'linkedin', 'tpl-dm-advice', 'positive', 2], [15, 'call', 'phone', undefined, 'positive']] },
  { n: 'Ananya Iyer', t: 'Technical Recruiter', c: 'Flipkart', rel: 'recruiter', st: 'replied', w: 'warm', pr: 2, app: 'Flipkart', src: 'LinkedIn search', email: true, notes: 'Asked for my availability for a screening call this week.', follow: 0, touches: [[5, 'connection_request', 'linkedin', 'tpl-conn-recruiter', 'accepted'], [4, 'message', 'linkedin', 'tpl-dm-recruiter', 'replied', 2]] },
  { n: 'Arjun Mehta', t: 'Talent Acquisition Partner', c: 'CRED', rel: 'recruiter', st: 'contacted', w: 'cold', pr: 2, app: 'CRED', src: 'LinkedIn search', email: true, touches: [[1, 'connection_request', 'linkedin', 'tpl-conn-recruiter', 'awaiting']] },
  { n: 'Sneha Reddy', t: 'Staff Engineer', c: 'Atlassian', rel: 'alumni', st: 'target', w: 'cold', pr: 3, app: 'Atlassian', src: 'Alumni search', cg: 'NIT Trichy alum (2016)' },
  { n: 'Vikram Nair', t: 'Founder & CEO', c: 'Lumen Labs', rel: 'founder', st: 'contacted', w: 'cold', pr: 2, src: 'X (Twitter)', cg: 'Tweeted that they are hiring their first frontend engineer', touches: [[6, 'message', 'twitter', 'tpl-x-founder', 'awaiting']] },
  { n: 'Kavya Menon', t: 'Frontend Lead', c: 'Zerodha', rel: 'hiring_manager', st: 'no_response', w: 'cold', pr: 2, app: 'Zerodha', touches: [[24, 'comment', 'linkedin', undefined, 'no_reply'], [23, 'connection_request', 'linkedin', 'tpl-conn-hm', 'no_reply'], [20, 'message', 'linkedin', 'tpl-dm-referral', 'no_reply'], [15, 'follow_up', 'linkedin', 'tpl-fu-bump', 'no_reply'], [8, 'follow_up', 'linkedin', 'tpl-fu-breakup', 'no_reply']] },
  { n: 'Rohan Gupta', t: 'SDE-3', c: 'Amazon', rel: 'friend', st: 'network', w: 'hot', pr: 3, src: 'College friend', cg: 'College roommate', touches: [[60, 'message', 'whatsapp', undefined, 'replied', 0]] },
  { n: 'Neha Kapoor', t: 'HR Business Partner', c: 'Meesho', rel: 'recruiter', st: 'contacted', w: 'cold', pr: 2, app: 'Meesho', email: true, touches: [[7, 'connection_request', 'linkedin', 'tpl-conn-recruiter', 'accepted'], [6, 'email', 'email', 'tpl-email-recruiter', 'awaiting']] },
  { n: 'Aditya Rao', t: 'Senior Technical Recruiter', c: 'Microsoft', rel: 'recruiter', st: 'target', w: 'cold', pr: 3, app: 'Microsoft', src: 'LinkedIn “hiring” post' },
  { n: 'Ishita Banerjee', t: 'Product Manager', c: 'Groww', rel: 'employee', st: 'referred', w: 'warm', pr: 2, app: 'Groww', mut: 'Rohan Gupta', touches: [[26, 'connection_request', 'linkedin', 'tpl-conn-peer', 'accepted'], [25, 'message', 'linkedin', 'tpl-dm-advice', 'positive', 1], [22, 'meeting', 'other', undefined, 'positive'], [21, 'referral_request', 'linkedin', 'tpl-dm-referral', 'positive', 0]] },
  { n: 'Karan Malhotra', t: 'Engineering Manager', c: 'PhonePe', rel: 'hiring_manager', st: 'contacted', w: 'cold', pr: 3, app: 'PhonePe', email: true, touches: [[3, 'email', 'email', 'tpl-email-hm', 'awaiting']] },
  { n: 'Meera Pillai', t: 'Talent Partner', c: 'Postman', rel: 'recruiter', st: 'engaged', w: 'warm', pr: 3, app: 'Postman', email: true, touches: [[8, 'connection_request', 'linkedin', 'tpl-conn-recruiter', 'accepted'], [7, 'email', 'email', 'tpl-email-recruiter', 'positive', 2]] },
  { n: 'Siddharth Jain', t: 'SDE-2', c: 'Uber', rel: 'alumni', st: 'target', w: 'cold', pr: 2, app: 'Uber', src: 'Alumni search', cg: 'NIT Trichy alum (2019)' },
  { n: 'Pooja Desai', t: 'Recruiter', c: 'BrowserStack', rel: 'recruiter', st: 'engaged', w: 'warm', pr: 2, app: 'BrowserStack', email: true, touches: [[38, 'connection_request', 'linkedin', 'tpl-conn-recruiter', 'accepted'], [37, 'email', 'email', 'tpl-email-recruiter', 'positive', 3]] },
  { n: 'Emily Chen', t: 'Engineering Manager', c: 'Stripe', rel: 'hiring_manager', st: 'target', w: 'cold', pr: 3, app: 'Stripe', src: 'Company blog', cg: 'Wrote a great post on Stripe’s frontend infra' },
  { n: 'David Kim', t: 'Technical Recruiter', c: 'Figma', rel: 'recruiter', st: 'contacted', w: 'cold', pr: 3, app: 'Figma', email: true, touches: [[1, 'connection_request', 'linkedin', 'tpl-conn-recruiter', 'awaiting']] },
  { n: 'Tanvi Kulkarni', t: 'Frontend Engineer', c: 'Notion', rel: 'engineer', st: 'replied', w: 'warm', pr: 2, follow: 1, touches: [[9, 'connection_request', 'linkedin', 'tpl-conn-peer', 'accepted'], [8, 'message', 'linkedin', 'tpl-dm-advice', 'replied', 1]] },
  { n: 'Aman Singh', t: 'Tech Lead', c: 'Zepto', rel: 'hiring_manager', st: 'target', w: 'cold', pr: 1, app: 'Zepto' },
  { n: 'Riya Chatterjee', t: 'Talent Acquisition Lead', c: 'Chargebee', rel: 'recruiter', st: 'no_response', w: 'cold', pr: 1, app: 'Chargebee', email: true, touches: [[20, 'connection_request', 'linkedin', 'tpl-conn-recruiter', 'no_reply'], [19, 'email', 'email', 'tpl-email-recruiter', 'no_reply'], [13, 'follow_up', 'email', 'tpl-fu-application', 'no_reply'], [6, 'follow_up', 'email', 'tpl-fu-breakup', 'no_reply']] },
  { n: 'Nikhil Bhatia', t: 'Engineering Manager', c: 'Juspay', rel: 'hiring_manager', st: 'contacted', w: 'cold', pr: 2, app: 'Juspay', email: true, touches: [[10, 'email', 'email', 'tpl-email-hm', 'no_reply'], [6, 'follow_up', 'email', 'tpl-fu-bump', 'awaiting']] },
  { n: 'Shreya Ghosh', t: 'Senior Software Engineer', c: 'Google', rel: 'friend', st: 'network', w: 'hot', pr: 3, cg: 'Ex-colleague — we shipped the checkout revamp together', touches: [[45, 'message', 'linkedin', undefined, 'replied', 1]] },
  { n: 'Varun Khanna', t: 'Recruiter', c: 'Dream11', rel: 'recruiter', st: 'closed', w: 'cold', pr: 1, email: true, touches: [[50, 'connection_request', 'linkedin', 'tpl-conn-recruiter', 'accepted'], [49, 'email', 'email', 'tpl-email-recruiter', 'negative', 4]] },
  { n: 'Divya Krishnan', t: 'Staff Engineer', c: 'Freshworks', rel: 'employee', st: 'referred', w: 'hot', pr: 2, app: 'Freshworks', touches: [[48, 'connection_request', 'linkedin', 'tpl-conn-peer', 'accepted'], [47, 'referral_request', 'linkedin', 'tpl-dm-referral', 'positive', 1], [46, 'email', 'email', 'tpl-referral-blurb', 'replied', 0]] },
  { n: 'Harsh Vardhan', t: 'Principal Engineer', c: 'Salesforce', rel: 'mentor', st: 'network', w: 'warm', pr: 2, notes: 'Monthly mentorship calls. Great for mock system design interviews.', touches: [[35, 'meeting', 'other', undefined, 'positive']] },
  { n: 'Lakshmi Narayanan', t: 'Engineering Manager', c: 'Zoho', rel: 'hiring_manager', st: 'target', w: 'cold', pr: 1, app: 'Zoho' },
  { n: 'Ankit Sharma', t: 'Frontend Engineer', c: 'Meesho', rel: 'engineer', st: 'replied', w: 'warm', pr: 2, touches: [[12, 'connection_request', 'linkedin', 'tpl-conn-peer', 'accepted'], [11, 'message', 'linkedin', 'tpl-dm-advice', 'replied', 1]] },
  { n: 'Pallavi Joshi', t: 'Engineering Manager', c: 'CRED', rel: 'hiring_manager', st: 'no_response', w: 'cold', pr: 2, email: true, touches: [[14, 'email', 'email', 'tpl-email-hm', 'no_reply'], [10, 'follow_up', 'email', 'tpl-fu-bump', 'no_reply']] },
  { n: 'Manish Tiwari', t: 'Recruiter', c: 'Paytm', rel: 'recruiter', st: 'no_response', w: 'cold', pr: 1, email: true, touches: [[25, 'email', 'email', 'tpl-email-recruiter', 'no_reply'], [18, 'follow_up', 'email', 'tpl-fu-application', 'no_reply']] },
  { n: 'Sana Qureshi', t: 'Senior Engineer', c: 'Zomato', rel: 'engineer', st: 'contacted', w: 'cold', pr: 1, touches: [[4, 'connection_request', 'linkedin', 'tpl-conn-peer', 'awaiting']] },
  { n: 'Deepak Menon', t: 'Talent Acquisition', c: 'Ola', rel: 'recruiter', st: 'no_response', w: 'cold', pr: 1, email: true, touches: [[27, 'email', 'email', 'tpl-email-recruiter', 'no_reply']] },
];

/* ───────────────────────── Interviews ───────────────────────── */

type IvSpec = [company: string, round: string, type: InterviewType, when: string, outcome: InterviewOutcome, rating?: number, done?: number, interviewers?: string, notes?: string];

/* ───────────────────────── Loader ───────────────────────── */

export async function loadSampleData(): Promise<void> {
  const now = new Date().toISOString();
  const S = { isSample: true, createdAt: now, updatedAt: now };

  const companies: Company[] = COMPANIES.map(([name, domain, industry, location, tier]) => ({
    id: uid(),
    name,
    website: domain ? `https://${domain}` : undefined,
    careersUrl: domain ? `https://${domain}/careers` : undefined,
    industry,
    location,
    tier,
    tags: [],
    ...S,
  }));

  const docV3: DocumentFile = { id: uid(), name: 'Resume v3 — Frontend (metrics-heavy)', kind: 'resume', targetRole: 'Senior Frontend Engineer', notes: 'Every bullet has a number. Leads with performance & design-system wins.', isDefault: true, ...S };
  const docV2: DocumentFile = { id: uid(), name: 'Resume v2 — Full-stack (generic)', kind: 'resume', targetRole: 'Full-stack Developer', notes: 'Older, responsibilities-focused version.', ...S };
  const docCL: DocumentFile = { id: uid(), name: 'Cover letter — product companies', kind: 'cover_letter', notes: 'Short 3-paragraph template; swap the middle paragraph per company.', ...S };

  const appByCompany = new Map<string, Application>();
  const applications: Application[] = APPS.map((a) => {
    const created = a.s === 'wishlist' ? ago(a.ago, 9 + (a.ago % 8), 15) : ago(a.ago, 9 + (a.ago % 9), (a.ago * 7) % 60);
    const appliedAt = a.s === 'wishlist' ? undefined : created;
    const history: Application['history'] = a.s === 'wishlist' ? [{ stage: 'wishlist', at: created }] : [{ stage: 'applied', at: created }];
    for (const [stage, d] of a.steps ?? []) history.push({ stage, at: ago(d, 15, 30) });
    const responseStep = (a.steps ?? []).find(([st]) => st !== 'ghosted' && st !== 'withdrawn');
    const closedStage = ['rejected', 'ghosted', 'withdrawn', 'accepted'].includes(a.s);
    const activeHistory = history.filter((h) => !['rejected', 'ghosted', 'withdrawn'].includes(h.stage));
    let nextAction: string | undefined;
    let nextActionAt: string | undefined;
    if (a.next) {
      if (a.next[1] > -999) {
        nextAction = a.next[0];
        nextActionAt = at(a.next[1], 9);
      }
    } else if (a.s === 'applied') {
      nextAction = 'Follow up if no response';
      nextActionAt = at(-a.ago + 7, 9);
    }
    const app: Application = {
      id: uid(),
      company: a.c,
      role: a.r,
      url: `https://www.example.com/jobs/${companyKey(a.c).replace(/\s+/g, '-')}-${a.r.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      platform: a.p,
      method: a.m,
      location: a.loc,
      workMode: a.wm,
      jobType: 'full_time',
      salaryMin: a.sal?.[0],
      salaryMax: a.sal?.[1],
      currency: 'INR',
      status: a.s,
      priority: a.pr ?? 2,
      excitement: a.ex,
      appliedAt,
      deadline: a.deadline !== undefined ? at(a.deadline, 23, 59) : undefined,
      respondedAt: responseStep ? ago(responseStep[1], 15, 30) : undefined,
      closedAt: closedStage ? history[history.length - 1].at : undefined,
      closedFromStage: closedStage && a.s !== 'accepted' ? activeHistory[activeHistory.length - 1]?.stage : undefined,
      rejectionReason: a.reason,
      resumeId: a.resume === 'v3' ? docV3.id : a.resume === 'v2' ? docV2.id : undefined,
      coverLetter: a.m === 'company_portal',
      contactIds: [],
      jobDescription: a.c === 'Razorpay' ? JD_RAZORPAY : undefined,
      notes: a.notes,
      tags: a.tags ?? [],
      nextAction,
      nextActionAt,
      history,
      ...S,
      createdAt: created,
      updatedAt: history[history.length - 1].at,
    };
    appByCompany.set(a.c, app);
    return app;
  });

  const contacts: Contact[] = [];
  const interactions: Interaction[] = [];
  const contactByName = new Map<string, Contact>();
  for (const cs of CONTACTS) {
    const app = cs.app ? appByCompany.get(cs.app) : undefined;
    const slug = cs.n.toLowerCase().replace(/[^a-z]+/g, '-');
    const company = companies.find((c) => c.name === cs.c);
    const domain = company?.website?.replace('https://', '');
    const touches = cs.touches ?? [];
    const lastTouch = touches.length ? Math.min(...touches.map((t) => t[0] - (t[5] ?? 0) * (t[4] !== 'awaiting' && t[4] !== 'no_reply' && t[4] !== 'accepted' ? 1 : 0))) : undefined;
    const contact: Contact = {
      id: uid(),
      name: cs.n,
      title: cs.t,
      company: cs.c,
      relationship: cs.rel,
      stage: cs.st,
      warmth: cs.w,
      priority: cs.pr ?? 2,
      linkedin: `https://www.linkedin.com/in/${slug}`,
      email: cs.email && domain ? `${cs.n.split(' ')[0].toLowerCase()}.${cs.n.split(' ').slice(-1)[0].toLowerCase()}@${domain}` : undefined,
      location: company?.location,
      source: cs.src,
      commonGround: cs.cg,
      mutualConnection: cs.mut,
      notes: cs.notes,
      tags: [],
      applicationIds: app ? [app.id] : [],
      lastContactedAt: lastTouch !== undefined ? ago(lastTouch, 11) : undefined,
      nextFollowUpAt: cs.follow !== undefined ? at(cs.follow, 9) : undefined,
      ...S,
      createdAt: ago((touches[0]?.[0] ?? 3) + 1, 9),
    };
    if (app) {
      app.contactIds.push(contact.id);
      if (['referred'].includes(cs.st) && app.method === 'referral') app.referrerId = contact.id;
    }
    contacts.push(contact);
    contactByName.set(cs.n, contact);
    for (const [d, kind, channel, templateId, outcome, replyAfter] of touches) {
      const hour = 9 + ((d * 3) % 9);
      const replied = outcome === 'replied' || outcome === 'positive' || outcome === 'negative';
      interactions.push({
        id: uid(),
        contactId: contact.id,
        applicationId: app?.id,
        date: ago(d, hour, 20),
        channel,
        kind,
        direction: 'out',
        templateId,
        outcome,
        repliedAt: replied ? ago(d - (replyAfter ?? 1), hour + 2) : undefined,
        content: undefined,
        isSample: true,
        createdAt: ago(d, hour, 20),
      });
      if (replied && kind !== 'call' && kind !== 'meeting') {
        interactions.push({
          id: uid(),
          contactId: contact.id,
          applicationId: app?.id,
          date: ago(d - (replyAfter ?? 1), Math.min(hour + 2, 22), 5),
          channel,
          kind: 'reply',
          direction: 'in',
          outcome: 'replied',
          content: outcome === 'positive' ? 'Happy to help — let’s chat!' : outcome === 'negative' ? 'Thanks, but we’re not hiring for this right now.' : 'Thanks for reaching out!',
          isSample: true,
          createdAt: ago(d - (replyAfter ?? 1), Math.min(hour + 2, 22), 5),
        });
      }
    }
  }

  const enroll = (name: string, sequenceId: string, stepIndex: number, startedAgo: number, dueOffset: number | null, status: Enrollment['status'] = 'active'): Enrollment => {
    const c = contactByName.get(name)!;
    return {
      id: uid(),
      sequenceId,
      contactId: c.id,
      applicationId: c.applicationIds[0],
      status,
      stepIndex,
      startedAt: ago(startedAgo, 9),
      nextDueAt: dueOffset === null ? undefined : at(dueOffset, 9),
      lastStepAt: stepIndex > 0 ? ago(Math.max(0, startedAgo - 1), 11) : undefined,
      ...S,
    };
  };
  const enrollments: Enrollment[] = [
    enroll('Arjun Mehta', 'seq-recruiter', 1, 1, 0),
    enroll('Karan Malhotra', 'seq-hm', 1, 3, 0),
    enroll('Nikhil Bhatia', 'seq-hm', 2, 10, -1),
    enroll('David Kim', 'seq-recruiter', 1, 1, 1),
    enroll('Neha Kapoor', 'seq-recruiter', 2, 7, 0),
    enroll('Siddharth Jain', 'seq-referral', 0, 0, 0),
    enroll('Emily Chen', 'seq-advice', 0, 0, 0),
    enroll('Kavya Menon', 'seq-referral', 5, 24, null, 'completed'),
    enroll('Riya Chatterjee', 'seq-recruiter', 4, 20, null, 'completed'),
    enroll('Meera Pillai', 'seq-recruiter', 2, 8, null, 'replied'),
  ];
  // Contacts inside an active sequence don't carry a separate follow-up date.
  for (const e of enrollments) if (e.status === 'active') contactByName.forEach((c) => c.id === e.contactId && (c.nextFollowUpAt = undefined));
  // Sana: one-off connection request 4 days ago → follow-up due today.
  contactByName.get('Sana Qureshi')!.nextFollowUpAt = at(0, 9);

  const ivs: IvSpec[] = [
    ['Razorpay', 'Recruiter screen', 'phone_screen', ago(20, 11), 'passed', 4, 6, 'Neha (TA)'],
    ['Razorpay', 'Technical round 1 — React & JS', 'technical', ago(13, 15), 'passed', 4, 6, 'Arvind K., Senior FE'],
    ['Razorpay', 'System design — frontend architecture', 'system_design', at(2, 11), 'scheduled', undefined, 2, 'Priya’s manager + 1 Staff Engineer', 'Expect: design a payment widget / checkout flow. Talk about performance budgets, error states, a11y, retries & idempotency.'],
    ['Swiggy', 'HR screen', 'phone_screen', ago(25, 12), 'passed', 4, 6],
    ['Swiggy', 'Coding round (DSA + JS)', 'coding', ago(18, 16), 'passed', 3, 6, 'Two SDE-3s'],
    ['Swiggy', 'Hiring manager round', 'hiring_manager', at(1, 15), 'scheduled', undefined, 1, 'Rahul Verma'],
    ['Atlassian', 'Recruiter call', 'phone_screen', addMinutes(new Date(Math.ceil(Date.now() / 1800000) * 1800000), 240).toISOString(), 'scheduled', undefined, 3, 'Atlassian TA'],
    ['Groww', 'Technical round 1', 'technical', ago(10, 14), 'passed', 4, 6],
    ['Groww', 'Machine coding round', 'coding', at(5, 14), 'scheduled', undefined, 0],
    ['BrowserStack', 'Recruiter screen', 'phone_screen', ago(34, 11), 'passed', 4, 6],
    ['BrowserStack', 'Technical round 1', 'technical', ago(27, 15), 'passed', 4, 6],
    ['BrowserStack', 'Technical round 2', 'technical', ago(20, 15), 'passed', 3, 6],
    ['BrowserStack', 'Hiring manager', 'hiring_manager', ago(12, 17), 'passed', 5, 6],
    ['Freshworks', 'Recruiter screen', 'phone_screen', ago(41, 10), 'passed', 4, 6],
    ['Freshworks', 'Technical round', 'technical', ago(33, 14), 'passed', 4, 6],
    ['Freshworks', 'System design', 'system_design', ago(25, 14), 'passed', 3, 6],
    ['Freshworks', 'Hiring manager', 'hiring_manager', ago(18, 16), 'passed', 4, 6],
    ['Salesforce', 'Recruiter screen', 'phone_screen', ago(37, 11), 'passed', 4, 6],
    ['Salesforce', 'Technical round', 'technical', ago(32, 15), 'failed', 2, 4, undefined, 'Struggled with a tricky closure/event-loop question. Revise JS internals.'],
    ['Intuit', 'Recruiter screen', 'phone_screen', ago(50, 11), 'passed', 4, 6],
    ['Intuit', 'Technical round', 'technical', ago(45, 15), 'passed', 4, 6],
    ['Intuit', 'Onsite loop', 'onsite', ago(40, 10), 'failed', 3, 6],
    ['Postman', 'Recruiter screen', 'phone_screen', ago(1, 16), 'awaiting', 4, 5, 'Meera Pillai'],
    ['Canva', 'Take-home assignment', 'take_home', ago(30, 10), 'failed', 3, 6],
    ['Adobe', 'Recruiter screen', 'phone_screen', ago(44, 12), 'failed', 3, 6],
  ];
  const interviews: Interview[] = ivs.map(([company, round, type, when, outcome, rating, done, interviewers, notes]) => {
    const app = appByCompany.get(company)!;
    return {
      id: uid(),
      applicationId: app.id,
      round,
      type,
      scheduledAt: when,
      durationMins: type === 'take_home' ? 180 : type === 'onsite' ? 240 : type === 'phone_screen' ? 30 : 60,
      mode: type === 'onsite' ? 'onsite' : type === 'phone_screen' ? 'phone' : 'video',
      location: type === 'onsite' ? `${app.company} office, ${app.location}` : type === 'phone_screen' ? undefined : 'https://meet.google.com/abc-defg-hij',
      interviewers,
      prepNotes: notes && outcome === 'scheduled' ? notes : undefined,
      reflection: notes && outcome !== 'scheduled' ? notes : undefined,
      selfRating: rating,
      outcome,
      thankYouSent: outcome === 'passed' || outcome === 'failed',
      checklist: DEFAULT_CHECKLIST.map((text, i) => ({ id: uid(), text, done: i < (done ?? 0) })),
      ...S,
    };
  });

  const tasks: Task[] = [
    { id: uid(), title: 'Finish Meesho online assessment (90 min)', dueAt: at(0, 18), done: false, priority: 3, applicationId: appByCompany.get('Meesho')!.id, ...S },
    { id: uid(), title: 'Submit CRED take-home assignment', dueAt: at(2, 20), done: false, priority: 3, applicationId: appByCompany.get('CRED')!.id, notes: 'Build a small credit-card dashboard. Focus on a11y + tests + README.', ...S },
    { id: uid(), title: 'Ask Rohan for an Amazon referral', dueAt: at(0, 12), done: false, priority: 2, contactId: contactByName.get('Rohan Gupta')!.id, applicationId: appByCompany.get('Amazon')!.id, ...S },
    { id: uid(), title: 'Refresh Naukri profile & resume headline', dueAt: at(0, 10), done: false, priority: 2, notes: 'Recently updated profiles tend to rank higher in recruiter searches — refresh a line every few days.', ...S },
    { id: uid(), title: 'Research Razorpay Checkout & Payment Links', dueAt: at(1, 19), done: false, priority: 2, applicationId: appByCompany.get('Razorpay')!.id, ...S },
    { id: uid(), title: 'Prepare negotiation numbers for BrowserStack', dueAt: at(1, 11), done: false, priority: 3, applicationId: appByCompany.get('BrowserStack')!.id, ...S },
    { id: uid(), title: 'Rewrite resume summary with 3 quantified wins', dueAt: ago(3, 18), done: true, doneAt: ago(3, 21), priority: 2, ...S },
    { id: uid(), title: 'Mock system design with Harsh', dueAt: ago(2, 19), done: true, doneAt: ago(2, 20), priority: 2, contactId: contactByName.get('Harsh Vardhan')!.id, ...S },
    { id: uid(), title: 'Write a STAR story about the sale-day incident', done: false, priority: 1, ...S },
  ];

  const stories: StarStory[] = [
    { id: uid(), title: 'Cut checkout load time by 40%', competencies: ['Impact & results', 'Technical depth', 'Ownership'], situation: 'Checkout page took 4.8s to become interactive on mid-range Android phones; drop-off was rising.', task: 'Own the performance initiative and hit a sub-3s TTI target before the festive sale.', action: 'Profiled with Lighthouse + RUM, split the bundle by route, lazy-loaded the payment SDK, moved fonts to swap and added an edge cache for config.', result: 'TTI fell 40% (4.8s → 2.9s); checkout conversion improved 6% and the approach became the team playbook.', ...S },
    { id: uid(), title: 'Led migration to a shared design system', competencies: ['Leadership', 'Influence', 'Teamwork'], situation: 'Five product teams were maintaining divergent UI components with inconsistent accessibility.', task: 'Drive adoption of a shared component library without formal authority.', action: 'Built an RFC, ran office hours, created codemods and shipped the 12 most-used components first with Storybook docs.', result: '4 of 5 teams migrated in one quarter; UI bugs dropped 30% and new screens shipped ~2× faster.', ...S },
    { id: uid(), title: 'Sale-day production incident', competencies: ['Tight deadline', 'Ownership', 'Failure & learning'], situation: 'A cached config bug broke the address form for 8% of users during a peak sale.', task: 'Restore checkout quickly and prevent a repeat.', action: 'Rolled back within 12 minutes, added a feature-flag kill switch, wrote the postmortem and added contract tests for the config.', result: 'Impact contained to 14 minutes; zero repeats in 9 months; the kill-switch pattern was adopted org-wide.', ...S },
    { id: uid(), title: 'Mentored two interns to ship a feature', competencies: ['Mentoring', 'Teamwork'], situation: 'Two interns joined mid-quarter with little React experience.', task: 'Get them productive and ship the saved-cards feature.', action: 'Paired daily for 2 weeks, broke the feature into small PRs and set up a review checklist.', result: 'Feature shipped on time; both interns got return offers.', ...S },
  ];

  const qs: [string, QuestionCategory, number, string | undefined, string | undefined][] = [
    ['Tell me about yourself', 'hr', 4, undefined, 'Frontend engineer with 4 years building fast, accessible products. Most recently cut checkout load time 40% for 2M+ users. Looking for a senior role where I can own performance and design systems.'],
    ['Why are you looking for a change?', 'hr', 3, undefined, 'Looking for larger scope and ownership of frontend architecture — growth, not escape.'],
    ['Tell me about a time you disagreed with a product decision', 'behavioral', 2, undefined, undefined],
    ['How does React reconciliation work? Why do keys matter?', 'technical', 4, 'Razorpay', 'Virtual DOM diffing by type + key; keys keep identity across re-orders so state isn’t mixed up.'],
    ['Design a typeahead / autocomplete component', 'system_design', 3, 'Razorpay', 'Debounce, cancel stale requests, cache results, keyboard nav + ARIA combobox, virtualize long lists.'],
    ['Explain the event loop — microtasks vs macrotasks', 'technical', 4, 'Swiggy', undefined],
    ['How would you speed up a slow page?', 'technical', 5, 'Swiggy', 'Measure first (RUM + Lighthouse), then bundle split, lazy load, image optimization, caching, reduce main-thread work.'],
    ['Tell me about the project you’re most proud of', 'behavioral', 4, undefined, 'Checkout performance initiative (see STAR story).'],
    ['What are your salary expectations?', 'hr', 2, undefined, 'Research-backed range; anchor on the higher end; flexible on structure.'],
    ['Design a news feed with infinite scroll', 'system_design', 2, 'Groww', undefined],
    ['Tell me about a time you failed', 'behavioral', 3, undefined, 'Sale-day incident — focus on ownership and the systemic fix.'],
  ];
  const questions: Question[] = qs.map(([text, category, confidence, company, answer]) => ({
    id: uid(),
    text,
    category,
    confidence,
    company,
    applicationId: company ? appByCompany.get(company)?.id : undefined,
    answer,
    storyId: text.includes('failed') ? stories[2].id : text.includes('proud') ? stories[0].id : undefined,
    ...S,
  }));

  const snippets: Snippet[] = [
    { id: uid(), title: 'Tell me about yourself (60 sec)', category: 'Pitch', body: 'I’m a frontend engineer with 4 years of experience building fast, accessible web products. At my current company I led a checkout performance overhaul that cut load time by 40% for 2M+ monthly users, and I drove adoption of our shared design system across 5 teams. I’m now looking for a senior role where I can own frontend architecture and mentor others.', uses: 6, ...S },
    { id: uid(), title: 'Why are you looking for a change?', category: 'Screening', body: 'I’ve learned a lot in my current role and I’m proud of what we shipped. I’m now looking for larger scope — owning frontend architecture end-to-end — and a product where performance and craft directly drive the business.', uses: 4, ...S },
    { id: uid(), title: 'Notice period', category: 'Screening', body: '30 days, negotiable — I can likely join sooner if needed.', uses: 9, ...S },
    { id: uid(), title: 'Current & expected CTC', category: 'Screening', body: 'Current CTC is 18 LPA (fixed + variable). Based on the scope of the role and market benchmarks, I’m looking for 28–32 LPA, and I’m open to discussing the overall structure.', uses: 7, ...S },
    { id: uid(), title: 'Why this company? (template)', category: 'Pitch', body: 'I’ve been using [product] for [time] and I’m impressed by [specific thing]. The [team/problem] is exactly the kind of challenge I want next — especially [specific detail from the JD or a recent launch].', uses: 3, ...S },
    { id: uid(), title: 'Short note to recruiter (Naukri / Instahyre)', category: 'Messages', body: 'Hi! I’m a frontend engineer (React, TypeScript, performance) with 4 years of experience. I recently cut checkout load time by 40% for 2M+ users. I’d love to be considered for this role — happy to share more details.', uses: 5, ...S },
    { id: uid(), title: 'Relocation & work mode', category: 'Screening', body: 'Based in Bengaluru. Open to hybrid or remote, and open to relocating for the right role.', uses: 2, ...S },
  ];

  const offerFor = (company: string, base: number, bonus: number, equity: number, joining: number, benefits: number, deadline: number, ratings: Offer['ratings'], notes: string): Offer => ({
    id: uid(),
    applicationId: appByCompany.get(company)!.id,
    company,
    role: appByCompany.get(company)!.role,
    currency: 'INR',
    base,
    bonus,
    equity,
    joiningBonus: joining,
    benefits,
    location: appByCompany.get(company)!.location,
    workMode: appByCompany.get(company)!.workMode,
    deadline: at(deadline, 18),
    status: 'pending',
    ratings,
    notes,
    ...S,
  });
  const offers: Offer[] = [
    offerFor('BrowserStack', L(26), L(2.6), L(4), L(2), L(1), 4, { growth: 4, learning: 4, culture: 4, wlb: 3, stability: 4, brand: 4 }, 'Strong engineering culture. Relocation to Mumbai needed. Ask for +2L base.'),
    offerFor('Freshworks', L(24), L(2.4), L(3), L(1.5), L(0.8), 8, { growth: 3, learning: 3, culture: 4, wlb: 5, stability: 5, brand: 4 }, 'Great WLB. Slightly lower comp; listed company stability.'),
  ];

  await db.transaction('rw', [db.companies, db.applications, db.contacts, db.interactions, db.enrollments, db.interviews, db.tasks, db.stories, db.questions, db.snippets, db.documents, db.offers], async () => {
    const existingCompanies = new Set((await db.companies.toArray()).map((c) => companyKey(c.name)));
    await db.companies.bulkAdd(companies.filter((c) => !existingCompanies.has(companyKey(c.name))));
    await db.documents.bulkAdd([docV3, docV2, docCL]);
    await db.applications.bulkAdd(applications);
    await db.contacts.bulkAdd(contacts);
    await db.interactions.bulkAdd(interactions);
    await db.enrollments.bulkAdd(enrollments);
    await db.interviews.bulkAdd(interviews);
    await db.tasks.bulkAdd(tasks);
    await db.stories.bulkAdd(stories);
    await db.questions.bulkAdd(questions);
    await db.snippets.bulkAdd(snippets);
    await db.offers.bulkAdd(offers);
  });

  // Fill empty profile fields so templates render nicely (never overwrite what the user typed).
  const s = await getSettings();
  const p = s.profile;
  const fill = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => (p[k] === undefined || p[k] === '' || (Array.isArray(p[k]) && !(p[k] as unknown[]).length) ? { [k]: v } : {});
  await updateSettings({
    sampleLoaded: true,
    profile: {
      ...fill('name', 'Aarav Kapoor'),
      ...fill('currentRole', 'Frontend Engineer'),
      ...fill('currentCompany', 'ShopKart'),
      ...fill('experienceYears', 4),
      ...fill('skills', ['React', 'TypeScript', 'Web performance', 'Design systems', 'Node.js', 'Accessibility']),
      ...fill('targetRoles', ['Senior Frontend Engineer', 'SDE-2 Frontend']),
      ...fill('targetLocations', ['Bengaluru', 'Remote']),
      ...fill('school', 'NIT Trichy'),
      ...fill('achievement', 'cut checkout load time by 40% for 2M+ monthly users'),
      ...fill('pitch', 'Frontend engineer who makes products fast, accessible and delightful.'),
      ...fill('noticePeriod', '30 days (negotiable)'),
      ...fill('currentCtc', '18 LPA'),
      ...fill('expectedCtc', '28–32 LPA'),
      ...fill('linkedin', 'linkedin.com/in/your-profile'),
      ...fill('portfolio', 'github.com/your-handle'),
      ...fill(
        'resumeText',
        'Frontend Engineer, 4 years. React, TypeScript, JavaScript, Redux, Next.js, HTML, CSS, Tailwind. Web performance (Core Web Vitals), design systems with Storybook, accessibility (WCAG), unit testing with Jest, Cypress. Node.js, REST APIs, GraphQL. Webpack and Vite. Mentoring, code review, cross-functional collaboration with product and design. E-commerce and payments checkout experience.',
      ),
    },
  });
}
