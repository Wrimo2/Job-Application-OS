import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Briefcase, Globe, Linkedin, Plus, Search, Star, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/hooks';
import { confirmDialog, undoToast, useUI } from '@/lib/store';
import { deleteCompany, saveCompany } from '@/lib/actions';
import { COMPANY_TIERS } from '@/lib/constants';
import { companyResearch, peopleSearch, PERSONAS, type Persona } from '@/lib/toolkit';
import type { Company } from '@/lib/types';
import { cn, companyKey } from '@/lib/utils';
import { Sheet, Tip } from '@/components/overlay';
import { Button, Field, Input, Textarea } from '@/components/ui';
import { Avatar, CompanyLogo, ContactStageBadge, LinkChip, StageBadge } from '@/components/common';

export function CompanyDrawerHost() {
  const drawer = useUI((s) => s.drawer);
  const close = useUI((s) => s.closeDrawer);
  const { companies } = useData();
  const open = drawer.type === 'company';
  const c = open ? companies.find((x) => x.id === drawer.id) : undefined;
  return (
    <Sheet open={open && !!c} onOpenChange={(v) => !v && close()} title={c?.name ?? 'Company'}>
      {c && <CompanyDetail key={c.id} c={c} />}
    </Sheet>
  );
}

function CompanyDetail({ c }: { c: Company }) {
  const ui = useUI();
  const settings = useSettings();
  const { apps, contacts } = useData();
  const key = companyKey(c.name);
  const myApps = useMemo(() => apps.filter((a) => companyKey(a.company) === key), [apps, key]);
  const people = useMemo(() => contacts.filter((x) => companyKey(x.company) === key), [contacts, key]);
  const [d, setD] = useState<Partial<Company>>(c);
  const [persona, setPersona] = useState<Persona>('peer');
  const role = myApps[0]?.role || settings.profile.targetRoles[0] || '';
  useEffect(() => setD(c), [c]);

  const saveField = async (patch: Partial<Company>) => {
    await saveCompany(patch, c.id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b bg-card px-5 py-4">
        <div className="flex items-start gap-3">
          <CompanyLogo name={c.name} size={52} rounded="rounded-xl" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">{c.name}</h2>
            <p className="text-[13px] text-muted-foreground">{[c.industry, c.location, c.size].filter(Boolean).join(' · ') || 'Add industry & location below'}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COMPANY_TIERS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => saveField({ tier: t.id })}
                  className={cn('rounded-full border px-2.5 py-0.5 text-[12px] font-medium transition-colors', c.tier === t.id ? cn(t.chip, 'ring-1 ring-inset') : 'text-muted-foreground hover:bg-accent')}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tip content="Delete company">
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={async () => {
                  const ok = await confirmDialog({ title: `Delete ${c.name}?`, description: 'Applications and contacts stay — only the company profile is removed.', confirmLabel: 'Delete', danger: true, undoable: true });
                  if (!ok) return;
                  ui.closeDrawer();
                  undoToast('Company deleted', await deleteCompany(c.id));
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Tip>
            <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={() => ui.closeDrawer()}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkChip href={c.website} icon={<Globe />}>
            Website
          </LinkChip>
          <LinkChip href={c.careersUrl} icon={<Briefcase />}>
            Careers
          </LinkChip>
          <LinkChip href={c.linkedin} icon={<Linkedin />}>
            LinkedIn
          </LinkChip>
          {companyResearch(c.name).map((l) => (
            <LinkChip key={l.id} href={l.url} icon={<ArrowUpRight />}>
              {l.label}
            </LinkChip>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border bg-card p-2.5">
            <div className="text-lg font-semibold">{myApps.length}</div>
            <div className="text-[11.5px] text-muted-foreground">Applications</div>
          </div>
          <div className="rounded-xl border bg-card p-2.5">
            <div className="text-lg font-semibold">{people.length}</div>
            <div className="text-[11.5px] text-muted-foreground">People</div>
          </div>
          <div className="rounded-xl border bg-card p-2.5">
            <div className="text-lg font-semibold">{people.filter((p) => p.stage === 'referred').length}</div>
            <div className="text-[11.5px] text-muted-foreground">Referrers</div>
          </div>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="label-caps">Applications</span>
            <Button size="xs" variant="secondary" onClick={() => ui.openAppForm(undefined, { company: c.name })}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          </div>
          {myApps.length ? (
            <div className="divide-y rounded-xl border bg-card">
              {myApps.map((a) => (
                <button key={a.id} onClick={() => ui.openDrawer('application', a.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{a.role}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{a.location}</div>
                  </div>
                  <StageBadge stage={a.status} />
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-center text-[13px] text-muted-foreground">No applications here yet.</p>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="label-caps">People</span>
            <div className="flex gap-1.5">
              {people.some((p) => p.stage === 'target') && (
                <Button size="xs" variant="primary" onClick={() => ui.openEnroll(people.filter((p) => p.stage === 'target').map((p) => p.id), undefined, myApps[0]?.id)}>
                  Start outreach
                </Button>
              )}
              <Button size="xs" variant="secondary" onClick={() => ui.openContactForm(undefined, { company: c.name, applicationIds: myApps[0] ? [myApps[0].id] : [] })}>
                <UserPlus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
          </div>
          {people.length ? (
            <div className="divide-y rounded-xl border bg-card">
              {people.map((p) => (
                <button key={p.id} onClick={() => ui.openDrawer('contact', p.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50">
                  <Avatar name={p.name} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{p.name}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{p.title}</div>
                  </div>
                  <ContactStageBadge stage={p.stage} />
                </button>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-center text-[13px] text-muted-foreground">You don’t know anyone here yet — use the finder below to map the team.</p>
          )}
        </section>

        <section className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-[13.5px] font-semibold">
            <Search className="h-4 w-4 text-primary" /> Map the team at {c.name}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersona(p.id)}
                className={cn('rounded-full border px-2.5 py-1 text-[12px] font-medium', persona === p.id ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">{PERSONAS.find((p) => p.id === persona)?.why}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {peopleSearch({ persona, company: c.name, role, location: c.location, school: settings.profile.school }).map((l) => (
              <LinkChip key={l.id} href={l.url} icon={<ArrowUpRight />}>
                {l.label}
              </LinkChip>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <span className="label-caps">Details</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['website', 'Website', 'https://…'],
                ['careersUrl', 'Careers page', 'https://…/careers'],
                ['linkedin', 'LinkedIn page', 'linkedin.com/company/…'],
                ['industry', 'Industry', 'e.g. Fintech'],
                ['location', 'HQ / office', 'e.g. Bengaluru'],
                ['size', 'Size', 'e.g. 1,000–5,000'],
              ] as [keyof Company, string, string][]
            ).map(([k, label, ph]) => (
              <Field key={k} label={label}>
                <Input value={(d[k] as string) ?? ''} placeholder={ph} onChange={(e) => setD({ ...d, [k]: e.target.value })} onBlur={(e) => e.target.value !== (c[k] ?? '') && saveField({ [k]: e.target.value || undefined })} />
              </Field>
            ))}
          </div>
          <Field label="Your rating" hint="How much do you want to work here?">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => saveField({ rating: c.rating === n ? undefined : n })} aria-label={`${n} stars`}>
                  <Star className={cn('h-5 w-5', (c.rating ?? 0) >= n ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                </button>
              ))}
            </div>
          </Field>
          <Field label="Notes">
            <Textarea
              value={d.notes ?? ''}
              onChange={(e) => setD({ ...d, notes: e.target.value })}
              onBlur={() => d.notes !== c.notes && saveField({ notes: d.notes }).then(() => toast.success('Saved'))}
              placeholder="Why you want to work here, culture, interview process, salary bands, people to meet…"
            />
          </Field>
        </section>
      </div>
    </div>
  );
}
