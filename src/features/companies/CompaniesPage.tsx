import * as React from 'react';
import { useMemo, useState } from 'react';
import { Building2, Plus, Search, Star, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { useUI } from '@/lib/store';
import { ensureCompany, saveCompany } from '@/lib/actions';
import { COMPANY_TIERS, COMPANY_TIER_MAP, STAGE_MAP, STAGE_RANK } from '@/lib/constants';
import type { Company, CompanyTier, Stage } from '@/lib/types';
import { cn, companyKey, normalizeUrl, plural } from '@/lib/utils';
import { furthestRank, isActive } from '@/lib/stats';
import { Badge, Button, Card, Chip, EmptyState, Field, Input, Segmented, Switch } from '@/components/ui';
import { Modal } from '@/components/overlay';
import { Avatar, CompanyLogo, PageHeader, StageBadge } from '@/components/common';

export default function CompaniesPage() {
  const ui = useUI();
  const { companies, apps, contacts } = useData();
  const [tier, setTier] = useState<CompanyTier | 'all'>('all');
  const [q, setQ] = useState('');
  const [knownOnly, setKnownOnly] = useState(false);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    return companies
      .map((c) => {
        const key = companyKey(c.name);
        const capps = apps.filter((a) => companyKey(a.company) === key);
        const people = contacts.filter((p) => companyKey(p.company) === key);
        const best = capps.reduce<Stage | null>((acc, a) => {
          const r = furthestRank(a);
          const stage = (Object.keys(STAGE_RANK) as Stage[]).find((s) => STAGE_RANK[s] === r) ?? null;
          if (!acc) return stage;
          return STAGE_RANK[stage ?? 'wishlist'] > STAGE_RANK[acc] ? stage : acc;
        }, null);
        return { c, apps: capps, active: capps.filter(isActive), people, referrers: people.filter((p) => p.stage === 'referred'), best };
      })
      .filter((r) => tier === 'all' || r.c.tier === tier)
      .filter((r) => !knownOnly || r.people.length > 0)
      .filter((r) => !q || `${r.c.name} ${r.c.industry ?? ''} ${r.c.location ?? ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => tierOrder(a.c.tier) - tierOrder(b.c.tier) || b.active.length - a.active.length || b.people.length - a.people.length || a.c.name.localeCompare(b.c.name));
  }, [companies, apps, contacts, tier, q, knownOnly]);

  // Companies where you know people but that aren't on your list yet (e.g. from LinkedIn import).
  const networkOnly = useMemo(() => {
    const known = new Set(companies.map((c) => companyKey(c.name)));
    const m = new Map<string, { name: string; n: number }>();
    for (const p of contacts) {
      if (!p.company) continue;
      const k = companyKey(p.company);
      if (known.has(k)) continue;
      m.set(k, { name: p.company, n: (m.get(k)?.n ?? 0) + 1 });
    }
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 12);
  }, [companies, contacts]);

  return (
    <div className="page">
      <PageHeader
        icon={<Building2 className="h-5 w-5" />}
        title="Companies"
        subtitle="Your target list — rank companies, map the team and see who you already know."
        actions={
          <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add company
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented
          value={tier}
          onChange={setTier}
          options={[{ id: 'all' as const, label: 'All' }, ...COMPANY_TIERS.map((t) => ({ id: t.id, label: `${t.emoji === '·' ? '' : `${t.emoji} `}${t.label}` }))]}
        />
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search companies…" className="pl-9" />
        </div>
        <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Switch checked={knownOnly} onChange={setKnownOnly} label="Only where I know people" /> Where I know people
        </label>
      </div>

      {rows.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map(({ c, apps: capps, active, people, referrers, best }) => (
            <Card key={c.id} className="group flex cursor-pointer flex-col p-4 transition-shadow hover:shadow-lift" onClick={() => ui.openDrawer('company', c.id)}>
              <div className="flex items-start gap-3">
                <CompanyLogo name={c.name} size={42} rounded="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[14.5px] font-semibold">{c.name}</span>
                    {!!c.rating && (
                      <span className="inline-flex items-center gap-0.5 text-[11.5px] text-amber-600">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {c.rating}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[12.5px] text-muted-foreground">{[c.industry, c.location].filter(Boolean).join(' · ') || '—'}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const order: CompanyTier[] = ['dream', 'target', 'backup', 'none'];
                    const next = order[(order.indexOf(c.tier) + 1) % order.length];
                    saveCompany({ tier: next }, c.id);
                  }}
                  title="Click to change tier"
                >
                  <Chip className={COMPANY_TIER_MAP[c.tier].chip}>
                    {COMPANY_TIER_MAP[c.tier].emoji} {COMPANY_TIER_MAP[c.tier].label}
                  </Chip>
                </button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                  <div className="text-[15px] font-semibold">{active.length}</div>
                  <div className="text-[11px] text-muted-foreground">active apps</div>
                </div>
                <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                  <div className="text-[15px] font-semibold">{people.length}</div>
                  <div className="text-[11px] text-muted-foreground">people</div>
                </div>
                <div className="rounded-lg bg-muted/60 px-2 py-1.5">
                  <div className="text-[15px] font-semibold">{referrers.length}</div>
                  <div className="text-[11px] text-muted-foreground">referrers</div>
                </div>
              </div>
              <div className="mt-3 flex flex-1 items-end justify-between gap-2">
                <div className="flex -space-x-2">
                  {people.slice(0, 5).map((p) => (
                    <Avatar key={p.id} name={p.name} size={24} />
                  ))}
                  {!people.length && <span className="text-[12px] text-muted-foreground">No contacts yet</span>}
                </div>
                {best && capps.length > 0 ? <StageBadge stage={best} /> : <Badge tone="outline">Not applied</Badge>}
              </div>
              {(c.tier === 'dream' || c.tier === 'target') && !people.length && (
                <div className="mt-3 rounded-lg bg-primary/5 px-2.5 py-1.5 text-[12px] text-primary">Map the team → find a referrer before applying</div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title={companies.length ? 'No companies match' : 'Build your target list'}
            description="Companies are added automatically when you track applications or contacts. Rank them Dream / Target / Backup to focus your outreach."
            action={
              <Button variant="primary" onClick={() => setAdding(true)}>
                <Plus className="h-4 w-4" /> Add company
              </Button>
            }
          />
        </Card>
      )}

      {networkOnly.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-1 flex items-center gap-2 text-[15px] font-semibold">
            <Users className="h-4 w-4 text-primary" /> Where your network already is
          </h2>
          <p className="mb-3 text-[13px] text-muted-foreground">Companies where you know people but haven’t added to your list. Warm paths in — worth a look.</p>
          <div className="flex flex-wrap gap-2">
            {networkOnly.map((n) => (
              <button
                key={n.name}
                onClick={async () => {
                  await ensureCompany(n.name, { tier: 'target' });
                  toast.success(`${n.name} added as a target`);
                }}
                className="inline-flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 text-[12.5px] shadow-soft hover:bg-accent"
              >
                <CompanyLogo name={n.name} size={22} rounded="rounded-full" />
                {n.name}
                <span className="text-muted-foreground">· {plural(n.n, 'person', 'people')}</span>
                <Plus className="h-3.5 w-3.5 text-primary" />
              </button>
            ))}
          </div>
        </div>
      )}

      <AddCompany open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

const tierOrder = (t: CompanyTier) => ({ dream: 0, target: 1, backup: 2, none: 3 })[t];

function AddCompany({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ui = useUI();
  const [d, setD] = useState<Partial<Company>>({ tier: 'target' });
  const save = async () => {
    if (!d.name?.trim()) return toast.error('Name is required');
    const id = await ensureCompany(d.name.trim(), { ...d, website: normalizeUrl(d.website), name: d.name.trim() });
    toast.success(`${d.name} added`);
    setD({ tier: 'target' });
    onClose();
    if (id) ui.openDrawer('company', id);
  };
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Add a company"
      icon={<Building2 className="h-4 w-4" />}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Add
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <Input autoFocus value={d.name ?? ''} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Stripe" onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <Field label="Website" hint="Used for the logo and email-pattern finder.">
          <Input value={d.website ?? ''} onChange={(e) => setD({ ...d, website: e.target.value })} placeholder="stripe.com" />
        </Field>
        <Field label="Tier">
          <Segmented value={d.tier ?? 'target'} onChange={(v) => setD({ ...d, tier: v })} options={COMPANY_TIERS.map((t) => ({ id: t.id, label: t.label }))} />
        </Field>
      </div>
    </Modal>
  );
}

