import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Crown, Ellipsis, Gift, Pencil, Plus, Scale, Send, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { useLocalState, useSettings } from '@/lib/hooks';
import { celebrate, undoToast, useUI } from '@/lib/store';
import { deleteRow, moveApplication, saveOffer } from '@/lib/actions';
import { CURRENCIES, OFFER_FACTORS, WORK_MODES, WORK_MODE_LABEL } from '@/lib/constants';
import type { Offer, OfferFactor, OfferStatus } from '@/lib/types';
import { cn, fmtDate, formatMoney, relDay } from '@/lib/utils';
import { Badge, Button, Card, CardHeader, EmptyState, Field, Select, Textarea } from '@/components/ui';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal } from '@/components/overlay';
import { CompanyLogo, DueBadge, PageHeader } from '@/components/common';
import { DateInput, MoneyInput, SearchSelect } from '@/components/fields';
import { Legend } from '@/components/charts';

type Weights = Record<OfferFactor | 'comp', number>;
const DEFAULT_WEIGHTS: Weights = { comp: 5, growth: 4, learning: 3, culture: 3, wlb: 3, stability: 2, brand: 2 };

const firstYear = (o: Offer) => o.base + o.bonus + o.equity + o.joiningBonus + o.benefits;
const recurring = (o: Offer) => o.base + o.bonus + o.equity + o.benefits;

const COMP_PARTS: { key: keyof Offer; label: string; color: string }[] = [
  { key: 'base', label: 'Base', color: 'var(--s1)' },
  { key: 'bonus', label: 'Bonus', color: 'var(--s2)' },
  { key: 'equity', label: 'Equity / yr', color: 'var(--s3)' },
  { key: 'joiningBonus', label: 'Joining bonus', color: 'var(--s7)' },
  { key: 'benefits', label: 'Benefits', color: 'var(--s5)' },
];

