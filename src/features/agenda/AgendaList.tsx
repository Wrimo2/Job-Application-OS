import * as React from 'react';
import { Briefcase, CalendarDays, Check, Clock, Ellipsis, Flag, Heart, MessageSquare, MessageSquareReply, Pencil, Repeat, Send, SkipForward, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUI, undoToast } from '@/lib/store';
import { useData } from '@/lib/data';
import {
  completeAppAction,
  completeContactFollowUp,
  completeEnrollmentStep,
  deleteTask,
  markReplied,
  saveInterview,
  skipEnrollmentStep,
  snoozeItem,
  toggleTask,
} from '@/lib/actions';
import { BUCKET_LABEL, type AgendaBucket, type AgendaItem } from '@/lib/stats';
import { cn, fmtTime, relDay } from '@/lib/utils';
import { Button } from '@/components/ui';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tip } from '@/components/overlay';
import { ChannelIcon } from '@/components/common';

const KIND_STYLE: Record<AgendaItem['kind'], { icon: React.ReactNode; cls: string; label: string }> = {
  sequence: { icon: <Repeat className="h-4 w-4" />, cls: 'bg-primary/10 text-primary', label: 'Sequence step' },
  contact: { icon: <MessageSquare className="h-4 w-4" />, cls: 'bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400', label: 'Follow-up' },
  app: { icon: <Briefcase className="h-4 w-4" />, cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', label: 'Application' },
  task: { icon: <Check className="h-4 w-4" />, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'Task' },
  interview: { icon: <CalendarDays className="h-4 w-4" />, cls: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', label: 'Interview' },
  thankyou: { icon: <Heart className="h-4 w-4" />, cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', label: 'Thank-you' },
  deadline: { icon: <Flag className="h-4 w-4" />, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Deadline' },
};

export function AgendaRow({ item, dense }: { item: AgendaItem; dense?: boolean }) {
  const ui = useUI();
  const { interviews, contacts } = useData();
  const st = KIND_STYLE[item.kind];

  const open = () => {
    if (item.kind === 'interview' || item.kind === 'thankyou') return item.appId && ui.openDrawer('application', item.appId, 'interviews');
    if (item.contactId && (item.kind === 'sequence' || item.kind === 'contact')) return ui.openDrawer('contact', item.contactId);
    if (item.kind === 'task' && item.taskId) return ui.openTaskForm(item.taskId);
    if (item.appId) return ui.openDrawer('application', item.appId);
    if (item.contactId) return ui.openDrawer('contact', item.contactId);
  };

  const write = () => {
    if (item.kind === 'sequence') ui.openComposer({ contactId: item.contactId, enrollmentId: item.enrollmentId, applicationId: item.appId, templateId: item.templateId });
    else if (item.kind === 'contact') ui.openComposer({ contactId: item.contactId, templateId: item.templateId });
    else if (item.kind === 'thankyou') ui.openComposer({ applicationId: item.appId, templateId: 'tpl-ty-interview', interviewId: item.interviewId });
    else if (item.kind === 'app') ui.openComposer({ applicationId: item.appId, templateId: 'tpl-fu-application' });
  };

  const done = async () => {
    switch (item.kind) {
      case 'sequence':
        await completeEnrollmentStep(item.enrollmentId!);
        toast.success('Step done — next one scheduled');
        break;
      case 'contact':
        await completeContactFollowUp(item.contactId!);
        toast.success('Done');
        break;
      case 'app':
        await completeAppAction(item.appId!);
        toast.success('Done');
        break;
      case 'task':
        await toggleTask(item.taskId!);
        toast.success('Task complete ✓');
        break;
      case 'thankyou':
        await saveInterview({ applicationId: item.appId!, thankYouSent: true }, item.interviewId);
        toast.success('Marked as sent');
        break;
      default:
        open();
    }
  };

  const snooze = async (days: number) => {
    const kind = item.kind === 'sequence' ? 'enrollment' : item.kind === 'contact' ? 'contact' : item.kind === 'task' ? 'task' : 'app';
    const id = item.enrollmentId ?? (item.kind === 'contact' ? item.contactId : item.kind === 'task' ? item.taskId : item.appId);
    if (!id) return;
    await snoozeItem(kind, id, days);
    toast.success(`Snoozed until ${days === 1 ? 'tomorrow' : `${days} days from now`}`);
  };

  // Manual sequence steps (e.g. "react to a recent post") have no template — link to the profile instead.
  const manualStep = item.kind === 'sequence' && !item.templateId;
  const contact = item.contactId ? contacts.find((c) => c.id === item.contactId) : undefined;
  const canWrite = item.kind === 'sequence' ? !manualStep : ['contact', 'thankyou', 'app'].includes(item.kind);
  const canSnooze = ['sequence', 'contact', 'task', 'app'].includes(item.kind);
  const iv = item.interviewId ? interviews.find((i) => i.id === item.interviewId) : undefined;
  const joinLink = iv?.location && /^https?:/.test(iv.location) ? iv.location : undefined;
  const overdue = item.bucket === 'overdue';

  return (
    <div className={cn('group flex items-center gap-3 rounded-xl px-2.5 transition-colors hover:bg-accent/60', dense ? 'py-1.5' : 'py-2')}>
      {item.kind === 'task' ? (
        <button
          onClick={done}
          aria-label="Complete task"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 border-dashed border-emerald-500/40 text-emerald-600 transition-colors hover:border-solid hover:bg-emerald-500/10"
        >
          <Check className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      ) : (
        <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', st.cls)}>{st.icon}</div>
      )}
      <button onClick={open} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13.5px] font-medium">{item.title}</span>
          {item.channel && <ChannelIcon channel={item.channel} className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </div>
        <div className="truncate text-[12px] text-muted-foreground">
          {item.subtitle}
          {item.meta ? <span className="opacity-80"> · {item.meta}</span> : null}
        </div>
      </button>
      <span className={cn('hidden shrink-0 text-[11.5px] tabular-nums sm:block', overdue ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
        {item.kind === 'interview' ? `${relDay(item.due)} ${fmtTime(item.due)}` : item.due ? relDay(item.due) : ''}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        {item.kind === 'interview' && joinLink && item.bucket === 'today' && (
          <Button size="xs" variant="primary" onClick={() => window.open(joinLink, '_blank', 'noopener')}>
            Join
          </Button>
        )}
        {item.kind === 'interview' && (
          <Button size="xs" variant="secondary" onClick={open}>
            Prep
          </Button>
        )}
        {item.kind === 'deadline' && (
          <Button size="xs" variant="secondary" onClick={open}>
            Apply
          </Button>
        )}
        {manualStep && contact?.linkedin && (
          <Button size="xs" variant="secondary" onClick={() => window.open(/^https?:/.test(contact.linkedin!) ? contact.linkedin : `https://${contact.linkedin}`, '_blank', 'noopener')}>
            Open profile
          </Button>
        )}
        {canWrite && (
          <Button size="xs" variant={overdue || item.bucket === 'today' ? 'primary' : 'secondary'} onClick={write}>
            <Send className="h-3 w-3" /> Write
          </Button>
        )}
        {item.kind !== 'task' && item.kind !== 'interview' && item.kind !== 'deadline' && (
          <Tip content="Mark done">
            <Button size="icon-xs" variant="ghost" onClick={done} aria-label="Mark done">
              <Check className="h-3.5 w-3.5" />
            </Button>
          </Tip>
        )}
        {(canSnooze || item.contactId) && (
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon-xs" variant="ghost" aria-label="More actions" className="opacity-60 group-hover:opacity-100">
                <Ellipsis className="h-3.5 w-3.5" />
              </Button>
            </MenuTrigger>
            <MenuContent>
              {canSnooze && (
                <>
                  <MenuItem icon={<Clock />} onSelect={() => snooze(1)}>
                    Snooze to tomorrow
                  </MenuItem>
                  <MenuItem icon={<Clock />} onSelect={() => snooze(3)}>
                    Snooze 3 days
                  </MenuItem>
                  <MenuItem icon={<Clock />} onSelect={() => snooze(7)}>
                    Snooze 1 week
                  </MenuItem>
                </>
              )}
              {item.kind === 'sequence' && (
                <MenuItem icon={<SkipForward />} onSelect={() => skipEnrollmentStep(item.enrollmentId!).then(() => toast.success('Step skipped'))}>
                  Skip this step
                </MenuItem>
              )}
              {item.contactId && (item.kind === 'sequence' || item.kind === 'contact') && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<MessageSquareReply />} onSelect={() => markReplied(item.contactId!, 'neutral').then(() => toast.success('Reply logged — follow-ups stopped'))}>
                    They replied
                  </MenuItem>
                </>
              )}
              {item.kind === 'task' && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<Pencil />} onSelect={() => ui.openTaskForm(item.taskId)}>
                    Edit task
                  </MenuItem>
                  <MenuItem icon={<Trash2 />} danger onSelect={async () => undoToast('Task deleted', await deleteTask(item.taskId!))}>
                    Delete task
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
        )}
      </div>
    </div>
  );
}

export function AgendaGroups({ items, buckets, dense, emptyFor }: { items: AgendaItem[]; buckets: AgendaBucket[]; dense?: boolean; emptyFor?: React.ReactNode }) {
  const groups = buckets.map((b) => ({ b, list: items.filter((i) => i.bucket === b) })).filter((g) => g.list.length);
  if (!groups.length) return <>{emptyFor ?? null}</>;
  return (
    <div className="space-y-4">
      {groups.map(({ b, list }) => (
        <div key={b}>
          <div className={cn('mb-1 flex items-center gap-2 px-2.5 text-[11.5px] font-semibold uppercase tracking-wide', b === 'overdue' ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
            {BUCKET_LABEL[b]}
            <span className="rounded-full bg-muted px-1.5 text-[10.5px] tabular-nums text-muted-foreground">{list.length}</span>
          </div>
          <div className="space-y-0.5">
            {list.map((it) => (
              <AgendaRow key={it.key} item={it} dense={dense} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
