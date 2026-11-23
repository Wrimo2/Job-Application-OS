import * as React from 'react';
import { useEffect, useState } from 'react';
import { CalendarPlus, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store';
import { useData } from '@/lib/data';
import { saveInterview, saveQuestion } from '@/lib/actions';
import { DEFAULT_CHECKLIST, INTERVIEW_TYPES } from '@/lib/constants';
import type { Interview, InterviewOutcome } from '@/lib/types';
import { dueInDays, uid } from '@/lib/utils';
import { Modal } from '@/components/overlay';
import { Button, Field, Input, Segmented, Select, StarRating, Switch, Textarea } from '@/components/ui';
import { DateTimeInput, SearchSelect } from '@/components/fields';
import { CompanyLogo } from '@/components/common';

export function InterviewFormHost() {
  const st = useUI((s) => s.interviewForm);
  const close = useUI((s) => s.closeInterviewForm);
  const { interviews } = useData();
  const existing = st.id ? interviews.find((i) => i.id === st.id) : undefined;
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (st.open) setNonce((n) => n + 1);
  }, [st.open, st.id]);
  if (!st.open && nonce === 0) return null;
  return <InterviewForm key={nonce} open={st.open} onClose={close} existing={existing} applicationId={st.applicationId} prefill={st.prefill} />;
}

const ROUNDS = ['Recruiter screen', 'HR round', 'Technical round 1', 'Technical round 2', 'Coding round', 'System design', 'Machine coding', 'Take-home assignment', 'Hiring manager round', 'Culture fit', 'Bar raiser', 'Final round'];

function defaultStart(): string {
  const d = new Date(dueInDays(1));
  d.setHours(11, 0, 0, 0);
  return d.toISOString();
}

