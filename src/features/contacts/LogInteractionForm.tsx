import * as React from 'react';
import { useEffect, useState } from 'react';
import { NotebookPen } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store';
import { useData } from '@/lib/data';
import { CONTACT_FOLLOWUP_DAYS, logInteraction, markReplied, updateContact } from '@/lib/actions';
import { CHANNELS, INTERACTION_KINDS } from '@/lib/constants';
import type { Channel, InteractionKind, InteractionOutcome } from '@/lib/types';
import { dueInDays, nowISO } from '@/lib/utils';
import { Modal } from '@/components/overlay';
import { Button, Field, Select, Textarea } from '@/components/ui';
import { DateInput, DateTimeInput, SearchSelect } from '@/components/fields';
import { Avatar, CompanyLogo } from '@/components/common';

export function LogInteractionHost() {
  const { open, contactId, applicationId } = useUI((s) => s.logForm);
  const close = useUI((s) => s.closeLog);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (open) setNonce((n) => n + 1);
  }, [open]);
  if (!open && nonce === 0) return null;
  return <LogForm key={nonce} open={open} onClose={close} contactId={contactId} applicationId={applicationId} />;
}

function LogForm({ open, onClose, contactId: initialContact, applicationId: initialApp }: { open: boolean; onClose: () => void; contactId?: string; applicationId?: string }) {
  const { contacts, apps, templates } = useData();
  const [contactId, setContactId] = useState(initialContact);
  const contact = contacts.find((c) => c.id === contactId);
  const [applicationId, setApplicationId] = useState(initialApp ?? contact?.applicationIds[0]);
  const [kind, setKind] = useState<InteractionKind>('message');
  const [channel, setChannel] = useState<Channel>('linkedin');
  const [date, setDate] = useState<string | undefined>(nowISO());
  const [outcome, setOutcome] = useState<InteractionOutcome>('awaiting');
  const [templateId, setTemplateId] = useState<string>('');
  const [content, setContent] = useState('');
  const [followUp, setFollowUp] = useState<string | undefined>(dueInDays(CONTACT_FOLLOWUP_DAYS));
  const [saving, setSaving] = useState(false);
  const isReply = kind === 'reply';
  const outbound = INTERACTION_KINDS.find((k) => k.id === kind)?.outbound;

  const save = async () => {
    if (!contactId && kind !== 'note') {
      toast.error('Pick who this was with');
      return;
    }
    setSaving(true);
    try {
      if (isReply && contactId) {
        await markReplied(contactId, outcome === 'positive' ? 'positive' : outcome === 'negative' ? 'negative' : 'neutral', content || undefined);
        toast.success('Reply logged — sequence stopped and stats updated');
      } else {
        await logInteraction({
          contactId,
          applicationId,
          kind,
          channel,
          date: date ?? nowISO(),
          outcome: outbound ? outcome : undefined,
          templateId: templateId || undefined,
          content: content || undefined,
        });
        if (contactId && outbound) await updateContact(contactId, { nextFollowUpAt: outcome === 'awaiting' ? followUp : undefined });
        toast.success('Logged', { description: outbound && outcome === 'awaiting' && followUp ? 'Follow-up reminder scheduled.' : undefined });
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
      title="Log outreach"
      description="Record a message, call or reply — it powers your follow-ups and reply-rate stats."
      icon={<NotebookPen className="h-4 w-4" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Person">
            <SearchSelect
              value={contactId}
              onChange={(v) => {
                setContactId(v);
                const c = contacts.find((x) => x.id === v);
                if (c?.applicationIds[0]) setApplicationId(c.applicationIds[0]);
              }}
              placeholder="Who?"
              options={contacts.map((c) => ({ value: c.id, label: c.name, hint: c.company, icon: <Avatar name={c.name} size={18} /> }))}
            />
          </Field>
          <Field label="Application (optional)">
            <SearchSelect
              value={applicationId}
              onChange={setApplicationId}
              placeholder="None"
              options={apps.map((a) => ({ value: a.id, label: a.role, hint: a.company, icon: <CompanyLogo name={a.company} size={18} rounded="rounded" /> }))}
            />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="What happened">
            <Select value={kind} onChange={(e) => { const k = e.target.value as InteractionKind; setKind(k); setOutcome(k === 'reply' ? 'replied' : 'awaiting'); if (k === 'email' || k === 'follow_up') setChannel(k === 'email' ? 'email' : channel); }}>
              {INTERACTION_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as Channel)} disabled={isReply}>
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="When">
            <DateTimeInput value={date} onChange={setDate} />
          </Field>
        </div>
        {(outbound || isReply) && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={isReply ? 'How did it go?' : 'Outcome'}>
              <Select value={outcome} onChange={(e) => setOutcome(e.target.value as InteractionOutcome)}>
                {isReply ? (
                  <>
                    <option value="replied">Neutral / informational</option>
                    <option value="positive">Positive — wants to help</option>
                    <option value="negative">Negative — not now</option>
                  </>
                ) : (
                  <>
                    <option value="awaiting">Awaiting reply</option>
                    <option value="accepted">Connection accepted</option>
                    <option value="replied">They replied</option>
                    <option value="positive">Positive reply</option>
                    <option value="negative">Negative reply</option>
                    <option value="no_reply">No reply</option>
                  </>
                )}
              </Select>
            </Field>
            {!isReply && (
              <Field label="Template used">
                <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">None / custom</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            {!isReply && outcome === 'awaiting' && (
              <Field label="Remind me to follow up">
                <DateInput value={followUp} onChange={setFollowUp} />
              </Field>
            )}
          </div>
        )}
        <Field label={isReply ? 'What did they say?' : 'Message / notes'}>
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={isReply ? 'Paste their reply or summarize…' : 'Paste what you sent (optional)…'} />
        </Field>
      </div>
    </Modal>
  );
}
