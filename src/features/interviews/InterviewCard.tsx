import * as React from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import {
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Download,
  Ellipsis,
  MapPin,
  Pencil,
  Phone,
  Send,
  Trash2,
  Users,
  Video,
  CircleCheck,
  CircleX,
  Hourglass,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/db';
import { deleteInterview, saveInterview } from '@/lib/actions';
import { INTERVIEW_TYPE_LABEL } from '@/lib/constants';
import { downloadICS, googleCalendarUrl } from '@/lib/io';
import { undoToast, useUI } from '@/lib/store';
import type { Application, Interview, InterviewOutcome } from '@/lib/types';
import { cn, fmtTime, relDay, toDate } from '@/lib/utils';
import { Badge, Button, Progress, StarRating } from '@/components/ui';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@/components/overlay';
import { CompanyLogo } from '@/components/common';

const OUTCOME: Record<InterviewOutcome, { label: string; tone: 'blue' | 'green' | 'red' | 'amber' | 'gray'; icon: React.ReactNode }> = {
  scheduled: { label: 'Scheduled', tone: 'blue', icon: <Clock className="h-3 w-3" /> },
  awaiting: { label: 'Awaiting result', tone: 'amber', icon: <Hourglass className="h-3 w-3" /> },
  passed: { label: 'Passed', tone: 'green', icon: <CircleCheck className="h-3 w-3" /> },
  failed: { label: 'Not selected', tone: 'red', icon: <CircleX className="h-3 w-3" /> },
  cancelled: { label: 'Cancelled', tone: 'gray', icon: <Ban className="h-3 w-3" /> },
};

export function OutcomeBadge({ outcome }: { outcome: InterviewOutcome }) {
  const o = OUTCOME[outcome];
  return (
    <Badge tone={o.tone}>
      <span className="inline-flex items-center gap-1">
        {o.icon}
        {o.label}
      </span>
    </Badge>
  );
}

export function InterviewCard({ iv, app, showCompany, defaultOpen }: { iv: Interview; app?: Application; showCompany?: boolean; defaultOpen?: boolean }) {
  const ui = useUI();
  const [open, setOpen] = useState(!!defaultOpen);
  const when = toDate(iv.scheduledAt);
  const upcoming = !!when && when > new Date() && iv.outcome === 'scheduled';
  const done = iv.checklist.filter((c) => c.done).length;
  const ModeIcon = iv.mode === 'phone' ? Phone : iv.mode === 'onsite' ? MapPin : Video;
  const link = iv.location && /^https?:/i.test(iv.location) ? iv.location : undefined;

  const setOutcome = async (outcome: InterviewOutcome) => {
    await saveInterview({ applicationId: iv.applicationId, outcome }, iv.id);
    toast.success(`Marked as ${OUTCOME[outcome].label.toLowerCase()}`);
  };
  const toggleItem = async (id: string) => {
    await db.interviews.update(iv.id, { checklist: iv.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) });
  };

  return (
    <div className={cn('rounded-xl border bg-card shadow-soft transition-shadow hover:shadow-lift', upcoming && 'ring-1 ring-primary/20')}>
      <div className="flex items-start gap-3 p-3.5">
        <div className={cn('flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5', upcoming ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
          <span className="text-[10px] font-semibold uppercase">{when ? format(when, 'MMM') : '—'}</span>
          <span className="text-lg font-semibold leading-none">{when ? format(when, 'd') : ''}</span>
          <span className="mt-0.5 text-[10px]">{when ? format(when, 'EEE') : ''}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showCompany && app && (
              <button className="flex items-center gap-1.5 text-[13px] font-semibold hover:underline" onClick={() => ui.openDrawer('application', app.id, 'interviews')}>
                <CompanyLogo name={app.company} size={18} rounded="rounded" />
                {app.company}
              </button>
            )}
            <span className="text-[14px] font-semibold">{iv.round}</span>
            <OutcomeBadge outcome={iv.outcome} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
            <span>{INTERVIEW_TYPE_LABEL[iv.type]}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {fmtTime(iv.scheduledAt)} · {iv.durationMins}m · {relDay(iv.scheduledAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <ModeIcon className="h-3.5 w-3.5" />
              {iv.mode}
            </span>
            {iv.interviewers && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {iv.interviewers}
              </span>
            )}
            {showCompany && app && <span className="truncate">{app.role}</span>}
          </div>
          {iv.checklist.length > 0 && (
            <button onClick={() => setOpen(!open)} className="mt-2.5 flex w-full items-center gap-2 text-left">
              <Progress value={done} max={iv.checklist.length} className="h-1 flex-1" barClassName={done === iv.checklist.length ? 'bg-emerald-500' : undefined} />
              <span className="text-[11.5px] tabular-nums text-muted-foreground">
                Prep {done}/{iv.checklist.length}
              </span>
              <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {link && upcoming && (
            <Button size="sm" variant="primary" onClick={() => window.open(link, '_blank', 'noopener')}>
              <Video className="h-3.5 w-3.5" /> Join
            </Button>
          )}
          {!upcoming && !iv.thankYouSent && iv.outcome !== 'cancelled' && iv.type !== 'take_home' && (
            <Button size="sm" variant="secondary" onClick={() => ui.openComposer({ applicationId: iv.applicationId, templateId: 'tpl-ty-interview', interviewId: iv.id })}>
              <Send className="h-3.5 w-3.5" /> Thank-you
            </Button>
          )}
          <Menu>
            <MenuTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label="Interview actions">
                <Ellipsis className="h-4 w-4" />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<Pencil />} onSelect={() => ui.openInterviewForm(iv.applicationId, iv.id)}>
                Edit / add notes
              </MenuItem>
              <MenuItem icon={<CalendarPlus />} onSelect={() => window.open(googleCalendarUrl(iv, app), '_blank', 'noopener')}>
                Add to Google Calendar
              </MenuItem>
              <MenuItem icon={<Download />} onSelect={() => downloadICS([{ iv, app }], `interview-${app?.company ?? 'event'}`.toLowerCase().replace(/\s+/g, '-'))}>
                Download .ics (Outlook / Apple)
              </MenuItem>
              <MenuSeparator />
              {(['passed', 'awaiting', 'failed', 'cancelled', 'scheduled'] as InterviewOutcome[]).map((o) => (
                <MenuItem key={o} icon={OUTCOME[o].icon} onSelect={() => setOutcome(o)}>
                  Mark {OUTCOME[o].label.toLowerCase()}
                </MenuItem>
              ))}
              <MenuItem icon={<Check />} onSelect={() => saveInterview({ applicationId: iv.applicationId, thankYouSent: !iv.thankYouSent }, iv.id)}>
                {iv.thankYouSent ? 'Unmark thank-you sent' : 'Mark thank-you sent'}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                danger
                icon={<Trash2 />}
                onSelect={async () => {
                  const restore = await deleteInterview(iv.id);
                  undoToast('Interview deleted', restore);
                }}
              >
                Delete
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </div>
      {open && (
        <div className="space-y-3 border-t px-3.5 py-3">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {iv.checklist.map((c) => (
              <li key={c.id}>
                <button onClick={() => toggleItem(c.id)} className="flex w-full items-start gap-2 rounded-md px-1 py-0.5 text-left text-[13px] hover:bg-accent">
                  <span className={cn('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border', c.done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-input')}>
                    {c.done && <Check className="h-3 w-3" />}
                  </span>
                  <span className={cn(c.done && 'text-muted-foreground line-through')}>{c.text}</span>
                </button>
              </li>
            ))}
          </ul>
          {iv.prepNotes && (
            <div className="rounded-lg bg-muted/50 p-2.5 text-[13px]">
              <div className="label-caps mb-1">Prep notes</div>
              <p className="whitespace-pre-wrap">{iv.prepNotes}</p>
            </div>
          )}
          {(iv.reflection || iv.questionsAsked || iv.selfRating) && (
            <div className="rounded-lg bg-muted/50 p-2.5 text-[13px]">
              <div className="mb-1 flex items-center justify-between">
                <span className="label-caps">Reflection</span>
                {!!iv.selfRating && <StarRating value={iv.selfRating} readOnly size={13} />}
              </div>
              {iv.questionsAsked && <p className="whitespace-pre-wrap text-muted-foreground">Asked: {iv.questionsAsked}</p>}
              {iv.reflection && <p className="mt-1 whitespace-pre-wrap">{iv.reflection}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