export default function OffersPage() {
  const ui = useUI();
  const settings = useSettings();
  const { offers, apps } = useData();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState<Offer | 'new' | null>(null);
  const [prefillApp, setPrefillApp] = useState<string | undefined>();
  const [weights, setWeights] = useLocalState<Weights>('offers.weights', DEFAULT_WEIGHTS);

  useEffect(() => {
    const appId = params.get('new');
    if (appId) {
      setPrefillApp(appId);
      setEditing('new');
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const active = offers.filter((o) => o.status !== 'declined');
  const maxRecurring = Math.max(1, ...active.map(recurring));
  const score = (o: Offer) => {
    const comp = (recurring(o) / maxRecurring) * 5;
    let num = weights.comp * comp;
    let den = weights.comp;
    for (const f of OFFER_FACTORS) {
      num += weights[f.id] * (o.ratings[f.id] ?? 3);
      den += weights[f.id];
    }
    return den ? Math.round((num / den) * 20) : 0;
  };
  const ranked = [...active].sort((a, b) => score(b) - score(a));
  const leader = ranked[0];
  const runnerUp = ranked[1];
  const currency = offers[0]?.currency ?? settings.currency;

  return (
    <div className="page">
      <PageHeader
        icon={<Gift className="h-5 w-5" />}
        title="Offers"
        subtitle="Compare total value — and what actually matters to you — side by side."
        actions={
          <Button size="sm" variant="primary" onClick={() => { setPrefillApp(undefined); setEditing('new'); }}>
            <Plus className="h-4 w-4" /> Add offer
          </Button>
        }
      />

      {!offers.length ? (
        <Card>
          <EmptyState
            icon={<Gift className="h-6 w-6" />}
            title="No offers yet — but they’re coming"
            description="When an offer lands, add the numbers here. Pursuit computes first-year and recurring value, scores each offer against your priorities and helps you negotiate."
            action={
              <Button variant="primary" onClick={() => setEditing('new')}>
                <Plus className="h-4 w-4" /> Add an offer
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {leader && runnerUp && (
            <Card className="flex flex-col gap-3 border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-4 sm:flex-row sm:items-center">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-semibold">
                  Based on your priorities, {leader.company} leads ({score(leader)} vs {score(runnerUp)})
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {recurring(runnerUp) > recurring(leader)
                    ? `${runnerUp.company} pays more (${formatMoney(recurring(runnerUp), currency)} vs ${formatMoney(recurring(leader), currency)}/yr) — use that as leverage to ask ${leader.company} to close the gap.`
                    : `${leader.company} also pays more. You can still negotiate — a polite, data-backed ask rarely hurts.`}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => ui.openComposer({ applicationId: leader.applicationId, templateId: 'tpl-negotiate' })}>
                <Send className="h-3.5 w-3.5" /> Draft negotiation
              </Button>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {offers.map((o) => {
              const fy = firstYear(o);
              const isLeader = leader?.id === o.id && active.length > 1;
              return (
                <Card key={o.id} className={cn('flex flex-col p-4', isLeader && 'ring-2 ring-emerald-500/40', o.status === 'declined' && 'opacity-60')}>
                  <div className="flex items-start gap-3">
                    <CompanyLogo name={o.company} size={40} rounded="rounded-xl" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[15px] font-semibold">{o.company}</span>
                        {isLeader && <Crown className="h-4 w-4 text-amber-500" />}
                      </div>
                      <div className="truncate text-[12.5px] text-muted-foreground">{o.role}</div>
                    </div>
                    <Menu>
                      <MenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost" aria-label="Offer actions">
                          <Ellipsis className="h-4 w-4" />
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem icon={<Pencil />} onSelect={() => setEditing(o)}>
                          Edit
                        </MenuItem>
                        <MenuItem icon={<Send />} onSelect={() => ui.openComposer({ applicationId: o.applicationId, templateId: 'tpl-negotiate' })}>
                          Draft negotiation email
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={<Trash2 />} danger onSelect={async () => undoToast('Offer deleted', await deleteRow('offers', o.id))}>
                          Delete
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <div className="text-[11.5px] text-muted-foreground">First-year value</div>
                      <div className="text-[26px] font-semibold leading-tight tracking-tight">{formatMoney(fy, o.currency)}</div>
                      <div className="text-[12px] text-muted-foreground">{formatMoney(recurring(o), o.currency)} recurring / yr</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11.5px] text-muted-foreground">Your score</div>
                      <div className="text-[22px] font-semibold text-primary">{score(o)}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex h-3 w-full gap-[2px] overflow-hidden rounded-[4px]">
                    {COMP_PARTS.map((p) => {
                      const v = o[p.key] as number;
                      return v > 0 ? <div key={p.key} title={`${p.label}: ${formatMoney(v, o.currency)}`} style={{ width: `${(v / fy) * 100}%`, background: p.color }} /> : null;
                    })}
                  </div>
                  <div className="mt-4 space-y-1.5">
                    {OFFER_FACTORS.map((f) => (
                      <div key={f.id} className="flex items-center justify-between text-[12.5px]">
                        <span className="text-muted-foreground">{f.label}</span>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              aria-label={`${f.label} ${n}`}
                              onClick={() => saveOffer({ ratings: { ...o.ratings, [f.id]: n } }, o.id)}
                              className={cn('h-2.5 w-5 rounded-full transition-colors', n <= (o.ratings[f.id] ?? 0) ? 'bg-primary' : 'bg-muted hover:bg-muted-foreground/30')}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
                    <Select
                      value={o.status}
                      onChange={async (e) => {
                        const status = e.target.value as OfferStatus;
                        await saveOffer({ status }, o.id);
                        if (status === 'accepted') {
                          if (o.applicationId) await moveApplication(o.applicationId, 'accepted');
                          celebrate();
                          setTimeout(celebrate, 600);
                          toast.success(`You accepted ${o.company}! 🥳 Congratulations!`);
                        }
                      }}
                      wrapperClassName="w-auto"
                      className="h-8 w-36 text-[12.5px]"
                    >
                      <option value="pending">Pending</option>
                      <option value="negotiating">Negotiating</option>
                      <option value="accepted">Accepted</option>
                      <option value="declined">Declined</option>
                    </Select>
                    {o.deadline && <DueBadge due={o.deadline} prefix="Decide" />}
                    {o.workMode && <Badge tone="gray">{WORK_MODE_LABEL[o.workMode]}</Badge>}
                    {o.location && <Badge tone="gray">{o.location}</Badge>}
                  </div>
                  {o.notes && <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{o.notes}</p>}
                </Card>
              );
            })}
          </div>
          <Legend series={COMP_PARTS.map((p) => ({ key: p.key, name: p.label, color: p.color }))} />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Side-by-side" icon={<Scale className="h-4 w-4" />} />
              <div className="overflow-x-auto p-4">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium" />
                      {offers.map((o) => (
                        <th key={o.id} className="py-2 pr-3 text-right font-semibold text-foreground">
                          {o.company}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ...COMP_PARTS.map((p) => ({ label: p.label, val: (o: Offer) => o[p.key] as number, money: true, higher: true })),
                      { label: 'First-year total', val: firstYear, money: true, higher: true, bold: true },
                      { label: 'Recurring / yr', val: recurring, money: true, higher: true, bold: true },
                      ...OFFER_FACTORS.map((f) => ({ label: f.label, val: (o: Offer) => o.ratings[f.id] ?? 0, money: false, higher: true })),
                      { label: 'Weighted score', val: score, money: false, higher: true, bold: true },
                    ].map((row) => {
                      const vals = offers.map(row.val);
                      const best = Math.max(...vals);
                      return (
                        <tr key={row.label} className="border-b last:border-0">
                          <td className={cn('py-2 pr-3 text-muted-foreground', 'bold' in row && row.bold && 'font-medium text-foreground')}>{row.label}</td>
                          {offers.map((o, i) => (
                            <td key={o.id} className={cn('py-2 pr-3 text-right tabular-nums', vals[i] === best && offers.length > 1 && vals[i] > 0 && 'font-semibold text-emerald-700 dark:text-emerald-400')}>
                              {row.money ? formatMoney(vals[i], o.currency) : vals[i]}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    <tr>
                      <td className="py-2 pr-3 text-muted-foreground">Deadline</td>
                      {offers.map((o) => (
                        <td key={o.id} className="py-2 pr-3 text-right">
                          {o.deadline ? `${fmtDate(o.deadline)} (${relDay(o.deadline)})` : '—'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
            <Card>
              <CardHeader title="What matters to you" subtitle="Weights drive the score (0 = ignore)" icon={<Scale className="h-4 w-4" />} />
              <div className="space-y-3 p-5">
                {(['comp', ...OFFER_FACTORS.map((f) => f.id)] as (keyof Weights)[]).map((k) => (
                  <div key={k}>
                    <div className="mb-1 flex justify-between text-[12.5px]">
                      <span>{k === 'comp' ? 'Compensation' : OFFER_FACTORS.find((f) => f.id === k)!.label}</span>
                      <span className="tabular-nums text-muted-foreground">{weights[k]}</span>
                    </div>
                    <input type="range" min={0} max={5} value={weights[k]} onChange={(e) => setWeights({ ...weights, [k]: Number(e.target.value) })} className="w-full accent-[hsl(var(--primary))]" />
                  </div>
                ))}
                <button className="text-[12px] text-muted-foreground hover:text-foreground" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
                  Reset weights
                </button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {editing && <OfferForm offer={editing === 'new' ? undefined : editing} appId={prefillApp} onClose={() => setEditing(null)} />}
    </div>
  );
}

function OfferForm({ offer, appId, onClose }: { offer?: Offer; appId?: string; onClose: () => void }) {
  const settings = useSettings();
  const { apps } = useData();
  const app = apps.find((a) => a.id === (offer?.applicationId ?? appId));
  const [d, setD] = useState<Partial<Offer>>(
    () =>
      offer ?? {
        applicationId: app?.id,
        company: app?.company ?? '',
        role: app?.role ?? '',
        currency: app?.currency ?? settings.currency,
        base: app?.salaryMax ?? 0,
        bonus: 0,
        equity: 0,
        joiningBonus: 0,
        benefits: 0,
        location: app?.location,
        workMode: app?.workMode,
        status: 'pending',
        ratings: { growth: 3, learning: 3, culture: 3, wlb: 3, stability: 3, brand: 3 },
      },
  );
  const set = <K extends keyof Offer>(k: K, v: Offer[K] | undefined) => setD((p) => ({ ...p, [k]: v }));
  const cur = d.currency ?? settings.currency;
  const save = async () => {
    if (!d.company?.trim()) return toast.error('Company is required');
    await saveOffer(d, offer?.id);
    if (!offer) celebrate();
    toast.success(offer ? 'Offer updated' : 'Offer added 🎉');
    onClose();
  };
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={offer ? 'Edit offer' : 'Add an offer'}
      description="Annual amounts. Type naturally — 26L, 1.2Cr, 120k."
      icon={<Gift className="h-4 w-4" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save offer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Application">
            <SearchSelect
              value={d.applicationId}
              onChange={(v) => {
                const a = apps.find((x) => x.id === v);
                setD((p) => ({ ...p, applicationId: v, company: a?.company ?? p.company, role: a?.role ?? p.role, location: a?.location ?? p.location, workMode: a?.workMode ?? p.workMode }));
              }}
              placeholder="Link (optional)"
              options={[...apps].sort((a, b) => Number(b.status === 'offer') - Number(a.status === 'offer')).map((a) => ({ value: a.id, label: a.company, hint: a.role }))}
            />
          </Field>
          <Field label="Company" required>
            <input className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-soft outline-none focus:ring-[3px] focus:ring-ring/15" value={d.company ?? ''} onChange={(e) => set('company', e.target.value)} />
          </Field>
          <Field label="Role">
            <input className="h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-soft outline-none focus:ring-[3px] focus:ring-ring/15" value={d.role ?? ''} onChange={(e) => set('role', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Base salary">
            <MoneyInput value={d.base} onChange={(v) => set('base', v ?? 0)} currency={cur} />
          </Field>
          <Field label="Bonus / variable">
            <MoneyInput value={d.bonus} onChange={(v) => set('bonus', v ?? 0)} currency={cur} />
          </Field>
          <Field label="Equity per year" hint="Total grant ÷ vesting years">
            <MoneyInput value={d.equity} onChange={(v) => set('equity', v ?? 0)} currency={cur} />
          </Field>
          <Field label="Joining bonus">
            <MoneyInput value={d.joiningBonus} onChange={(v) => set('joiningBonus', v ?? 0)} currency={cur} />
          </Field>
          <Field label="Benefits value / yr" hint="Insurance, allowances, etc.">
            <MoneyInput value={d.benefits} onChange={(v) => set('benefits', v ?? 0)} currency={cur} />
          </Field>
          <Field label="Currency">
            <Select value={cur} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Decision deadline">
            <DateInput value={d.deadline} onChange={(v) => set('deadline', v)} />
          </Field>
          <Field label="Start date">
            <DateInput value={d.startDate} onChange={(v) => set('startDate', v)} quick={false} />
          </Field>
          <Field label="Work mode">
            <Select value={d.workMode ?? ''} onChange={(e) => set('workMode', (e.target.value || undefined) as Offer['workMode'])}>
              <option value="">—</option>
              {WORK_MODES.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="rounded-xl border bg-muted/30 p-4">
          <div className="mb-2 text-[13px] font-semibold">Rate the non-money stuff (1–5)</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {OFFER_FACTORS.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2">
                <span className="text-[12.5px]" title={f.hint}>
                  {f.label}
                </span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => set('ratings', { ...(d.ratings as Offer['ratings']), [f.id]: n })}
                      className={cn('h-7 w-7 rounded-md border text-[12px] font-medium', (d.ratings?.[f.id] ?? 0) === n ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent')}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <Field label="Notes">
          <Textarea value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Team, manager, growth path, relocation, what you’d negotiate…" />
        </Field>
      </div>
    </Modal>
  );
}
