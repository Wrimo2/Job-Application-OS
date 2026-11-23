import { PLATFORMS } from './constants';
import type { ApplyMethod, Profile } from './types';
import { hostOf, slugify, titleCase } from './utils';

/* ───────────────────────── Platform detection ───────────────────────── */

export function detectPlatform(url: string | undefined): string | undefined {
  const host = hostOf(url);
  if (!host) return undefined;
  for (const p of PLATFORMS) {
    if (p.domains.some((d) => host === d || host.endsWith(`.${d}`))) return p.id;
  }
  return 'company_site';
}

export function suggestMethod(platform: string | undefined): ApplyMethod {
  if (!platform) return 'easy_apply';
  if (platform === 'company_site') return 'company_portal';
  if (platform === 'referral') return 'referral';
  if (platform === 'recruiter') return 'recruiter_inbound';
  if (['twitter', 'instagram', 'whatsapp', 'reddit'].includes(platform)) return 'cold_email';
  return 'easy_apply';
}

/** Extracts a company name from common ATS URLs (greenhouse, lever, ashby, workable…). */
export function companyFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(/^https?:/i.test(url) ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '');
    const seg = u.pathname.split('/').filter(Boolean);
    if (/(^|\.)greenhouse\.io$/.test(host) && seg[0] && seg[0] !== 'embed') return titleCase(seg[0]);
    if (/(^|\.)lever\.co$/.test(host) && seg[0]) return titleCase(seg[0]);
    if (/(^|\.)ashbyhq\.com$/.test(host) && seg[0]) return titleCase(decodeURIComponent(seg[0]));
    if (/(^|\.)workable\.com$/.test(host) && seg[0]) return titleCase(seg[0]);
    if (/(^|\.)myworkdayjobs\.com$/.test(host)) return titleCase(host.split('.')[0]);
    if (/(^|\.)smartrecruiters\.com$/.test(host) && seg[0]) return titleCase(seg[0]);
    const isBoard = PLATFORMS.some((p) => p.id !== 'company_site' && p.domains.some((d) => host === d || host.endsWith(`.${d}`)));
    const isAts = PLATFORMS.find((p) => p.id === 'company_site')!.domains.some((d) => host === d || host.endsWith(`.${d}`));
    if (!isBoard && !isAts) {
      const parts = host.split('.');
      const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
      if (core && !['careers', 'jobs', 'apply'].includes(core)) return titleCase(core);
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

const PLATFORM_SUFFIX = /\s*[|\-–—•·]\s*(linkedin|naukri(\.com)?|indeed(\.com)?|glassdoor|wellfound|instahyre|cutshort|foundit|iimjobs|hirist|internshala|monster|shine\.com|apna)\s*$/i;

/** Best-effort parse of a job page <title> into role / company / location. */
export function parseJobTitle(raw: string | undefined, url?: string): { role?: string; company?: string; location?: string } {
  if (!raw) return { company: companyFromUrl(url) };
  let t = raw.replace(/^\(\d+\)\s*/, '').replace(/\s+/g, ' ').trim();
  t = t.replace(PLATFORM_SUFFIX, '').trim();
  // LinkedIn: "Razorpay hiring Senior Frontend Engineer in Bengaluru, Karnataka, India"
  let m = t.match(/^(.+?) hiring (.+?) in (.+)$/i);
  if (m) return { company: m[1].trim(), role: m[2].trim(), location: m[3].trim() };
  // Greenhouse: "Job Application for Software Engineer at Postman"
  m = t.match(/^(?:job application for\s+)?(.+?)\s+(?:at|@)\s+(.+)$/i);
  if (m) return { role: m[1].trim(), company: m[2].trim() };
  const parts = t.split(/\s+[|–—]\s+|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  const urlCompany = companyFromUrl(url);
  if (parts.length >= 2) {
    // Lever: "Company - Role"
    if (urlCompany && parts[0].toLowerCase() === urlCompany.toLowerCase()) return { company: parts[0], role: parts[1] };
    return { role: parts[0], company: parts[1], location: parts[2] };
  }
  return { role: t, company: urlCompany };
}

/* ───────────────────────── Search builders ───────────────────────── */

export interface SearchLink {
  id: string;
  label: string;
  description: string;
  url: string;
  query?: string;
}

const q = (s: string) => (s.includes(' ') && !s.startsWith('"') ? `"${s}"` : s);
const enc = encodeURIComponent;

export function hiringManagerTerms(role: string): string[] {
  const r = role.toLowerCase();
  if (/(engineer|developer|sde|programmer|devops|sre|architect|frontend|backend|full ?stack|mobile)/.test(r))
    return ['"engineering manager"', '"head of engineering"', '"tech lead"', '"director of engineering"'];
  if (/product/.test(r)) return ['"group product manager"', '"head of product"', '"director of product"', '"product lead"'];
  if (/design|ux|ui/.test(r)) return ['"design manager"', '"head of design"', '"design lead"'];
  if (/data|analyst|scien|ml|machine learning|ai/.test(r)) return ['"head of data"', '"data science manager"', '"analytics manager"'];
  if (/market|growth|seo|content|brand/.test(r)) return ['"head of marketing"', '"marketing manager"', '"growth lead"'];
  if (/sales|account|business development|bd/.test(r)) return ['"head of sales"', '"sales manager"', '"sales director"'];
  if (/finance|account|fp&a|audit/.test(r)) return ['"finance manager"', '"head of finance"', '"finance director"'];
  if (/hr|people|talent/.test(r)) return ['"head of people"', '"HR manager"', '"people partner"'];
  return ['"hiring manager"', '"head of"', 'director', 'manager'];
}

export type Persona = 'recruiter' | 'hiring_manager' | 'peer' | 'alumni' | 'founder' | 'leader';

export const PERSONAS: { id: Persona; label: string; why: string }[] = [
  { id: 'peer', label: 'Peers (referrers)', why: 'People doing the role today — the best source of referrals and honest insight.' },
  { id: 'hiring_manager', label: 'Hiring managers', why: 'The decision maker. A short note with proof can skip the resume pile.' },
  { id: 'recruiter', label: 'Recruiters / TA', why: 'They own the pipeline — make their job easy with a crisp snapshot.' },
  { id: 'alumni', label: 'Alumni', why: 'Shared school = warmer intro and much higher reply rates.' },
  { id: 'founder', label: 'Founders', why: 'At startups (< 50 people) founders often hire directly.' },
  { id: 'leader', label: 'Leaders / Execs', why: 'For senior roles: VPs and directors set headcount.' },
];

export function peopleSearch(opts: { persona: Persona; company: string; role: string; location?: string; school?: string }): SearchLink[] {
  const { persona, company, role, location, school } = opts;
  let terms: string[] = [];
  if (persona === 'recruiter') terms = ['recruiter', '"talent acquisition"', '"technical recruiter"', '"talent partner"'];
  else if (persona === 'hiring_manager') terms = hiringManagerTerms(role);
  else if (persona === 'peer') terms = role ? [q(role)] : [];
  else if (persona === 'founder') terms = ['founder', '"co-founder"', 'CEO', 'CTO'];
  else if (persona === 'leader') terms = ['VP', '"vice president"', 'director', '"head of"'];
  else if (persona === 'alumni') terms = school ? [q(school)] : [];
  const group = terms.length > 1 ? `(${terms.join(' OR ')})` : terms[0] ?? '';
  const companyQ = company ? q(company) : '';
  const li = [group, companyQ, persona === 'alumni' && role ? q(role) : ''].filter(Boolean).join(' ');
  const xray = ['site:linkedin.com/in', group, companyQ, location ? q(location) : ''].filter(Boolean).join(' ');
  const links: SearchLink[] = [
    {
      id: 'li-people',
      label: 'LinkedIn people search',
      description: 'Boolean search inside LinkedIn (use the “Current company” filter for precision).',
      url: `https://www.linkedin.com/search/results/people/?keywords=${enc(li)}&origin=GLOBAL_SEARCH_HEADER`,
      query: li,
    },
    {
      id: 'google-xray',
      label: 'Google X-ray of LinkedIn',
      description: 'Finds public profiles via Google — great when LinkedIn search limits kick in.',
      url: `https://www.google.com/search?q=${enc(xray)}`,
      query: xray,
    },
  ];
  if (persona === 'recruiter' || persona === 'hiring_manager') {
    const posts = [`"hiring"`, role ? q(role) : '', companyQ].filter(Boolean).join(' ');
    links.push({
      id: 'li-posts',
      label: 'LinkedIn “we’re hiring” posts',
      description: 'People who posted about this role — they want messages. Reply or DM them.',
      url: `https://www.linkedin.com/search/results/content/?keywords=${enc(posts)}&sortBy=%22date_posted%22`,
      query: posts,
    });
  }
  if (persona === 'founder') {
    const xq = `${companyQ} (founder OR CEO)`;
    links.push({ id: 'x-founder', label: 'Find them on X', description: 'Founders are often active on X — DMs can work well.', url: `https://x.com/search?q=${enc(xq)}&f=user`, query: xq });
  }
  return links;
}

export function jobSearches(opts: { role: string; location?: string; remote?: boolean; india?: boolean }): SearchLink[] {
  const { role, location, remote, india } = opts;
  const loc = remote ? 'Remote' : location ?? '';
  const indeedHost = india ? 'in.indeed.com' : 'www.indeed.com';
  const naukriPath = `${slugify(role)}-jobs${loc && !remote ? `-in-${slugify(loc)}` : ''}`;
  const ats = `(site:boards.greenhouse.io OR site:job-boards.greenhouse.io OR site:jobs.lever.co OR site:jobs.ashbyhq.com OR site:apply.workable.com) ${q(role)}${loc ? ` ${q(loc)}` : ''}`;
  const startup = `(site:wellfound.com OR site:cutshort.io OR site:instahyre.com OR site:workatastartup.com) ${q(role)}${loc ? ` ${q(loc)}` : ''}`;
  const xq = `(hiring OR "we're hiring" OR "is hiring") ${q(role)}${loc ? ` ${loc}` : ''} -filter:replies`;
  const links: SearchLink[] = [
    {
      id: 'li-24h',
      label: 'LinkedIn — posted in last 24h',
      description: 'Fresh postings get the most attention. Apply early, then reach out.',
      url: `https://www.linkedin.com/jobs/search/?keywords=${enc(role)}&location=${enc(loc)}&f_TPR=r86400${remote ? '&f_WT=2' : ''}`,
    },
    {
      id: 'li-week',
      label: 'LinkedIn — past week',
      description: 'Wider net for the week.',
      url: `https://www.linkedin.com/jobs/search/?keywords=${enc(role)}&location=${enc(loc)}&f_TPR=r604800${remote ? '&f_WT=2' : ''}`,
    },
    {
      id: 'li-hiring-posts',
      label: 'LinkedIn hiring posts',
      description: 'Roles announced by people in posts — many never reach job boards.',
      url: `https://www.linkedin.com/search/results/content/?keywords=${enc(`"hiring" ${q(role)}`)}&sortBy=%22date_posted%22`,
    },
    {
      id: 'ats-xray',
      label: 'Hidden jobs on company ATS (Google)',
      description: 'Greenhouse / Lever / Ashby boards — roles often posted here before job boards.',
      url: `https://www.google.com/search?q=${enc(ats)}&tbs=qdr:w`,
      query: ats,
    },
    {
      id: 'startups',
      label: 'Startup boards (Google)',
      description: 'Wellfound, Cutshort, Instahyre & YC in one search.',
      url: `https://www.google.com/search?q=${enc(startup)}&tbs=qdr:w`,
      query: startup,
    },
    {
      id: 'x-hiring',
      label: 'X / Twitter hiring tweets',
      description: 'Founders and engineers tweet openings — reply fast.',
      url: `https://x.com/search?q=${enc(xq)}&f=live`,
      query: xq,
    },
    {
      id: 'google-jobs',
      label: 'Google Jobs',
      description: 'Aggregates listings from many boards.',
      url: `https://www.google.com/search?q=${enc(`${role} jobs ${loc}`.trim())}&ibp=htl;jobs`,
    },
    {
      id: 'indeed',
      label: 'Indeed — last 3 days',
      description: 'Broad coverage, filtered to fresh roles.',
      url: `https://${indeedHost}/jobs?q=${enc(role)}&l=${enc(remote ? 'Remote' : location ?? '')}&fromage=3`,
    },
  ];
  if (india) {
    links.splice(3, 0, {
      id: 'naukri',
      label: 'Naukri — fresh jobs',
      description: 'India’s largest board. Update your profile daily for better visibility.',
      url: `https://www.naukri.com/${naukriPath}?jobAge=3`,
    });
  }
  return links;
}

export function companyResearch(company: string): SearchLink[] {
  const c = q(company);
  return [
    { id: 'news', label: 'Recent news', description: 'Fresh talking points for your outreach.', url: `https://news.google.com/search?q=${enc(company)}` },
    { id: 'careers', label: 'Careers page', description: 'Apply direct where possible.', url: `https://www.google.com/search?q=${enc(`${c} careers`)}` },
    { id: 'employees', label: 'Employees on LinkedIn', description: 'Find your referrers.', url: `https://www.linkedin.com/search/results/people/?keywords=${enc(company)}` },
    { id: 'glassdoor', label: 'Interview questions', description: 'What they actually ask.', url: `https://www.google.com/search?q=${enc(`${c} interview questions site:glassdoor.com OR site:glassdoor.co.in OR site:ambitionbox.com`)}` },
    { id: 'salaries', label: 'Salaries', description: 'Know your number before they ask.', url: `https://www.google.com/search?q=${enc(`${c} salaries site:levels.fyi OR site:ambitionbox.com OR site:glassdoor.com`)}` },
    { id: 'reviews', label: 'Employee reviews', description: 'Culture, WLB and red flags.', url: `https://www.google.com/search?q=${enc(`${c} reviews site:ambitionbox.com OR site:glassdoor.com`)}` },
  ];
}

/* ───────────────────────── Email patterns ───────────────────────── */

export function cleanDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^mailto:/, '')
    .replace(/^.*@/, '')
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#]/)[0];
}

