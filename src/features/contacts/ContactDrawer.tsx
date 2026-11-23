import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Ellipsis,
  Linkedin,
  Mail,
  MessageSquareReply,
  NotebookPen,
  Pause,
  Pencil,
  Phone,
  Play,
  Repeat,
  Send,
  SkipForward,
  Sparkles,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Twitter,
  X,
  MessageCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { confirmDialog, undoToast, useUI } from '@/lib/store';
import {
  completeContactFollowUp,
  deleteContacts,
  deleteInteraction,
  markReplied,
  setEnrollmentStatus,
  skipEnrollmentStep,
  snoozeItem,
  updateContact,
  updateInteraction,
} from '@/lib/actions';
import { CONTACT_STAGES, KIND_LABEL, WARMTH } from '@/lib/constants';
import type { Contact, Interaction, InteractionOutcome } from '@/lib/types';
import { cn, fmtDateTime, relDay } from '@/lib/utils';
import { Sheet, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Tip, SubMenu } from '@/components/overlay';
import { Badge, Button, EmptyState, Select, Textarea } from '@/components/ui';
import { Avatar, ChannelIcon, CompanyLogo, ContactStageBadge, DueBadge, InfoRow, RelationshipBadge, StageBadge, WarmthBadge } from '@/components/common';
import { TagInput } from '@/components/fields';

export function ContactDrawerHost() {
  const drawer = useUI((s) => s.drawer);
  const close = useUI((s) => s.closeDrawer);
  const { contacts } = useData();
  const open = drawer.type === 'contact';
  const c = open ? contacts.find((x) => x.id === drawer.id) : undefined;
  return (
    <Sheet open={open && !!c} onOpenChange={(v) => !v && close()} title={c?.name ?? 'Contact'}>
      {c && <ContactDetail key={c.id} c={c} />}
    </Sheet>
  );
}

const OUTCOMES: { id: InteractionOutcome; label: string; tone: 'gray' | 'blue' | 'green' | 'red' | 'amber' | 'violet' }[] = [
  { id: 'awaiting', label: 'Awaiting', tone: 'amber' },
  { id: 'accepted', label: 'Accepted', tone: 'blue' },
  { id: 'replied', label: 'Replied', tone: 'violet' },
  { id: 'positive', label: 'Positive', tone: 'green' },
  { id: 'negative', label: 'Negative', tone: 'red' },
  { id: 'no_reply', label: 'No reply', tone: 'gray' },
];