function InterviewForm({ open, onClose, existing, applicationId, prefill }: { open: boolean; onClose: () => void; existing?: Interview; applicationId?: string; prefill?: Partial<Interview> }) {
  const { apps } = useData();
  const [d, setD] = useState<Partial<Interview>>(
    () =>
      existing ?? {
        applicationId,
        round: 'Technical round 1',
        type: 'technical',
        scheduledAt: defaultStart(),
        durationMins: 60,
        mode: 'video',
        outcome: 'scheduled',
        checklist: DEFAULT_CHECKLIST.map((text) => ({ id: uid(), text, done: false })),
        ...prefill,
      },
  );
  const [newItem, setNewItem] = useState('');
  const [toBank, setToBank] = useState(true);
  const set = <K extends keyof Interview>(k: K, v: Interview[K] | undefined) => setD((p) => ({ ...p, [k]: v }));
  const app = apps.find((a) => a.id === d.applicationId);
  const past = !!d.scheduledAt && new Date(d.scheduledAt) < new Date();

  const save = async () => {
    if (!d.applicationId) {
      toast.error('Pick the application this interview is for');
      return;
    }
    const iv = await saveInterview({ ...d, applicationId: d.applicationId }, existing?.id);
    if (toBank && d.questionsAsked?.trim() && d.questionsAsked !== existing?.questionsAsked) {
      const lines = d.questionsAsked
        .split('\n')
        .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
        .filter((l) => l.length > 6);
      for (const text of lines) await saveQuestion({ text, category: d.type === 'behavioral' || d.type === 'hiring_manager' ? 'behavioral' : d.type === 'system_design' ? 'system_design' : d.type === 'hr' || d.type === 'phone_screen' ? 'hr' : 'technical', company: app?.company, applicationId: app?.id, confidence: 2 });
      if (lines.length) toast.success(`Added ${lines.length} question${lines.length > 1 ? 's' : ''} to your question bank`);
    }
    toast.success(existing ? 'Interview updated' : 'Interview scheduled', { description: existing ? undefined : 'Prep checklist created. Add it to your calendar from the interview card.' });
    onClose();
    return iv;
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={existing ? 'Edit interview' : 'Schedule an interview'}
      description={app ? `${app.role} · ${app.company}` : 'Every round gets a prep checklist and a thank-you reminder.'}
      icon={<CalendarPlus className="h-4 w-4" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {existing ? 'Save' : 'Schedule'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Application" required>
            <SearchSelect
              value={d.applicationId}
              onChange={(v) => set('applicationId', v)}
              placeholder="Which job?"
              allowClear={false}
              options={apps.filter((a) => a.status !== 'wishlist').map((a) => ({ value: a.id, label: a.role, hint: a.company, icon: <CompanyLogo name={a.company} size={18} rounded="rounded" /> }))}
            />
          </Field>
          <Field label="Round">
            <Input list="rounds" value={d.round ?? ''} onChange={(e) => set('round', e.target.value)} />
            <datalist id="rounds">
              {ROUNDS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </Field>
          <Field label="Type">
            <Select value={d.type} onChange={(e) => set('type', e.target.value as Interview['type'])}>
              {INTERVIEW_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Date & time">
            <DateTimeInput value={d.scheduledAt} onChange={(v) => set('scheduledAt', v)} />
          </Field>
          <Field label="Duration">
            <Select value={d.durationMins} onChange={(e) => set('durationMins', Number(e.target.value))}>
              {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? 's' : ''}`}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Mode">
            <Segmented
              value={d.mode ?? 'video'}
              onChange={(v) => set('mode', v)}
              options={[
                { id: 'video', label: 'Video' },
                { id: 'phone', label: 'Phone' },
                { id: 'onsite', label: 'On-site' },
              ]}
            />
          </Field>
          <Field label={d.mode === 'onsite' ? 'Address' : 'Meeting link'}>
            <Input value={d.location ?? ''} onChange={(e) => set('location', e.target.value)} placeholder={d.mode === 'onsite' ? 'Office address' : 'https://meet.google.com/…'} />
          </Field>
          <Field label="Interviewers">
            <Input value={d.interviewers ?? ''} onChange={(e) => set('interviewers', e.target.value)} placeholder="Names & roles — look them up on LinkedIn" />
          </Field>
        </div>

        <Field label="Prep notes">
          <Textarea value={d.prepNotes ?? ''} onChange={(e) => set('prepNotes', e.target.value)} placeholder="What to expect, topics to revise, stories to tell, questions to ask…" />
        </Field>

        <div>
          <div className="label-caps mb-2">Prep checklist</div>
          <div className="space-y-1.5">
            {(d.checklist ?? []).map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={() => set('checklist', (d.checklist ?? []).map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))}
                  className="h-4 w-4 accent-[hsl(var(--primary))]"
                />
                <span className="flex-1 text-[13px]">{c.text}</span>
                <button aria-label="Remove item" onClick={() => set('checklist', (d.checklist ?? []).filter((x) => x.id !== c.id))} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newItem.trim()) {
                    e.preventDefault();
                    set('checklist', [...(d.checklist ?? []), { id: uid(), text: newItem.trim(), done: false }]);
                    setNewItem('');
                  }
                }}
                placeholder="Add a prep item…"
                className="h-8"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  if (!newItem.trim()) return;
                  set('checklist', [...(d.checklist ?? []), { id: uid(), text: newItem.trim(), done: false }]);
                  setNewItem('');
                }}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {(existing || past) && (
          <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
            <div className="text-[13px] font-semibold">After the interview</div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Outcome">
                <Select value={d.outcome} onChange={(e) => set('outcome', e.target.value as InterviewOutcome)}>
                  <option value="scheduled">Scheduled</option>
                  <option value="awaiting">Done — awaiting result</option>
                  <option value="passed">Passed</option>
                  <option value="failed">Not selected</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </Field>
              <Field label="How did it go?">
                <div className="flex h-9 items-center">
                  <StarRating value={d.selfRating ?? 0} onChange={(v) => set('selfRating', v)} size={20} />
                </div>
              </Field>
              <Field label="Thank-you sent">
                <div className="flex h-9 items-center">
                  <Switch checked={!!d.thankYouSent} onChange={(v) => set('thankYouSent', v)} label="Thank-you sent" />
                </div>
              </Field>
            </div>
            <Field label="Questions they asked" hint="One per line.">
              <Textarea value={d.questionsAsked ?? ''} onChange={(e) => set('questionsAsked', e.target.value)} placeholder={'Design a rate limiter\nTell me about a conflict with a teammate'} />
            </Field>
            <label className="flex items-center gap-2 text-[13px]">
              <Switch checked={toBank} onChange={setToBank} label="Save to question bank" /> Save new questions to my question bank for practice
            </label>
            <Field label="Reflection — what went well, what to improve">
              <Textarea value={d.reflection ?? ''} onChange={(e) => set('reflection', e.target.value)} placeholder="Be honest — this is how you get better every round." />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}
