import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Sparkles, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store';
import { useData } from '@/lib/data';
import { createContact, enrollContacts, updateContact, linkContactToApplication } from '@/lib/actions';
import { CONTACT_STAGES, RELATIONSHIPS, WARMTH } from '@/lib/constants';
import { guessRelationship } from '@/lib/io';
import type { Contact, Priority } from '@/lib/types';
import { companyKey } from '@/lib/utils';
import { Modal } from '@/components/overlay';
import { Button, Field, Input, Segmented, Select, Textarea } from '@/components/ui';
import { DateInput, SearchSelect, TagInput } from '@/components/fields';
import { CompanyLogo } from '@/components/common';

export function ContactFormHost() {
  const { open, id, prefill } = useUI((s) => s.contactForm);
  const close = useUI((s) => s.closeContactForm);
  const { contacts } = useData();
  const existing = id ? contacts.find((c) => c.id === id) : undefined;
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (open) setNonce((n) => n + 1);
  }, [open, id]);
  if (!open && nonce === 0) return null;
  return <ContactForm key={nonce} open={open} onClose={close} existing={existing} prefill={prefill} />;
}

function ContactForm({ open, onClose, existing, prefill }: { open: boolean; onClose: () => void; existing?: Contact; prefill?: Partial<Contact> }) {
  const ui = useUI();
  const { apps, contacts, sequences } = useData();
  const [d, setD] = useState<Partial<Contact>>(
    () => existing ?? { stage: 'target', warmth: 'cold', relationship: 'recruiter', priority: 2, tags: [], applicationIds: [], ...prefill },
  );
  const [seqId, setSeqId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Contact>(k: K, v: Contact[K] | undefined) => setD((p) => ({ ...p, [k]: v }));
  const companies = useMemo(() => Array.from(new Set([...apps.map((a) => a.company), ...contacts.map((c) => c.company).filter(Boolean) as string[]])).sort(), [apps, contacts]);
  const companyApps = useMemo(() => apps.filter((a) => d.company && companyKey(a.company) === companyKey(d.company)), [apps, d.company]);
  const dup = useMemo(
    () =>
      !existing && d.name
        ? contacts.find((c) => c.name.trim().toLowerCase() === d.name!.trim().toLowerCase() && (!d.company || companyKey(c.company) === companyKey(d.company)))
        : undefined,
    [contacts, d.name, d.company, existing],
  );

  const save = async () => {
    if (!d.name?.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        await updateContact(existing.id, d);
        for (const appId of d.applicationIds ?? []) await linkContactToApplication(existing.id, appId);
        toast.success('Contact updated');
      } else {
        const c = await createContact(d);
        if (seqId) {
          const n = await enrollContacts(seqId, [c.id], { applicationId: c.applicationIds[0] });
          if (n) toast.success(`${c.name} added and enrolled`, { description: 'First step is in your outreach queue.' });
        } else {
          toast.success(`${c.name} added`, { action: { label: 'Open', onClick: () => ui.openDrawer('contact', c.id) } });
        }
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={existing ? 'Edit contact' : 'Add a person'}
      description={existing ? existing.name : 'Recruiters, hiring managers, referrers, alumni — anyone who can help.'}
      icon={<UserPlus className="h-4 w-4" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {existing ? 'Save changes' : seqId ? 'Add & start sequence' : 'Add contact'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input autoFocus value={d.name ?? ''} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Priya Sharma" />
          </Field>
          <Field label="Title">
            <Input
              value={d.title ?? ''}
              onChange={(e) => {
                const title = e.target.value;
                setD((p) => ({ ...p, title, relationship: existing || p.relationship !== 'recruiter' ? p.relationship : guessRelationship(title) }));
              }}
              placeholder="e.g. Engineering Manager"
            />
          </Field>
          <Field label="Company">
            <div className="flex items-center gap-2">
              {d.company && <CompanyLogo name={d.company} size={36} />}
              <Input list="contact-companies" value={d.company ?? ''} onChange={(e) => set('company', e.target.value)} placeholder="e.g. Razorpay" />
            </div>
            <datalist id="contact-companies">
              {companies.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Relationship">
            <Select value={d.relationship} onChange={(e) => set('relationship', e.target.value as Contact['relationship'])}>
              {RELATIONSHIPS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {dup && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-700 dark:text-amber-300">
            Looks like {dup.name} is already in your contacts.{' '}
            <button type="button" className="font-medium underline" onClick={() => ui.openDrawer('contact', dup.id)}>
              Open
            </button>
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Pipeline stage">
            <Select value={d.stage} onChange={(e) => set('stage', e.target.value as Contact['stage'])}>
              {CONTACT_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Warmth">
            <Segmented value={d.warmth ?? 'cold'} onChange={(v) => set('warmth', v)} options={WARMTH.map((w) => ({ id: w.id, label: `${w.emoji} ${w.label}` }))} />
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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="LinkedIn URL">
            <Input value={d.linkedin ?? ''} onChange={(e) => set('linkedin', e.target.value)} placeholder="linkedin.com/in/…" />
          </Field>
          <Field label="Email" hint={!d.email && d.name && d.company ? 'Tip: use Outreach → Toolkit → Email finder to guess it.' : undefined}>
            <Input type="email" value={d.email ?? ''} onChange={(e) => set('email', e.target.value)} placeholder="name@company.com" />
          </Field>
          <Field label="Phone / WhatsApp">
            <Input value={d.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+91 …" />
          </Field>
          <Field label="X / Twitter">
            <Input value={d.twitter ?? ''} onChange={(e) => set('twitter', e.target.value)} placeholder="@handle" />
          </Field>
        </div>

        <div className="space-y-4 rounded-xl border bg-gradient-to-br from-primary/[0.05] to-transparent p-4">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Personalization hooks
            <span className="font-normal text-muted-foreground">— these auto-fill your templates</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Common ground" hint="Shared school, team, a post they wrote, a talk you saw…">
              <Input value={d.commonGround ?? ''} onChange={(e) => set('commonGround', e.target.value)} placeholder="e.g. Loved their post on design systems" />
            </Field>
            <Field label="Mutual connection">
              <Input value={d.mutualConnection ?? ''} onChange={(e) => set('mutualConnection', e.target.value)} placeholder="e.g. Rohan Gupta" />
            </Field>
            <Field label="Where you found them">
              <Input value={d.source ?? ''} onChange={(e) => set('source', e.target.value)} placeholder="e.g. LinkedIn “hiring” post" list="sources" />
              <datalist id="sources">
                {['LinkedIn search', 'LinkedIn “hiring” post', 'Alumni search', 'Company website', 'X (Twitter)', 'Referral from friend', 'Meetup / event', 'Naukri recruiter message'].map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Next follow-up">
              <DateInput value={d.nextFollowUpAt} onChange={(v) => set('nextFollowUpAt', v)} />
            </Field>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Link to an application">
            <SearchSelect
              value={d.applicationIds?.[0]}
              onChange={(v) => set('applicationIds', v ? Array.from(new Set([v, ...(d.applicationIds ?? [])])) : (d.applicationIds ?? []).slice(1))}
              placeholder={companyApps.length ? `${companyApps.length} at ${d.company}` : 'None'}
              options={[...companyApps, ...apps.filter((a) => !companyApps.includes(a))].map((a) => ({ value: a.id, label: a.role, hint: a.company, icon: <CompanyLogo name={a.company} size={18} rounded="rounded" /> }))}
            />
          </Field>
          {!existing && (
            <Field label="Start a sequence" hint="Pursuit schedules each step and drafts the message.">
              <Select value={seqId} onChange={(e) => setSeqId(e.target.value)}>
                <option value="">Don’t start now</option>
                {sequences.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.steps.length} steps)
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>

        <Field label="Tags">
          <TagInput value={d.tags ?? []} onChange={(v) => set('tags', v)} suggestions={['referrer', 'alumni', 'warm-intro', 'decision-maker', 'mentor']} />
        </Field>
        <Field label="Notes">
          <Textarea value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Context, what they care about, what you talked about…" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