export function emailPatterns(first: string, last: string, domainInput: string): { email: string; pattern: string; common: boolean }[] {
  const f = first.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  const l = last.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  const d = cleanDomain(domainInput);
  if (!f || !d) return [];
  const rows: [string, string, boolean][] = [
    [`${f}.${l}`, 'first.last', true],
    [`${f}`, 'first', true],
    [`${f[0]}${l}`, 'flast', true],
    [`${f}${l}`, 'firstlast', false],
    [`${f[0]}.${l}`, 'f.last', false],
    [`${f}${l[0] ?? ''}`, 'firstl', false],
    [`${f}_${l}`, 'first_last', false],
    [`${l}.${f}`, 'last.first', false],
    [`${l}${f[0]}`, 'lastf', false],
    [`${f}-${l}`, 'first-last', false],
  ];
  const seen = new Set<string>();
  return rows
    .filter(([local]) => local && !local.endsWith('.') && !local.endsWith('_') && !local.endsWith('-') && !local.startsWith('.'))
    .map(([local, pattern, common]) => ({ email: `${local}@${d}`, pattern, common }))
    .filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)));
}

/* ───────────────────────── Bookmarklet ───────────────────────── */

export function bookmarkletHref(appUrl: string): string {
  const base = appUrl.replace(/#.*$/, '');
  const code = `(function(){var s=String(window.getSelection()||'').slice(0,5000);var u='${base}#/capture?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'&jd='+encodeURIComponent(s);window.open(u,'_blank');})();`;
  return `javascript:${code}`;
}

/* ───────────────────────── JD keyword matching ───────────────────────── */

const SKILL_TERMS = [
  // Languages
  'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift', 'golang', 'rust', 'c++', 'c#', 'ruby', 'php', 'scala', 'sql', 'bash', 'dart', 'elixir', 'objective-c', 'matlab', 'html', 'css',
  // Frontend
  'react', 'react native', 'next.js', 'vue', 'nuxt', 'angular', 'svelte', 'redux', 'graphql', 'apollo', 'sass', 'tailwind', 'webpack', 'vite', 'jest', 'cypress', 'playwright', 'storybook', 'web performance', 'accessibility', 'responsive design', 'design systems', 'micro-frontends', 'pwa', 'd3',
  // Backend
  'node.js', 'nestjs', 'django', 'flask', 'fastapi', 'spring boot', 'spring', 'rails', 'laravel', '.net', 'microservices', 'rest api', 'restful', 'grpc', 'kafka', 'rabbitmq', 'redis', 'elasticsearch', 'postgresql', 'mysql', 'mongodb', 'dynamodb', 'cassandra', 'prisma',
  // Cloud & DevOps
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'jenkins', 'github actions', 'linux', 'serverless', 'lambda', 'observability', 'prometheus', 'grafana', 'datadog', 'sre', 'caching', 'cdn',
  // Data & ML
  'machine learning', 'deep learning', 'nlp', 'computer vision', 'pytorch', 'tensorflow', 'scikit-learn', 'pandas', 'numpy', 'spark', 'hadoop', 'airflow', 'dbt', 'etl', 'data pipelines', 'data warehouse', 'snowflake', 'bigquery', 'redshift', 'tableau', 'power bi', 'looker', 'advanced excel', 'statistics', 'a/b testing', 'experimentation', 'llm', 'generative ai', 'rag', 'prompt engineering', 'mlops',
  // Mobile
  'android', 'ios', 'flutter', 'jetpack compose', 'swiftui',
  // CS fundamentals
  'data structures', 'algorithms', 'system design', 'distributed systems', 'scalability', 'object-oriented', 'design patterns', 'multithreading', 'concurrency', 'security', 'oauth', 'unit testing', 'tdd', 'code review',
  // Product & design
  'product management', 'roadmap', 'user research', 'figma', 'prototyping', 'wireframing', 'ux', 'ui', 'interaction design', 'usability testing', 'product strategy', 'okrs', 'kpis', 'analytics', 'go-to-market', 'stakeholder management', 'prd', 'agile', 'scrum', 'jira',
  // Business
  'seo', 'sem', 'content marketing', 'social media', 'google analytics', 'email marketing', 'growth marketing', 'performance marketing', 'crm', 'salesforce', 'hubspot', 'lead generation', 'b2b', 'b2c', 'saas', 'negotiation', 'account management', 'business development', 'partnerships', 'customer success', 'market research', 'financial modeling', 'valuation', 'accounting', 'budgeting', 'forecasting', 'fp&a', 'risk management', 'compliance', 'supply chain', 'procurement', 'logistics', 'six sigma', 'project management', 'program management', 'recruiting', 'talent acquisition', 'payroll',
  // Soft & domain
  'communication', 'leadership', 'mentoring', 'collaboration', 'cross-functional', 'ownership', 'problem solving', 'fintech', 'payments', 'e-commerce', 'edtech', 'healthtech', 'startup',
];

const ALIASES: Record<string, string> = {
  nodejs: 'node.js',
  'node js': 'node.js',
  nextjs: 'next.js',
  reactjs: 'react',
  'react.js': 'react',
  vuejs: 'vue',
  'vue.js': 'vue',
  postgres: 'postgresql',
  k8s: 'kubernetes',
  a11y: 'accessibility',
  llms: 'llm',
  oop: 'object-oriented',
  tailwindcss: 'tailwind',
  expressjs: 'express',
  'express.js': 'express',
  ml: 'machine learning',
  'google cloud': 'gcp',
  'amazon web services': 'aws',
  cicd: 'ci/cd',
  'ci cd': 'ci/cd',
  'ms excel': 'advanced excel',
  'microsoft excel': 'advanced excel',
  restapi: 'rest api',
  'rest apis': 'rest api',
  'user experience': 'ux',
  'user interface': 'ui',
  'a/b tests': 'a/b testing',
  'ab testing': 'a/b testing',
};

const STOP = new Set(
  'a an and are as at be been but by can could did do does for from had has have how i if in into is it its may more most must not of on or our out over should so such than that the their them then there these they this those through to under up upon us very was we were what when where which while who whom why will with would you your yours about above after again against all also am any because before being below between both down during each few further here just only other own same some too until off once nor me my myself ourselves he him his she her hers herself itself what\'s etc via per within across including include includes'.split(
    ' ',
  ),
);

const JD_FILLER = new Set(
  'experience experiences team teams work working role roles skills skill strong ability able years year knowledge responsibilities requirements required preferred candidate candidates opportunity opportunities company join build building help helping using use used new great good excellent understanding environment level plus bonus world class best like well looking ensure across support various related equivalent degree bachelor bachelors master masters field fields job position apply applicants equal employer benefits culture people product products customer customers business solutions solution develop development developing design designing time based high quality make makes making part every within full drive driving impact etc minimum least deep closely partner partners hands'.split(
    ' ',
  ),
);

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

function termRegex(term: string): RegExp {
  return new RegExp(`(?<![a-z0-9+#.])${escapeRe(term)}(?![a-z0-9+#])`, 'gi');
}

const TERM_RES = [...SKILL_TERMS, ...Object.keys(ALIASES)].map((t) => [t, termRegex(t)] as const);

function canonicalCounts(text: string): Map<string, number> {
  const lower = ` ${text.toLowerCase()} `;
  const counts = new Map<string, number>();
  for (const [term, re] of TERM_RES) {
    const n = (lower.match(re) ?? []).length;
    if (!n) continue;
    const canon = ALIASES[term] ?? term;
    counts.set(canon, (counts.get(canon) ?? 0) + n);
  }
  // Avoid double counting e.g. "spring boot" + "spring"
  if (counts.has('spring boot') && counts.has('spring')) counts.delete('spring');
  if (counts.has('react native') && (counts.get('react') ?? 0) <= (counts.get('react native') ?? 0)) counts.delete('react');
  return counts;
}

export interface JDMatch {
  score: number;
  matched: { term: string; count: number }[];
  missing: { term: string; count: number }[];
  frequent: { term: string; count: number; inResume: boolean }[];
  hasProfile: boolean;
}

export function matchJD(jd: string, profile: Pick<Profile, 'skills' | 'resumeText' | 'headline' | 'currentRole' | 'pitch' | 'achievement'>): JDMatch {
  const jdCounts = canonicalCounts(jd);
  const corpus = [profile.skills.join(', '), profile.resumeText, profile.headline, profile.currentRole, profile.pitch, profile.achievement].join('\n');
  const mine = canonicalCounts(corpus);
  const corpusLower = corpus.toLowerCase();
  const terms = [...jdCounts.entries()].map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
  const matched = terms.filter((t) => mine.has(t.term));
  const missing = terms.filter((t) => !mine.has(t.term));
  const weight = (t: { count: number }) => 1 + Math.min(t.count, 4) * 0.5;
  const total = terms.reduce((a, t) => a + weight(t), 0);
  const got = matched.reduce((a, t) => a + weight(t), 0);

  // Frequent non-dictionary words (domain language) as a secondary signal.
  const words = (jd.toLowerCase().match(/[a-z][a-z+#.-]{3,}/g) ?? []).map((w) => w.replace(/[.-]+$/, ''));
  const freq = new Map<string, number>();
  for (const w of words) {
    if (STOP.has(w) || JD_FILLER.has(w) || jdCounts.has(w) || ALIASES[w]) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  const frequent = [...freq.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({ term, count, inResume: corpusLower.includes(term) }));

  return {
    score: total ? Math.round((got / total) * 100) : 0,
    matched,
    missing,
    frequent,
    hasProfile: corpus.trim().length > 0,
  };
}
