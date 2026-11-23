import * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowUpRight, AtSign, Briefcase, CircleCheck, CircleX, FileSearch, Search, UserSearch, WandSparkles, UserPlus } from 'lucide-react';
import { useSettings } from '@/lib/hooks';
import { useUI } from '@/lib/store';
import { CHANNELS, TEMPLATE_CATEGORIES } from '@/lib/constants';
import { analyzeMessage } from '@/lib/outreach';
import { emailPatterns, jobSearches, peopleSearch, PERSONAS, type Persona } from '@/lib/toolkit';
import type { Channel, TemplateCategory } from '@/lib/types';
import { cn, rootDomain } from '@/lib/utils';
import { Button, Card, CardHeader, Field, Input, ProgressRing, Select, Switch, Textarea } from '@/components/ui';
import { CopyButton } from '@/components/common';
import { useData } from '@/lib/data';
import { JDMatchPanel } from '@/features/applications/JDMatch';

function LinkRow({ label, description, url, query }: { label: string; description: string; url: string; query?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors hover:bg-accent/40">
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-medium">{label}</div>
        <div className="truncate text-[12px] text-muted-foreground">{description}</div>
        {query && <code className="mt-1 block truncate rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{query}</code>}
      </div>
      {query && <CopyButton text={query} label="Query" size="xs" />}
      <a href={url} target="_blank" rel="noreferrer noopener" className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
        Open <ArrowUpRight className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}

export default function ToolkitTab() {
  return (
    <div className="space-y-4">
      <PeopleFinder />
      <JobFinder />
      <div className="grid gap-4 lg:grid-cols-2">
        <EmailFinder />
        <MessageChecker />
      </div>
      <ResumeMatch />
    </div>
  );
}

function PeopleFinder() {
  const settings = useSettings();
  const ui = useUI();
  const { companies } = useData();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState(settings.profile.targetRoles[0] ?? '');
  const [location, setLocation] = useState(settings.profile.targetLocations.find((l) => !/remote/i.test(l)) ?? '');
  const [persona, setPersona] = useState<Persona>('recruiter');
  const links = company.trim() || persona === 'alumni' ? peopleSearch({ persona, company: company.trim(), role, location, school: settings.profile.school }) : [];
  const p = PERSONAS.find((x) => x.id === persona)!;
  return (
    <Card>
      <CardHeader title="People finder" subtitle="Find recruiters, hiring managers and referrers at any company — Boolean searches built for you." icon={<UserSearch className="h-4 w-4" />} />
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Company">
            <Input list="tk-companies" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Razorpay" />
            <datalist id="tk-companies">
              {companies.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Role (for peers / managers)">
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Frontend Engineer" />
          </Field>
          <Field label="Location (optional)">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bengaluru" />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERSONAS.map((x) => (
            <button
              key={x.id}
              onClick={() => setPersona(x.id)}
              className={cn('rounded-full border px-3 py-1 text-[12.5px] font-medium transition-colors', persona === x.id ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}
            >
              {x.label}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-muted-foreground">
          <b className="text-foreground">Why {p.label.toLowerCase()}:</b> {p.why}
          {persona === 'alumni' && !settings.profile.school && ' Add your school in Settings → Profile.'}
        </p>
        {links.length ? (
          <div className="space-y-2">
            {links.map((l) => (
              <LinkRow key={l.id} {...l} />
            ))}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[12.5px] text-muted-foreground">
              Found someone?
              <Button size="xs" variant="secondary" onClick={() => ui.openContactForm(undefined, { company: company || undefined, relationship: persona === 'recruiter' ? 'recruiter' : persona === 'hiring_manager' ? 'hiring_manager' : persona === 'founder' ? 'founder' : persona === 'alumni' ? 'alumni' : persona === 'leader' ? 'leader' : 'employee', stage: 'target', source: 'People finder' })}>
                <UserPlus className="h-3.5 w-3.5" /> Add as target
              </Button>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-center text-[13px] text-muted-foreground">Enter a company to generate searches.</p>
        )}
      </div>
    </Card>
  );
}

function JobFinder() {
  const settings = useSettings();
  const [role, setRole] = useState(settings.profile.targetRoles[0] ?? '');
  const [location, setLocation] = useState(settings.profile.targetLocations.find((l) => !/remote/i.test(l)) ?? '');
  const [remote, setRemote] = useState(false);
  const india = settings.currency === 'INR' || /india|bengaluru|bangalore|mumbai|delhi|pune|hyderabad|chennai|gurugram|noida|kolkata/i.test(location);
  const links = role.trim() ? jobSearches({ role: role.trim(), location: location.trim() || undefined, remote, india }) : [];
  return (
    <Card>
      <CardHeader title="Fresh job finder" subtitle="One click to the newest roles across LinkedIn, Naukri, company ATS boards, X and more." icon={<Briefcase className="h-4 w-4" />} />
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Role">
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Product Designer" list="tk-roles" />
            <datalist id="tk-roles">
              {settings.profile.targetRoles.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <Field label="Location">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Bengaluru" disabled={remote} />
          </Field>
          <Field label="Remote only">
            <div className="flex h-9 items-center">
              <Switch checked={remote} onChange={setRemote} label="Remote only" />
            </div>
          </Field>
        </div>
        {links.length ? (
          <div className="grid gap-2 lg:grid-cols-2">
            {links.map((l) => (
              <LinkRow key={l.id} label={l.label} description={l.description} url={l.url} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-4 text-center text-[13px] text-muted-foreground">Enter a role to generate searches.</p>
        )}
        <p className="text-[12px] text-muted-foreground">Tip: save interesting roles with the 1-click capture button (Settings → Quick capture) — it adds them to your Wishlist straight from the job page.</p>
      </div>
    </Card>
  );
}

function EmailFinder() {
  const { companies } = useData();
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [domain, setDomain] = useState('');
  const rows = emailPatterns(first, last, domain);
  const suggestions = companies.filter((c) => c.website).map((c) => ({ name: c.name, domain: rootDomain(c.website) }));
  return (
    <Card>
      <CardHeader title="Email pattern finder" subtitle="Most companies use one of a few formats. Try the common ones first." icon={<AtSign className="h-4 w-4" />} />
      <div className="space-y-3 p-5">
        <div className="grid grid-cols-2 gap-2">
          <Input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First name" />
          <Input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last name" />
        </div>
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Company domain, e.g. razorpay.com" list="tk-domains" />
        <datalist id="tk-domains">
          {suggestions.map((s) => (
            <option key={s.name} value={s.domain}>
              {s.name}
            </option>
          ))}
        </datalist>
        {rows.length > 0 ? (
          <div className="divide-y rounded-xl border">
            {rows.map((r) => (
              <div key={r.email} className="flex items-center gap-2 px-3 py-2">
                <code className="min-w-0 flex-1 truncate text-[12.5px]">{r.email}</code>
                {r.common && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-700 dark:text-emerald-300">common</span>}
                <span className="hidden text-[11px] text-muted-foreground sm:inline">{r.pattern}</span>
                <CopyButton text={r.email} size="xs" />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">Enter a name and domain to generate likely addresses.</p>
        )}
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Guesses aren’t verified. Look for the company’s format in press releases, GitHub commits or their public team pages — then send to the most likely one. Never spam multiple variants at once.
        </p>
      </div>
    </Card>
  );
}

function MessageChecker() {
  const [text, setText] = useState('');
  const [channel, setChannel] = useState<Channel>('linkedin');
  const [category, setCategory] = useState<TemplateCategory>('linkedin_message');
  const [subject, setSubject] = useState('');
  const a = useMemo(() => analyzeMessage(text, { channel, category, subject }), [text, channel, category, subject]);
  return (
    <Card>
      <CardHeader title="Message checker" subtitle="Paste any draft — get a score and specific fixes before you hit send." icon={<WandSparkles className="h-4 w-4" />} />
      <div className="space-y-3 p-5">
        <div className="grid grid-cols-2 gap-2">
          <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} className="h-8 text-[13px]">
            {CHANNELS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value as TemplateCategory)} className="h-8 text-[13px]">
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
        {channel === 'email' && <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject line" className="h-8" />}
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste your message…" className="min-h-[120px]" />
        {text.trim() && (
          <div className="flex gap-3">
            <ProgressRing value={a.score} max={100} size={58} stroke={5} barClass={a.score >= 80 ? 'stroke-emerald-500' : a.score >= 60 ? 'stroke-amber-500' : 'stroke-rose-500'} trackClass="stroke-muted">
              <span className="text-sm font-semibold">{a.score}</span>
            </ProgressRing>
            <ul className="min-w-0 flex-1 space-y-1">
              {a.checks.map((c) => (
                <li key={c.id} className="flex gap-1.5 text-[12px]">
                  {c.pass ? <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <CircleX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />}
                  <span className={cn(!c.pass && 'text-foreground', c.pass && 'text-muted-foreground')}>{c.pass ? c.label : c.tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function ResumeMatch() {
  const [jd, setJd] = useState('');
  return (
    <Card>
      <CardHeader title="Resume vs. job description" subtitle="Paste a JD to see which keywords you cover — and which you’re missing — before you apply." icon={<FileSearch className="h-4 w-4" />} />
      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <Textarea value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the full job description…" className="min-h-[220px]" maxRows={16} />
        <div>{jd.trim() ? <JDMatchPanel jd={jd} compact /> : <p className="grid h-full place-items-center rounded-xl border border-dashed p-6 text-center text-[13px] text-muted-foreground">Your match score and missing keywords appear here.</p>}</div>
      </div>
    </Card>
  );
}

