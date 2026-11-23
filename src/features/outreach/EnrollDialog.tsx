import * as React from 'react';
import { useEffect, useState } from 'react';
import { Repeat, X } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store';
import { useData } from '@/lib/data';
import { enrollContacts } from '@/lib/actions';
import { CHANNEL_LABEL } from '@/lib/constants';
import { cn, plural } from '@/lib/utils';
import { Modal } from '@/components/overlay';
import { Button, Field } from '@/components/ui';
import { SearchSelect } from '@/components/fields';
import { Avatar, ChannelIcon, CompanyLogo } from '@/components/common';

export function EnrollHost() {
  const st = useUI((s) => s.enroll);
  const close = useUI((s) => s.closeEnroll);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (st.open) setNonce((n) => n + 1);
  }, [st.open]);
  if (!st.open && nonce === 0) return null;
  return <EnrollDialog key={nonce} open={st.open} onClose={close} contactIds={st.contactIds} sequenceId={st.sequenceId} applicationId={st.applicationId} />;
}

function EnrollDialog({ open, onClose, contactIds, sequenceId, applicationId }: { open: boolean; onClose: () => void; contactIds: string[]; sequenceId?: string; applicationId?: string }) {
  const { sequences, contacts, apps, enrollments } = useData();
  const [seqId, setSeqId] = useState(sequenceId ?? sequences[0]?.id);
  const [ids, setIds] = useState<string[]>(contactIds);
  const [appId, setAppId] = useState<string | undefined>(applicationId);
  const [busy, setBusy] = useState(false);
  const seq = sequences.find((s) => s.id === seqId);
  const people = contacts.filter((c) => ids.includes(c.id));
  const alreadyIn = (cid: string) => enrollments.some((e) => e.contactId === cid && e.sequenceId === seqId && (e.status === 'active' || e.status === 'paused'));

  const run = async () => {
    if (!seqId || !ids.length) return;
    setBusy(true);
    try {
      const n = await enrollContacts(seqId, ids, { applicationId: appId });
      toast.success(n ? `${plural(n, 'person', 'people')} enrolled in “${seq?.name}”` : 'Everyone was already in this sequence', {
        description: n ? 'Today’s steps are waiting in your Outreach queue.' : undefined,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Start an outreach sequence"
      description="Pursuit schedules every step, drafts each message from your templates and reminds you when it’s due. Replies stop the sequence automatically."
      icon={<Repeat className="h-4 w-4" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} disabled={!ids.length || !seqId} onClick={run}>
            Enroll {plural(ids.length, 'person', 'people')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2">
          {sequences.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeqId(s.id)}
              className={cn('rounded-xl border p-3 text-left transition-all hover:border-foreground/20', seqId === s.id && 'border-primary/50 bg-primary/5 ring-1 ring-primary/30')}
            >
              <div className="text-[13.5px] font-semibold">{s.name}</div>
              <p className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">{s.description}</p>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                {s.steps.map((st, i) => (
                  <span key={st.id} className="inline-flex items-center gap-1">
                    {i > 0 && <span className="opacity-40">→</span>}
                    <span className="inline-flex items-center gap-0.5 rounded bg-muted px-1 py-0.5">
                      <ChannelIcon channel={st.channel} className="h-3 w-3" />D{st.day}
                    </span>
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>

        {seq && (
          <div className="rounded-xl border bg-muted/30 p-3">
            <div className="label-caps mb-2">Steps</div>
            <ol className="space-y-1.5">
              {seq.steps.map((st, i) => (
                <li key={st.id} className="flex items-center gap-2 text-[13px]">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
                  <span className="w-12 shrink-0 text-muted-foreground">Day {st.day}</span>
                  <ChannelIcon channel={st.channel} />
                  <span className="truncate">{st.title}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{CHANNEL_LABEL[st.channel]}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="People">
            <SearchSelect
              value={undefined}
              onChange={(v) => v && setIds((x) => Array.from(new Set([...x, v])))}
              placeholder="Add a person…"
              allowClear={false}
              options={contacts.filter((c) => !ids.includes(c.id)).map((c) => ({ value: c.id, label: c.name, hint: c.company, icon: <Avatar name={c.name} size={18} /> }))}
            />
          </Field>
          <Field label="For application (optional)" hint="Fills {{role}} and {{jobLink}} in messages.">
            <SearchSelect
              value={appId}
              onChange={setAppId}
              placeholder="Use each person’s linked job"
              options={apps.map((a) => ({ value: a.id, label: a.role, hint: a.company, icon: <CompanyLogo name={a.company} size={18} rounded="rounded" /> }))}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {people.map((c) => (
            <span key={c.id} className={cn('inline-flex items-center gap-1.5 rounded-full border bg-card py-0.5 pl-0.5 pr-1.5 text-[12.5px]', alreadyIn(c.id) && 'opacity-60')}>
              <Avatar name={c.name} size={20} />
              {c.name}
              {alreadyIn(c.id) && <span className="text-[11px] text-muted-foreground">(already in)</span>}
              <button aria-label={`Remove ${c.name}`} onClick={() => setIds((x) => x.filter((y) => y !== c.id))} className="rounded-full p-0.5 hover:bg-accent">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!people.length && <span className="text-[13px] text-muted-foreground">Add at least one person.</span>}
        </div>
      </div>
    </Modal>
  );
}
