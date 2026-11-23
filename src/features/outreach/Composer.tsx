import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CircleCheck,
  CircleX,
  Copy,
  ExternalLink,
  Linkedin,
  Mail,
  MessageCircle,
  PenLine,
  Repeat,
  Send,
  Sparkles,
  Twitter,
  TriangleAlert,
  WandSparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useUI } from '@/lib/store';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/hooks';
import { completeEnrollmentStep, logInteraction, saveInterview } from '@/lib/actions';
import { TEMPLATE_CATEGORIES, channelLimit } from '@/lib/constants';
import { analyzeMessage, buildContext, renderTemplate, varLabel } from '@/lib/outreach';
import { templateStats } from '@/lib/stats';
import type { Channel, InteractionKind, Template } from '@/lib/types';
import { cn, copyText, firstName, fmtPct } from '@/lib/utils';
import { Modal } from '@/components/overlay';
import { Badge, Button, Field, Input, ProgressRing, Segmented, Select, Textarea } from '@/components/ui';
import { SearchSelect } from '@/components/fields';
import { Avatar, CompanyLogo } from '@/components/common';

export function ComposerHost() {
  const st = useUI((s) => s.composer);
  const close = useUI((s) => s.closeComposer);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (st.open) setNonce((n) => n + 1);
  }, [st.open]);
  if (!st.open && nonce === 0) return null;
  const { open, ...opts } = st;
  return <Composer key={nonce} open={open} onClose={close} {...opts} />;
}

const CHANNEL_OPTS: { id: Channel; label: string; icon: React.ReactNode }[] = [
  { id: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="h-3.5 w-3.5" /> },
  { id: 'email', label: 'Email', icon: <Mail className="h-3.5 w-3.5" /> },
  { id: 'twitter', label: 'X', icon: <Twitter className="h-3.5 w-3.5" /> },
  { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle className="h-3.5 w-3.5" /> },
];

function kindFor(t: Template | undefined, channel: Channel): InteractionKind {
  if (!t) return channel === 'email' ? 'email' : 'message';
  switch (t.category) {
    case 'connection_note':
      return 'connection_request';
    case 'referral':
      return 'referral_request';
    case 'follow_up':
      return 'follow_up';
    case 'thank_you':
      return 'thank_you';
    default:
      return channel === 'email' ? 'email' : 'message';
  }
}

