import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Briefcase, Link2, Sparkles, TriangleAlert, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useUI, celebrate } from '@/lib/store';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/hooks';
import { createApplication, updateApplication } from '@/lib/actions';
import { CURRENCIES, JOB_TYPES, METHODS, PLATFORMS, STAGES, WORK_MODES } from '@/lib/constants';
import { companyFromUrl, detectPlatform, suggestMethod } from '@/lib/toolkit';
import type { Application, Priority } from '@/lib/types';
import { companyKey, platformLabel } from './helpers';
import { relDay } from '@/lib/utils';
import { Modal } from '@/components/overlay';
import { Button, Field, Input, Segmented, Select, StarRating, Switch, Textarea } from '@/components/ui';
import { DateInput, MoneyInput, SearchSelect, TagInput } from '@/components/fields';
import { Avatar } from '@/components/common';

type Draft = Partial<Application>;

function initialDraft(existing: Application | undefined, prefill: Partial<Application> | undefined, currency: string): Draft {
  if (existing) return { ...existing };
  return {
    status: 'applied',
    platform: 'linkedin',
    method: 'easy_apply',
    priority: 2,
    currency,
    tags: [],
    contactIds: [],
    appliedAt: new Date().toISOString(),
    ...prefill,
  };
}

export function ApplicationFormHost() {
  const { open, id, prefill } = useUI((s) => s.appForm);
  const close = useUI((s) => s.closeAppForm);
  const { apps } = useData();
  const existing = id ? apps.find((a) => a.id === id) : undefined;
  // Remount the form each time it opens so state resets cleanly.
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (open) setNonce((n) => n + 1);
  }, [open, id]);
  if (!open && nonce === 0) return null;
  return <ApplicationForm key={nonce} open={open} onClose={close} existing={existing} prefill={prefill} />;
}

