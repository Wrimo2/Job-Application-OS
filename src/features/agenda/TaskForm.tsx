import * as React from 'react';
import { useEffect, useState } from 'react';
import { ListTodo } from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store';
import { useData } from '@/lib/data';
import { saveTask } from '@/lib/actions';
import type { Priority, Task } from '@/lib/types';
import { dueInDays } from '@/lib/utils';
import { Modal } from '@/components/overlay';
import { Button, Field, Input, Segmented, Textarea } from '@/components/ui';
import { DateInput, SearchSelect } from '@/components/fields';
import { Avatar, CompanyLogo } from '@/components/common';

export function TaskFormHost() {
  const { open, id, prefill } = useUI((s) => s.taskForm);
  const close = useUI((s) => s.closeTaskForm);
  const { tasks } = useData();
  const existing = id ? tasks.find((t) => t.id === id) : undefined;
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (open) setNonce((n) => n + 1);
  }, [open, id]);
  if (!open && nonce === 0) return null;
  return <TaskForm key={nonce} open={open} onClose={close} existing={existing} prefill={prefill} />;
}

function TaskForm({ open, onClose, existing, prefill }: { open: boolean; onClose: () => void; existing?: Task; prefill?: Partial<Task> }) {
  const { apps, contacts } = useData();
  const [d, setD] = useState<Partial<Task>>(() => existing ?? { priority: 2, dueAt: dueInDays(0), ...prefill });
  const set = <K extends keyof Task>(k: K, v: Task[K] | undefined) => setD((p) => ({ ...p, [k]: v }));
  const save = async () => {
    if (!d.title?.trim()) {
      toast.error('Give the task a title');
      return;
    }
    await saveTask({ ...d, title: d.title.trim() }, existing?.id);
    toast.success(existing ? 'Task updated' : 'Task added');
    onClose();
  };
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={existing ? 'Edit task' : 'New task'}
      description="Reminders show up in your Agenda and on the Dashboard."
      icon={<ListTodo className="h-4 w-4" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {existing ? 'Save' : 'Add task'}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="What needs to happen?">
          <Input autoFocus value={d.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Finish the take-home assignment" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Due">
            <DateInput value={d.dueAt} onChange={(v) => set('dueAt', v)} />
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
          <Field label="Application">
            <SearchSelect
              value={d.applicationId}
              onChange={(v) => set('applicationId', v)}
              placeholder="None"
              options={apps.map((a) => ({ value: a.id, label: a.role, hint: a.company, icon: <CompanyLogo name={a.company} size={18} rounded="rounded" /> }))}
            />
          </Field>
          <Field label="Person">
            <SearchSelect value={d.contactId} onChange={(v) => set('contactId', v)} placeholder="None" options={contacts.map((c) => ({ value: c.id, label: c.name, hint: c.company, icon: <Avatar name={c.name} size={18} /> }))} />
          </Field>
        </div>
        <Field label="Notes">
          <Textarea value={d.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Details, links, checklist…" />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