function Composer({
  open,
  onClose,
  contactId: initContact,
  applicationId: initApp,
  templateId: initTemplate,
  enrollmentId,
  interviewId,
}: {
  open: boolean;
  onClose: () => void;
  contactId?: string;
  applicationId?: string;
  templateId?: string;
  enrollmentId?: string;
  interviewId?: string;
}) {
  const settings = useSettings();
  const { contacts, apps, templates, interactions, enrollments, sequences } = useData();
  const enrollment = enrollmentId ? enrollments.find((e) => e.id === enrollmentId) : undefined;
  const seq = enrollment ? sequences.find((s) => s.id === enrollment.sequenceId) : undefined;
  const step = seq && enrollment ? seq.steps[enrollment.stepIndex] : undefined;

  const [contactId, setContactId] = useState<string | undefined>(initContact ?? enrollment?.contactId);
  const contact = contacts.find((c) => c.id === contactId);
  const [applicationId, setApplicationId] = useState<string | undefined>(initApp ?? enrollment?.applicationId ?? contact?.applicationIds[0]);
  const app = apps.find((a) => a.id === applicationId);
  const [templateId, setTemplateId] = useState<string | undefined>(initTemplate ?? step?.templateId);
  const template = templates.find((t) => t.id === templateId);
  const [channel, setChannel] = useState<Channel>(step?.channel ?? template?.channel ?? 'linkedin');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const stats = useMemo(() => templateStats(interactions), [interactions]);
  const ctx = useMemo(() => buildContext({ profile: settings.profile, contact, application: app }), [settings.profile, contact, app]);

  // (Re)render the template whenever inputs change — unless the user has edited the text.
  useEffect(() => {
    if (dirty) return;
    if (!template) {
      if (!body) setBody(contact ? `Hi ${firstName(contact.name)},\n\n` : '');
      return;
    }
    setBody(renderTemplate(template.body, ctx).text);
    setSubject(renderTemplate(template.subject ?? '', ctx).text);
  }, [template, ctx]); // eslint-disable-line react-hooks/exhaustive-deps

  const missing = useMemo(() => {
    const m = new Set<string>();
    if (template) {
      renderTemplate(template.body, ctx).missing.forEach((x) => m.add(x));
      renderTemplate(template.subject ?? '', ctx).missing.forEach((x) => m.add(x));
    }
    return [...m].filter((k) => body.includes(`[${k}]`) || subject.includes(`[${k}]`));
  }, [template, ctx, body, subject]);

  const analysis = useMemo(
    () => analyzeMessage(body, { channel, category: template?.category, subject, recipientFirstName: contact ? firstName(contact.name) : undefined, company: app?.company || contact?.company }),
    [body, channel, template, subject, contact, app],
  );
  const limit = channelLimit(template?.category, channel);

  const pickTemplate = (id: string | undefined) => {
    setTemplateId(id);
    setDirty(false);
    const t = templates.find((x) => x.id === id);
    if (t) setChannel(t.channel);
  };

  const insertAtCursor = (text: string) => {
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + text);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + text + body.slice(end);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  };

  const fullText = channel === 'email' && subject ? `Subject: ${subject}\n\n${body}` : body;

  const logSent = async () => {
    if (!contact) {
      toast.error('Pick a recipient to log this message');
      return false;
    }
    if (enrollment) {
      await completeEnrollmentStep(enrollment.id, { content: body, subject: subject || undefined, templateId });
    } else {
      await logInteraction({
        contactId: contact.id,
        applicationId,
        channel,
        kind: kindFor(template, channel),
        templateId,
        content: body,
        subject: channel === 'email' ? subject : undefined,
        direction: 'out',
      });
    }
    if (interviewId && app) await saveInterview({ applicationId: app.id, thankYouSent: true }, interviewId);
    return true;
  };

  const copyAndLog = async () => {
    setBusy(true);
    try {
      await copyText(channel === 'email' ? body : fullText);
      const ok = await logSent();
      if (ok) {
        toast.success('Copied & logged', {
          description: enrollment ? 'Next sequence step scheduled.' : `Follow-up reminder set. Paste it into ${channel === 'email' ? 'your email' : channel === 'linkedin' ? 'LinkedIn' : 'the app'}.`,
        });
        onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  const openTarget = () => {
    if (!contact) return;
    if (channel === 'email' && contact.email) {
      const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(contact.email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.open(url, '_blank', 'noopener');
    } else if (channel === 'whatsapp' && contact.phone) {
      window.open(`https://wa.me/${contact.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(body)}`, '_blank', 'noopener');
    } else if (channel === 'twitter' && contact.twitter) {
      window.open(`https://x.com/${contact.twitter.replace('@', '')}`, '_blank', 'noopener');
    } else if (contact.linkedin) {
      copyText(body);
      window.open(/^https?:/.test(contact.linkedin) ? contact.linkedin : `https://${contact.linkedin}`, '_blank', 'noopener');
      toast.success('Message copied — paste it on LinkedIn');
    } else toast.error(`No ${channel === 'email' ? 'email' : channel === 'whatsapp' ? 'phone number' : 'profile link'} saved for ${contact.name}`);
  };
  const targetLabel =
    channel === 'email' ? (contact?.email ? 'Open in Gmail' : null) : channel === 'whatsapp' ? (contact?.phone ? 'Open WhatsApp' : null) : channel === 'twitter' ? (contact?.twitter ? 'Open X profile' : null) : contact?.linkedin ? 'Copy & open LinkedIn' : null;

  const grouped = TEMPLATE_CATEGORIES.map((c) => ({ ...c, items: templates.filter((t) => t.category === c.id).sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || a.name.localeCompare(b.name)) })).filter((g) => g.items.length);
  const ts = templateId ? stats.get(templateId) : undefined;
  const scoreTone = analysis.score >= 80 ? 'stroke-emerald-500' : analysis.score >= 60 ? 'stroke-amber-500' : 'stroke-rose-500';

  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title={enrollment && step ? step.title : 'Compose message'}
      description={enrollment && seq ? `Step ${enrollment.stepIndex + 1} of ${seq.steps.length} · ${seq.name}` : 'Personalized from your templates and profile. Edit freely — then copy, send and log in one click.'}
      icon={enrollment ? <Repeat className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
      size="xl"
      bodyClassName="p-0"
      footer={
        <>
          <span className="mr-auto hidden text-[12px] text-muted-foreground sm:block">{contact ? `Logging updates ${firstName(contact.name)}’s timeline & follow-ups` : 'Pick a recipient to log & track replies'}</span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => copyText(channel === 'email' ? body : fullText).then((ok) => ok && toast.success('Copied to clipboard'))}
          >
            <Copy className="h-4 w-4" /> Copy
          </Button>
          {targetLabel && (
            <Button variant="secondary" onClick={openTarget}>
              <ExternalLink className="h-4 w-4" /> {targetLabel}
            </Button>
          )}
          <Button variant="primary" onClick={copyAndLog} loading={busy} disabled={!body.trim()}>
            <Send className="h-4 w-4" /> {contact ? 'Copy & mark sent' : 'Copy'}
          </Button>
        </>
      }
    >
      <div className="grid min-h-0 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="To">
              <SearchSelect
                value={contactId}
                onChange={(v) => {
                  setContactId(v);
                  const c = contacts.find((x) => x.id === v);
                  if (c?.applicationIds[0] && !initApp) setApplicationId(c.applicationIds[0]);
                }}
                placeholder="Choose a person (optional)"
                options={contacts.map((c) => ({ value: c.id, label: c.name, hint: [c.title, c.company].filter(Boolean).join(' @ '), icon: <Avatar name={c.name} size={18} /> }))}
              />
            </Field>
            <Field label="About (application)">
              <SearchSelect
                value={applicationId}
                onChange={setApplicationId}
                placeholder="None"
                options={apps.map((a) => ({ value: a.id, label: a.role, hint: a.company, icon: <CompanyLogo name={a.company} size={18} rounded="rounded" /> }))}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Template" aside={ts ? <span className="text-[11.5px] text-muted-foreground">Sent {ts.sent} · {fmtPct(ts.rate)} response</span> : undefined}>
              <Select value={templateId ?? ''} onChange={(e) => pickTemplate(e.target.value || undefined)}>
                <option value="">Blank message</option>
                {grouped.map((g) => (
                  <optgroup key={g.id} label={g.label}>
                    {g.items.map((t) => {
                      const s = stats.get(t.id);
                      return (
                        <option key={t.id} value={t.id}>
                          {t.favorite ? '★ ' : ''}
                          {t.name}
                          {s && s.sent >= 3 ? ` — ${fmtPct(s.rate)}` : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                ))}
              </Select>
            </Field>
            <Field label="Channel">
              <Segmented value={channel} onChange={setChannel} options={CHANNEL_OPTS.map((c) => ({ id: c.id, label: c.label, icon: c.icon }))} />
            </Field>
          </div>
          {channel === 'email' && (
            <Field label="Subject">
              <Input
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setDirty(true);
                }}
                placeholder="Short and specific — e.g. “Frontend role — cut load time 40% at Acme”"
              />
            </Field>
          )}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[13px] font-medium">Message</span>
              <span className={cn('text-[12px] tabular-nums', limit.max && analysis.chars > limit.max ? 'font-semibold text-rose-600' : limit.soft && analysis.chars > limit.soft ? 'text-amber-600' : 'text-muted-foreground')}>
                {analysis.chars}
                {limit.max ? ` / ${limit.max}` : ''} chars · {analysis.words} words
              </span>
            </div>
            <Textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setDirty(true);
              }}
              className="min-h-[240px] text-[14px] leading-6"
              maxRows={22}
            />
            {limit.note && <p className="mt-1 text-[11.5px] text-muted-foreground">{limit.note}</p>}
          </div>
          {missing.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[12.5px]">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                Fill in the highlighted placeholders: {missing.map((k) => <code key={k} className="mx-0.5 rounded bg-amber-500/15 px-1">[{k}]</code>)}. Your details live in{' '}
                <Link to="/settings/profile" onClick={onClose} className="font-medium underline">
                  Settings → Profile
                </Link>
                {missing.some((k) => ['firstName', 'fullName', 'contactTitle', 'commonGround', 'mutualConnection'].includes(k)) ? '; the recipient’s on their contact card.' : '.'}
              </div>
            </div>
          )}
          {contact && (contact.commonGround || contact.mutualConnection || contact.notes) && (
            <div>
              <div className="label-caps mb-1.5 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Personal hooks — click to insert
              </div>
              <div className="flex flex-wrap gap-1.5">
                {contact.commonGround && (
                  <button onClick={() => insertAtCursor(contact.commonGround!)} className="max-w-full truncate rounded-full border bg-card px-2.5 py-1 text-[12px] hover:bg-accent">
                    🤝 {contact.commonGround}
                  </button>
                )}
                {contact.mutualConnection && (
                  <button onClick={() => insertAtCursor(`${contact.mutualConnection} suggested I reach out`)} className="rounded-full border bg-card px-2.5 py-1 text-[12px] hover:bg-accent">
                    👥 Mutual: {contact.mutualConnection}
                  </button>
                )}
                {app?.url && (
                  <button onClick={() => insertAtCursor(app.url!)} className="rounded-full border bg-card px-2.5 py-1 text-[12px] hover:bg-accent">
                    🔗 Job link
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Quality panel */}
        <aside className="space-y-4 border-t bg-muted/30 p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-3">
            <ProgressRing value={analysis.score} max={100} size={64} stroke={6} barClass={scoreTone} trackClass="stroke-muted">
              <span className="text-[15px] font-semibold">{analysis.score}</span>
            </ProgressRing>
            <div>
              <div className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                <WandSparkles className="h-4 w-4 text-primary" /> {analysis.grade}
              </div>
              <p className="text-[12px] text-muted-foreground">Message quality · ~{analysis.readSecs}s read</p>
            </div>
          </div>
          <ul className="space-y-2">
            {analysis.checks.map((c) => (
              <li key={c.id} className="flex gap-2 text-[12.5px]">
                {c.pass ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}
                <div className="min-w-0">
                  <div className={cn('font-medium', !c.pass && 'text-foreground')}>{c.label}</div>
                  {!c.pass && <div className="text-muted-foreground">{c.tip}</div>}
                </div>
              </li>
            ))}
          </ul>
          {template && (
            <div className="rounded-lg border bg-card p-2.5 text-[12px]">
              <div className="flex items-center justify-between">
                <span className="font-medium">{template.name}</span>
                <Badge tone="outline">{TEMPLATE_CATEGORIES.find((c) => c.id === template.category)?.label}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{ts ? `Used ${ts.sent}× · ${ts.replied} responses (${fmtPct(ts.rate)})` : 'Not used yet — Pursuit will track its reply rate.'}</p>
            </div>
          )}
          <div className="rounded-lg bg-primary/5 p-2.5 text-[12px] leading-relaxed text-muted-foreground">
            <b className="text-foreground">Pro tip:</b> one specific detail about them beats three paragraphs about you. End with a single, easy ask.
          </div>
          {missing.length > 0 && (
            <div className="text-[11.5px] text-muted-foreground">Missing: {missing.map(varLabel).join(', ')}</div>
          )}
        </aside>
      </div>
    </Modal>
  );
}