function ApplicationForm({ open, onClose, existing, prefill }: { open: boolean; onClose: () => void; existing?: Application; prefill?: Partial<Application> }) {
  const settings = useSettings();
  const ui = useUI();
  const { apps, contacts, documents } = useData();
  const [d, setD] = useState<Draft>(() => initialDraft(existing, prefill, settings.currency));
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(!!existing || !!prefill?.jobDescription);
  const set = <K extends keyof Application>(k: K, v: Application[K] | undefined) => setD((p) => ({ ...p, [k]: v }));

  const companies = useMemo(() => Array.from(new Set(apps.map((a) => a.company))).sort(), [apps]);
  const roles = useMemo(() => Array.from(new Set([...settings.profile.targetRoles, ...apps.map((a) => a.role)])).slice(0, 50), [apps, settings.profile.targetRoles]);
  const resumes = documents.filter((x) => x.kind === 'resume');
  const allPlatforms = [...PLATFORMS, ...settings.customPlatforms.map((p) => ({ id: p, label: p, color: '#94a3b8', domains: [] }))];

  const duplicate = useMemo(() => {
    if (!d.company || !d.role) return undefined;
    return apps.find(
      (a) => a.id !== existing?.id && companyKey(a.company) === companyKey(d.company) && a.role.trim().toLowerCase() === d.role!.trim().toLowerCase(),
    );
  }, [apps, d.company, d.role, existing?.id]);

  const known = useMemo(() => {
    if (!d.company) return [];
    return contacts.filter((c) => c.company && companyKey(c.company) === companyKey(d.company) && c.stage !== 'closed');
  }, [contacts, d.company]);

  const onUrl = (url: string) => {
    const platform = detectPlatform(url);
    const company = companyFromUrl(url);
    setD((p) => ({
      ...p,
      url,
      platform: platform && (!p.platform || p.platform === 'linkedin' || !existing) ? platform : p.platform,
      method: platform && !existing ? suggestMethod(platform) : p.method,
      company: p.company || company || p.company,
    }));
  };

  const save = async (another = false) => {
    if (!d.company?.trim() || !d.role?.trim()) {
      toast.error('Company and role are required');
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        const wasOffer = existing.status === 'offer';
        await updateApplication(existing.id, d);
        if (d.status === 'offer' && !wasOffer) celebrate();
        toast.success('Application updated');
      } else {
        const app = await createApplication(d);
        if (app.status === 'offer') celebrate();
        toast.success(`Added ${app.role} at ${app.company}`, {
          description: app.status === 'applied' ? `Follow-up reminder set for ${relDay(app.nextActionAt)}.` : undefined,
          action: { label: 'Open', onClick: () => ui.openDrawer('application', app.id) },
        });
      }
      if (another) {
        setD(initialDraft(undefined, { platform: d.platform, method: d.method, status: d.status }, settings.currency));
      } else onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={existing ? 'Edit application' : 'Add application'}
      description={existing ? `${existing.role} · ${existing.company}` : 'Paste a job link to auto-fill the platform and company.'}
      icon={<Briefcase className="h-4 w-4" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!existing && (
            <Button variant="secondary" onClick={() => save(true)} disabled={saving}>
              Save & add another
            </Button>
          )}
          <Button variant="primary" onClick={() => save(false)} loading={saving}>
            {existing ? 'Save changes' : 'Add application'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-10 pl-9"
            placeholder="Paste job link (LinkedIn, Naukri, Greenhouse, Lever…)"
            value={d.url ?? ''}
            onChange={(e) => onUrl(e.target.value)}
            autoFocus={!existing}
          />
          {d.url && detectPlatform(d.url) && (
            <span className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
              <Sparkles className="h-3 w-3" /> {platformLabel(detectPlatform(d.url)!)}
            </span>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company" required>
            <Input list="company-list" value={d.company ?? ''} onChange={(e) => set('company', e.target.value)} placeholder="e.g. Razorpay" />
            <datalist id="company-list">
              {companies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Role" required>
            <Input list="role-list" value={d.role ?? ''} onChange={(e) => set('role', e.target.value)} placeholder="e.g. Senior Frontend Engineer" />
            <datalist id="role-list">
              {roles.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
        </div>

        {duplicate && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[13px]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              You already track <b>{duplicate.role}</b> at <b>{duplicate.company}</b> ({duplicate.status}
              {duplicate.appliedAt ? `, applied ${relDay(duplicate.appliedAt)}` : ''}).
            </div>
            <button type="button" className="font-medium text-amber-700 hover:underline dark:text-amber-400" onClick={() => ui.openDrawer('application', duplicate.id)}>
              Open
            </button>
          </div>
        )}

        {known.length > 0 && !existing && (
          <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-[13px]">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div className="min-w-0 flex-1">
              <div>
                You know <b>{known.length}</b> {known.length === 1 ? 'person' : 'people'} at {d.company} — a referral beats a cold apply.
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {known.slice(0, 4).map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setD((p) => ({ ...p, referrerId: c.id, method: 'referral', contactIds: Array.from(new Set([...(p.contactIds ?? []), c.id])) }))}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pl-0.5 pr-2 text-xs hover:bg-accent"
                  >
                    <Avatar name={c.name} size={18} />
                    {c.name}
                    {d.referrerId === c.id && <span className="text-emerald-600">· referrer</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Status">
            <Select value={d.status} onChange={(e) => set('status', e.target.value as Application['status'])}>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Platform / source">
            <Select value={d.platform} onChange={(e) => set('platform', e.target.value)}>
              {allPlatforms.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="How you applied">
            <Select value={d.method} onChange={(e) => set('method', e.target.value as Application['method'])}>
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={d.status === 'wishlist' ? 'Saved on' : 'Date applied'}>
            <DateInput value={d.appliedAt} onChange={(v) => set('appliedAt', v)} quickPast />
          </Field>
          <Field label="Priority">
            <Segmented
              value={String(d.priority ?? 2) as '1' | '2' | '3'}
              onChange={(v) => set('priority', Number(v) as Priority)}
              options={[
                { id: '1', label: 'Low' },
                { id: '2', label: 'Normal' },
                { id: '3', label: 'High' },
              ]}
            />
          </Field>
          <Field label="Excitement">
            <div className="flex h-9 items-center">
              <StarRating value={d.excitement ?? 0} onChange={(v) => set('excitement', v)} size={20} />
            </div>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Location">
            <Input value={d.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Bengaluru" list="loc-list" />
            <datalist id="loc-list">
              {settings.profile.targetLocations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </Field>
          <Field label="Work mode">
            <Segmented
              value={(d.workMode ?? '') as any}
              onChange={(v) => set('workMode', v === d.workMode ? undefined : (v as Application['workMode']))}
              options={WORK_MODES.map((w) => ({ id: w.id, label: w.label }))}
            />
          </Field>
          <Field label="Referrer">
            <SearchSelect
              value={d.referrerId}
              onChange={(v) => setD((p) => ({ ...p, referrerId: v, method: v ? 'referral' : p.method, contactIds: v ? Array.from(new Set([...(p.contactIds ?? []), v])) : p.contactIds }))}
              placeholder="None"
              options={contacts.map((c) => ({ value: c.id, label: c.name, hint: c.company, icon: <Avatar name={c.name} size={18} /> }))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_140px]">
          <Field label="Salary min">
            <MoneyInput value={d.salaryMin} onChange={(v) => set('salaryMin', v)} currency={d.currency ?? settings.currency} />
          </Field>
          <Field label="Salary max">
            <MoneyInput value={d.salaryMax} onChange={(v) => set('salaryMax', v)} currency={d.currency ?? settings.currency} />
          </Field>
          <Field label="Currency">
            <Select value={d.currency ?? settings.currency} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Next step" hint={d.status === 'applied' && !existing ? `Leave empty — a follow-up is auto-scheduled in ${settings.followUpDays} days.` : undefined}>
            <Input value={d.nextAction ?? ''} onChange={(e) => set('nextAction', e.target.value)} placeholder="e.g. Follow up with recruiter" />
          </Field>
          <Field label="Next step due">
            <DateInput value={d.nextActionAt} onChange={(v) => set('nextActionAt', v)} />
          </Field>
        </div>

        {!showMore ? (
          <button type="button" onClick={() => setShowMore(true)} className="text-[13px] font-medium text-primary hover:underline">
            + More details (job description, resume used, deadline, tags, notes)
          </button>
        ) : (
          <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Resume version">
                <Select value={d.resumeId ?? ''} onChange={(e) => set('resumeId', e.target.value || undefined)}>
                  <option value="">—</option>
                  {resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Job type">
                <Select value={d.jobType ?? ''} onChange={(e) => set('jobType', (e.target.value || undefined) as Application['jobType'])}>
                  <option value="">—</option>
                  {JOB_TYPES.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Application deadline">
                <DateInput value={d.deadline} onChange={(v) => set('deadline', v)} quick={false} />
              </Field>
            </div>
            <div className="flex items-center gap-2 text-[13px]">
              <Switch checked={!!d.coverLetter} onChange={(v) => set('coverLetter', v)} label="Cover letter sent" />
              Sent a cover letter
            </div>
            <Field label="Job description" hint="Paste it — Pursuit checks it against your skills & resume and lists missing keywords.">
              <Textarea value={d.jobDescription ?? ''} onChange={(e) => set('jobDescription', e.target.value)} placeholder="Paste the full job description…" maxRows={12} />
            </Field>
            <Field label="Tags">
              <TagInput value={d.tags ?? []} onChange={(v) => set('tags', v)} suggestions={['dream', 'remote', 'fintech', 'startup', 'urgent', 'relocation']} />
            </Field>
            <Field label="Notes">
              <Textarea value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Team, interview process, why you're excited…" />
            </Field>
          </div>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
