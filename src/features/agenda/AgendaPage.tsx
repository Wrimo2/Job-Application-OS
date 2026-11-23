import * as React from 'react';
import { useMemo, useState } from 'react';
import { CalendarCheck, Check, PartyPopper, Plus, RotateCcw } from 'lucide-react';
import { useData } from '@/lib/data';
import { useUI } from '@/lib/store';
import { toggleTask } from '@/lib/actions';
import type { AgendaItem } from '@/lib/stats';
import { cn, relDay } from '@/lib/utils';
import { Button, Card, EmptyState } from '@/components/ui';
import { PageHeader } from '@/components/common';
import { AgendaGroups } from './AgendaList';

type Filter = 'all' | 'outreach' | 'apps' | 'interviews' | 'tasks';

const FILTERS: { id: Filter; label: string; match: (i: AgendaItem) => boolean }[] = [
  { id: 'all', label: 'Everything', match: () => true },
  { id: 'outreach', label: 'Outreach', match: (i) => i.kind === 'sequence' || i.kind === 'contact' },
  { id: 'apps', label: 'Applications', match: (i) => i.kind === 'app' || i.kind === 'deadline' },
  { id: 'interviews', label: 'Interviews', match: (i) => i.kind === 'interview' || i.kind === 'thankyou' },
  { id: 'tasks', label: 'Tasks', match: (i) => i.kind === 'task' },
];

export default function AgendaPage() {
  const ui = useUI();
  const { agenda, tasks } = useData();
  const [filter, setFilter] = useState<Filter>('all');
  const [showDone, setShowDone] = useState(false);
  const items = useMemo(() => agenda.filter(FILTERS.find((f) => f.id === filter)!.match), [agenda, filter]);
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? '')).slice(0, 15);
  const overdue = agenda.filter((a) => a.bucket === 'overdue').length;
  const today = agenda.filter((a) => a.bucket === 'today').length;

  return (
    <div className="page">
      <PageHeader
        icon={<CalendarCheck className="h-5 w-5" />}
        title="Agenda"
        subtitle={overdue || today ? `${today} due today${overdue ? ` · ${overdue} overdue` : ''} — work top to bottom.` : 'Everything that needs you, across applications, people and interviews.'}
        actions={
          <Button variant="primary" size="sm" onClick={() => ui.openTaskForm()}>
            <Plus className="h-4 w-4" /> Task
          </Button>
        }
      />
      <div className="no-scrollbar -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1">
        {FILTERS.map((f) => {
          const n = agenda.filter(f.match).length;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium',
                filter === f.id ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
              <span className="tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>
      <Card className="p-2 sm:p-3">
        <AgendaGroups
          items={items}
          buckets={['overdue', 'today', 'tomorrow', 'week', 'later', 'someday']}
          emptyFor={
            <EmptyState
              icon={<PartyPopper className="h-6 w-6" />}
              title="Inbox zero for your job search"
              description="Nothing is due. Add a task, start a sequence, or log an application to keep momentum."
              action={
                <Button variant="primary" onClick={() => ui.openTaskForm()}>
                  <Plus className="h-4 w-4" /> Add a task
                </Button>
              }
            />
          }
        />
      </Card>
      {done.length > 0 && (
        <div className="mt-6">
          <button onClick={() => setShowDone(!showDone)} className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
            {showDone ? 'Hide' : 'Show'} recently completed tasks ({done.length})
          </button>
          {showDone && (
            <Card className="mt-2 divide-y">
              {done.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Check className="h-4 w-4 text-emerald-500" />
                  <span className="flex-1 text-[13.5px] text-muted-foreground line-through">{t.title}</span>
                  <span className="text-[12px] text-muted-foreground">{relDay(t.doneAt)}</span>
                  <Button size="xs" variant="ghost" onClick={() => toggleTask(t.id)}>
                    <RotateCcw className="h-3 w-3" /> Undo
                  </Button>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
