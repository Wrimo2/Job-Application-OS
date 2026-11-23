import * as React from 'react';
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Ellipsis, Pencil, Plus, Repeat, Trash2, UserPlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { confirmDialog, useUI } from '@/lib/store';
import { deleteSequence, saveSequence } from '@/lib/actions';
import { CHANNELS, CHANNEL_LABEL, INTERACTION_KINDS } from '@/lib/constants';
import { gotReply, isOutreach } from '@/lib/stats';
import type { Channel, InteractionKind, Sequence, SequenceStep } from '@/lib/types';
import { cn, fmtPct, uid } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea } from '@/components/ui';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal } from '@/components/overlay';
import { Avatar, ChannelIcon } from '@/components/common';

export default function SequencesTab() {
  const ui = useUI();
  const { sequences, enrollments, interactions, contacts, templates } = useData();
  const [editing, setEditing] = useState<Sequence | 'new' | null>(null);
  const tName = new Map(templates.map((t) => [t.id, t.name]));

  const stats = useMemo(
    () =>
      new Map(
        sequences.map((s) => {
          const es = enrollments.filter((e) => e.sequenceId === s.id);
          const touches = interactions.filter((i) => isOutreach(i) && es.some((e) => e.id === i.enrollmentId));
          return [
            s.id,
            {
              active: es.filter((e) => e.status === 'active' || e.status === 'paused'),
              completed: es.filter((e) => e.status === 'completed').length,
              replied: es.filter((e) => e.status === 'replied').length,
              rate: touches.length ? (touches.filter(gotReply).length / touches.length) * 100 : null,
            },
          ];
        }),
      ),
    [sequences, enrollments, interactions],
  );

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 bg-gradient-to-br from-primary/[0.06] to-transparent p-4 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="text-[14px] font-semibold">How sequences work</div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Enroll people → each step appears in your queue on the right day with the message pre-drafted → you send it and click <b>Copy & mark sent</b> → the next step is scheduled. A reply stops the sequence automatically.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> New sequence
        </Button>
      </Card>

      {sequences.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {sequences.map((s) => {
            const st = stats.get(s.id)!;
            return (
              <Card key={s.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Repeat className="h-4 w-4 text-primary" />
                      <span className="truncate text-[14.5px] font-semibold">{s.name}</span>
                    </div>
                    {s.description && <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{s.description}</p>}
                  </div>
                  <Menu>
                    <MenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" aria-label="Sequence actions">
                        <Ellipsis className="h-4 w-4" />
                      </Button>
                    </MenuTrigger>
                    <MenuContent>
                      <MenuItem icon={<Pencil />} onSelect={() => setEditing(s)}>
                        Edit steps
                      </MenuItem>
                      <MenuItem
                        icon={<Copy />}
                        onSelect={async () => {
                          await saveSequence({ name: `${s.name} (copy)`, description: s.description, steps: s.steps.map((x) => ({ ...x, id: uid() })) });
                          toast.success('Sequence duplicated');
                        }}
                      >
                        Duplicate
                      </MenuItem>
                      <MenuSeparator />
                      <MenuItem
                        icon={<Trash2 />}
                        danger
                        onSelect={async () => {
                          const ok = await confirmDialog({ title: `Delete “${s.name}”?`, description: 'Active enrollments will be stopped.', confirmLabel: 'Delete', danger: true });
                          if (ok) {
                            await deleteSequence(s.id);
                            toast.success('Sequence deleted');
                          }
                        }}
                      >
                        Delete
                      </MenuItem>
                    </MenuContent>
                  </Menu>
                </div>

                <ol className="mt-4 space-y-0">
                  {s.steps.map((step, i) => (
                    <li key={step.id} className="relative flex gap-3 pb-3 last:pb-0">
                      {i < s.steps.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-border" />}
                      <div className="z-[1] grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-card text-muted-foreground">
                        <ChannelIcon channel={step.channel} />
                      </div>
                      <div className="min-w-0 pt-0.5">
                        <div className="text-[13px] font-medium">
                          <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">Day {step.day}</span>
                          {step.title}
                        </div>
                        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                          {CHANNEL_LABEL[step.channel]}
                          {step.templateId ? ` · ${tName.get(step.templateId) ?? 'missing template'}` : ''}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                    <Badge tone="primary">{st.active.length} active</Badge>
                    <span>{st.replied} replied</span>
                    <span>· {st.completed} finished</span>
                    {st.rate !== null && <span>· {fmtPct(st.rate)} response</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {st.active.slice(0, 4).map((e) => {
                        const c = contacts.find((x) => x.id === e.contactId);
                        return c ? <Avatar key={e.id} name={c.name} size={24} /> : null;
                      })}
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => ui.openEnroll([], s.id)}>
                      <UserPlus className="h-3.5 w-3.5" /> Enroll
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Repeat className="h-6 w-6" />} title="No sequences" description="Create a multi-step cadence — or restore the built-ins from the Templates tab." />
        </Card>
      )}

      {editing && <SequenceEditor seq={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SequenceEditor({ seq, onClose }: { seq?: Sequence; onClose: () => void }) {
  const { templates } = useData();
  const [name, setName] = useState(seq?.name ?? '');
  const [description, setDescription] = useState(seq?.description ?? '');
  const [steps, setSteps] = useState<SequenceStep[]>(
    seq?.steps ?? [
      { id: uid(), day: 0, channel: 'linkedin', kind: 'connection_request', title: 'Send a connection request', templateId: 'tpl-conn-peer' },
      { id: uid(), day: 3, channel: 'linkedin', kind: 'message', title: 'Send your ask', templateId: 'tpl-dm-advice' },
      { id: uid(), day: 8, channel: 'linkedin', kind: 'follow_up', title: 'Gentle bump', templateId: 'tpl-fu-bump' },
    ],
  );
  const upd = (id: string, patch: Partial<SequenceStep>) => setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setSteps((s) => {
      const n = [...s];
      const j = i + dir;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const save = async () => {
    if (!name.trim() || !steps.length) {
      toast.error('Give it a name and at least one step');
      return;
    }
    const sorted = [...steps].sort((a, b) => a.day - b.day);
    await saveSequence({ name: name.trim(), description, steps: sorted }, seq?.id);
    toast.success(seq ? 'Sequence saved' : 'Sequence created');
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={seq ? 'Edit sequence' : 'New sequence'}
      description="Steps are scheduled relative to when the previous step was actually done."
      icon={<Repeat className="h-4 w-4" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save sequence
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alumni referral" autoFocus />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When to use it" />
          </Field>
        </div>
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={s.id} className="rounded-xl border bg-card p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">{i + 1}</span>
                <Input value={s.title} onChange={(e) => upd(s.id, { title: e.target.value })} className="h-8 flex-1" placeholder="What to do" />
                <Button size="icon-xs" variant="ghost" onClick={() => move(i, -1)} aria-label="Move up" disabled={i === 0}>
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon-xs" variant="ghost" onClick={() => move(i, 1)} aria-label="Move down" disabled={i === steps.length - 1}>
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button size="icon-xs" variant="ghost" onClick={() => setSteps((x) => x.filter((y) => y.id !== s.id))} aria-label="Remove step">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-[90px_1fr_1fr_1.4fr]">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] text-muted-foreground">Day</span>
                  <Input type="number" min={0} value={s.day} onChange={(e) => upd(s.id, { day: Math.max(0, Number(e.target.value) || 0) })} className="h-8" />
                </div>
                <Select value={s.channel} onChange={(e) => upd(s.id, { channel: e.target.value as Channel })} className="h-8 text-[13px]">
                  {CHANNELS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
                <Select value={s.kind} onChange={(e) => upd(s.id, { kind: e.target.value as InteractionKind })} className="h-8 text-[13px]">
                  {INTERACTION_KINDS.filter((k) => k.outbound).map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </Select>
                <Select value={s.templateId ?? ''} onChange={(e) => upd(s.id, { templateId: e.target.value || undefined })} className="h-8 text-[13px]">
                  <option value="">No template (manual step)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSteps((x) => [...x, { id: uid(), day: (x[x.length - 1]?.day ?? 0) + 5, channel: 'linkedin', kind: 'follow_up', title: 'Follow up', templateId: 'tpl-fu-bump' }])}
          >
            <Plus className="h-3.5 w-3.5" /> Add step
          </Button>
        </div>
        <p className={cn('text-[12px] text-muted-foreground')}>Tip: 3–5 touches over ~2–3 weeks is plenty. Space follow-ups 3–7 days apart and make each one add something new.</p>
      </div>
    </Modal>
  );
}