function ContactDetail({ c }: { c: Contact }) {
  const ui = useUI();
  const { interactions, enrollments, sequences, apps, templates } = useData();
  const touches = useMemo(() => interactions.filter((i) => i.contactId === c.id).sort((a, b) => b.date.localeCompare(a.date)), [interactions, c.id]);
  const active = enrollments.find((e) => e.contactId === c.id && (e.status === 'active' || e.status === 'paused'));
  const pastSeqs = enrollments.filter((e) => e.contactId === c.id && e !== active);
  const seq = active ? sequences.find((s) => s.id === active.sequenceId) : undefined;
  const linkedApps = apps.filter((a) => c.applicationIds.includes(a.id) || a.contactIds.includes(c.id));
  const tMap = new Map(templates.map((t) => [t.id, t]));
  const [notes, setNotes] = useState(c.notes ?? '');
  useEffect(() => {
    if (notes === (c.notes ?? '')) return;
    const t = setTimeout(() => updateContact(c.id, { notes }), 600);
    return () => clearTimeout(t);
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  const sent = touches.filter((t) => t.direction === 'out' && t.kind !== 'note' && t.kind !== 'comment').length;
  const replies = touches.filter((t) => t.direction === 'in').length;

  const reply = async (s: 'positive' | 'neutral' | 'negative') => {
    await markReplied(c.id, s);
    toast.success(s === 'positive' ? 'Nice! Marked as a positive reply 🎉' : 'Reply logged', { description: active ? 'Sequence stopped automatically.' : undefined });
  };

  const remove = async () => {
    const ok = await confirmDialog({ title: `Delete ${c.name}?`, description: 'Their touchpoints and sequences are removed too.', confirmLabel: 'Delete', danger: true, undoable: true });
    if (!ok) return;
    ui.closeDrawer();
    const restore = await deleteContacts([c.id]);
    undoToast('Contact deleted', restore);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b bg-card px-5 pb-4 pt-4">
        <div className="flex items-start gap-3">
          <Avatar name={c.name} size={52} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight">{c.name}</h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
              {c.title && <span>{c.title}</span>}
              {c.company && (
                <span className="inline-flex items-center gap-1">
                  @ <CompanyLogo name={c.company} size={16} rounded="rounded" /> <span className="text-foreground/90">{c.company}</span>
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <RelationshipBadge rel={c.relationship} />
              <WarmthBadge warmth={c.warmth} />
              {c.priority === 3 && <Badge tone="red">High priority</Badge>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tip content="Edit">
              <Button size="icon-sm" variant="ghost" onClick={() => ui.openContactForm(c.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </Tip>
            <Menu>
              <MenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label="More">
                  <Ellipsis className="h-4 w-4" />
                </Button>
              </MenuTrigger>
              <MenuContent>
                <SubMenu label="Warmth" icon={<Sparkles />}>
                  {WARMTH.map((w) => (
                    <MenuItem key={w.id} onSelect={() => updateContact(c.id, { warmth: w.id })}>
                      {w.emoji} {w.label}
                    </MenuItem>
                  ))}
                </SubMenu>
                <MenuItem icon={<Check />} onSelect={() => updateContact(c.id, { priority: c.priority === 3 ? 2 : 3 })}>
                  {c.priority === 3 ? 'Remove high priority' : 'Mark high priority'}
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<Trash2 />} danger onSelect={remove}>
                  Delete contact
                </MenuItem>
              </MenuContent>
            </Menu>
            <Button size="icon-sm" variant="ghost" aria-label="Close" onClick={() => ui.closeDrawer()}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={c.stage} onChange={(e) => updateContact(c.id, { stage: e.target.value as Contact['stage'] })} wrapperClassName="w-auto" className="h-8 w-44 text-[13px]" aria-label="Stage">
            {CONTACT_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="primary" onClick={() => ui.openComposer({ contactId: c.id, applicationId: linkedApps[0]?.id })}>
            <Send className="h-3.5 w-3.5" /> Compose
          </Button>
          <Button size="sm" variant="secondary" onClick={() => ui.openLog(c.id, linkedApps[0]?.id)}>
            <NotebookPen className="h-3.5 w-3.5" /> Log touch
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="secondary">
                <MessageSquareReply className="h-3.5 w-3.5" /> They replied
              </Button>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuItem icon={<ThumbsUp />} onSelect={() => reply('positive')}>
                Positive — happy to help
              </MenuItem>
              <MenuItem icon={<MessageSquareReply />} onSelect={() => reply('neutral')}>
                Neutral / informational
              </MenuItem>
              <MenuItem icon={<ThumbsDown />} onSelect={() => reply('negative')}>
                Negative — not now
              </MenuItem>
            </MenuContent>
          </Menu>
          {!active && (
            <Button size="sm" variant="secondary" onClick={() => ui.openEnroll([c.id], undefined, linkedApps[0]?.id)}>
              <Repeat className="h-3.5 w-3.5" /> Sequence
            </Button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.linkedin && <QuickLink href={c.linkedin} icon={<Linkedin />} label="LinkedIn" />}
          {c.email && <QuickLink href={`mailto:${c.email}`} icon={<Mail />} label={c.email} />}
          {c.phone && <QuickLink href={`tel:${c.phone}`} icon={<Phone />} label={c.phone} />}
          {c.phone && <QuickLink href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}`} icon={<MessageCircle />} label="WhatsApp" />}
          {c.twitter && <QuickLink href={`https://x.com/${c.twitter.replace('@', '')}`} icon={<Twitter />} label={c.twitter} />}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {/* Sequence */}
        {active && seq && (
          <div className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/[0.07] to-transparent p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                  <Repeat className="h-4 w-4 text-primary" /> {seq.name}
                  {active.status === 'paused' && <Badge tone="amber">Paused</Badge>}
                </div>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Next: <b className="text-foreground">{seq.steps[active.stepIndex]?.title}</b> {active.nextDueAt && <>· due {relDay(active.nextDueAt)}</>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="sm" variant="primary" onClick={() => ui.openComposer({ contactId: c.id, enrollmentId: active.id, applicationId: active.applicationId, templateId: seq.steps[active.stepIndex]?.templateId })}>
                  Do step
                </Button>
                <Menu>
                  <MenuTrigger asChild>
                    <Button size="icon-sm" variant="secondary" aria-label="Sequence options">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem icon={<SkipForward />} onSelect={() => skipEnrollmentStep(active.id).then(() => toast.success('Step skipped'))}>
                      Skip this step
                    </MenuItem>
                    {active.status === 'active' ? (
                      <MenuItem icon={<Pause />} onSelect={() => setEnrollmentStatus(active.id, 'paused')}>
                        Pause sequence
                      </MenuItem>
                    ) : (
                      <MenuItem icon={<Play />} onSelect={() => setEnrollmentStatus(active.id, 'active')}>
                        Resume sequence
                      </MenuItem>
                    )}
                    <MenuItem icon={<Clock />} onSelect={() => snoozeItem('enrollment', active.id, 2)}>
                      Snooze 2 days
                    </MenuItem>
                    <MenuItem icon={<Square />} danger onSelect={() => setEnrollmentStatus(active.id, 'stopped').then(() => toast('Sequence stopped'))}>
                      Stop sequence
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              {seq.steps.map((s, i) => (
                <Tip key={s.id} content={`Day ${s.day}: ${s.title}`}>
                  <div className={cn('h-1.5 flex-1 rounded-full', i < active.stepIndex ? 'bg-primary' : i === active.stepIndex ? 'bg-primary/40' : 'bg-muted')} />
                </Tip>
              ))}
            </div>
          </div>
        )}

        {c.nextFollowUpAt && !active && (
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3.5">
            <div className="flex items-center gap-2 text-[13.5px]">
              <Clock className="h-4 w-4 text-muted-foreground" /> Follow up <DueBadge due={c.nextFollowUpAt} />
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" onClick={() => ui.openComposer({ contactId: c.id, templateId: 'tpl-fu-bump', applicationId: linkedApps[0]?.id })}>
                Write follow-up
              </Button>
              <Tip content="Mark done">
                <Button size="icon-sm" variant="ghost" onClick={() => completeContactFollowUp(c.id)}>
                  <Check className="h-4 w-4" />
                </Button>
              </Tip>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['Messages sent', sent],
            ['Replies', replies],
            ['Last touch', c.lastContactedAt ? relDay(c.lastContactedAt) : '—'],
          ].map(([k, v]) => (
            <div key={k as string} className="rounded-xl border bg-card px-2 py-2.5">
              <div className="text-[17px] font-semibold">{v}</div>
              <div className="text-[11.5px] text-muted-foreground">{k}</div>
            </div>
          ))}
        </div>

        {(c.commonGround || c.mutualConnection || c.source) && (
          <div className="rounded-xl border bg-card p-3.5">
            <div className="label-caps mb-1 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Personalization hooks
            </div>
            <InfoRow label="Common ground">{c.commonGround}</InfoRow>
            <InfoRow label="Mutual">{c.mutualConnection}</InfoRow>
            <InfoRow label="Found via">{c.source}</InfoRow>
          </div>
        )}

        {linkedApps.length > 0 && (
          <div>
            <div className="label-caps mb-2">Applications</div>
            <div className="divide-y rounded-xl border bg-card">
              {linkedApps.map((a) => (
                <button key={a.id} onClick={() => ui.openDrawer('application', a.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50">
                  <CompanyLogo name={a.company} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-medium">{a.role}</div>
                    <div className="truncate text-[12px] text-muted-foreground">{a.company}</div>
                  </div>
                  {a.referrerId === c.id && <Badge tone="green">Referred</Badge>}
                  <StageBadge stage={a.status} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="label-caps">Timeline</span>
            <span className="text-[12px] text-muted-foreground">Set outcomes so reply-rate stats stay honest</span>
          </div>
          {touches.length ? (
            <ol className="relative space-y-3 border-l pl-5">
              {touches.map((t) => (
                <TouchRow key={t.id} t={t} templateName={t.templateId ? tMap.get(t.templateId)?.name : undefined} />
              ))}
            </ol>
          ) : (
            <EmptyState compact icon={<Send className="h-5 w-5" />} title="No touchpoints yet" description="Compose a message — Pursuit logs it here and schedules the follow-up." />
          )}
          {pastSeqs.length > 0 && (
            <p className="mt-3 text-[12px] text-muted-foreground">
              Past sequences: {pastSeqs.map((e) => `${sequences.find((s) => s.id === e.sequenceId)?.name ?? 'Sequence'} (${e.status})`).join(', ')}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <div className="label-caps mb-1.5">Notes</div>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What they care about, what you discussed, how they can help…" />
          </div>
          <div>
            <div className="label-caps mb-1.5">Tags</div>
            <TagInput value={c.tags} onChange={(tags) => updateContact(c.id, { tags })} suggestions={['referrer', 'alumni', 'warm-intro', 'decision-maker', 'mentor']} />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  const url = /^(https?:|mailto:|tel:)/i.test(href) ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-md border bg-card px-2 text-xs font-medium text-foreground/80 shadow-soft hover:bg-accent [&>svg]:h-3.5 [&>svg]:w-3.5"
    >
      {icon}
      <span className="truncate">{label}</span>
    </a>
  );
}

function TouchRow({ t, templateName }: { t: Interaction; templateName?: string }) {
  const outcome = OUTCOMES.find((o) => o.id === t.outcome);
  const isOut = t.direction === 'out' && t.kind !== 'note';
  return (
    <li className="group relative">
      <span className={cn('absolute -left-[29px] top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full border bg-card', t.direction === 'in' ? 'border-emerald-500/40 text-emerald-600' : 'text-muted-foreground')}>
        {t.kind === 'note' ? <NotebookPen className="h-3 w-3" /> : <ChannelIcon channel={t.channel} className="h-3 w-3" />}
      </span>
      <div className="flex flex-wrap items-center gap-1.5 text-[13.5px]">
        <span className={cn('font-medium', t.direction === 'in' && 'text-emerald-700 dark:text-emerald-400')}>{t.direction === 'in' ? 'They replied' : KIND_LABEL[t.kind]}</span>
        {templateName && <span className="text-[12px] text-muted-foreground">· {templateName}</span>}
        {isOut && outcome && (
          <Menu>
            <MenuTrigger asChild>
              <button className="outline-none">
                <Badge tone={outcome.tone}>{outcome.label}</Badge>
              </button>
            </MenuTrigger>
            <MenuContent align="start">
              {OUTCOMES.map((o) => (
                <MenuItem key={o.id} onSelect={() => updateInteraction(t.id, { outcome: o.id, repliedAt: ['replied', 'positive', 'negative'].includes(o.id) ? new Date().toISOString() : undefined })}>
                  {o.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        )}
        <button
          aria-label="Delete touchpoint"
          className="ml-auto opacity-0 transition-opacity group-hover:opacity-100"
          onClick={async () => {
            const restore = await deleteInteraction(t.id);
            undoToast('Touchpoint deleted', restore);
          }}
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-rose-600" />
        </button>
      </div>
      {t.subject && <p className="mt-0.5 text-[12.5px] font-medium text-foreground/80">{t.subject}</p>}
      {t.content && <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap text-[13px] text-muted-foreground">{t.content}</p>}
      <div className="mt-0.5 text-[11.5px] text-muted-foreground/80">{fmtDateTime(t.date)}</div>
    </li>
  );
}

