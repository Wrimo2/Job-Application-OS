import * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { Copy, Ellipsis, LayoutTemplate, Pencil, Plus, RotateCcw, Search, Send, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/hooks';
import { confirmDialog, undoToast, useUI } from '@/lib/store';
import { deleteTemplate, restoreDefaultTemplates, saveTemplate } from '@/lib/actions';
import { CHANNELS, TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABEL, channelLimit } from '@/lib/constants';
import { analyzeMessage, buildContext, renderTemplate, TEMPLATE_VARS } from '@/lib/outreach';
import { templateStats } from '@/lib/stats';
import type { Channel, Template, TemplateCategory } from '@/lib/types';
import { cn, firstName, fmtPct } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, Field, Input, ProgressRing, Select, Textarea } from '@/components/ui';
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, Modal } from '@/components/overlay';
import { Avatar, ChannelIcon } from '@/components/common';
import { SearchSelect } from '@/components/fields';

function Highlighted({ text }: { text: string }) {
  const parts = text.split(/(\{\{\s*\w+\s*\}\}|\[[^\]\n]{1,60}\])/g);
  return (
    <>
      {parts.map((p, i) =>
        /^\{\{/.test(p) ? (
          <span key={i} className="rounded bg-primary/10 px-0.5 font-medium text-primary">
            {p.replace(/[{}\s]/g, '')}
          </span>
        ) : /^\[/.test(p) ? (
          <span key={i} className="rounded bg-amber-500/15 px-0.5 text-amber-700 dark:text-amber-300">
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

export default function TemplatesTab() {
  const ui = useUI();
  const { templates, interactions } = useData();
  const [cat, setCat] = useState<TemplateCategory | 'all' | 'fav'>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Template | 'new' | null>(null);
  const stats = useMemo(() => templateStats(interactions), [interactions]);

  const list = templates
    .filter((t) => (cat === 'all' ? true : cat === 'fav' ? t.favorite : t.category === cat))
    .filter((t) => !q || `${t.name} ${t.body} ${t.subject ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || (stats.get(b.id)?.sent ?? 0) - (stats.get(a.id)?.sent ?? 0) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…" className="pl-9" />
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" size="sm">
                <Ellipsis className="h-4 w-4" />
              </Button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem
                icon={<RotateCcw />}
                onSelect={async () => {
                  const ok = await confirmDialog({ title: 'Restore built-in templates?', description: 'Re-adds the default templates & sequences (overwrites edits to built-ins). Your own templates are kept.', confirmLabel: 'Restore' });
                  if (ok) {
                    await restoreDefaultTemplates();
                    toast.success('Defaults restored');
                  }
                }}
              >
                Restore built-in templates
              </MenuItem>
            </MenuContent>
          </Menu>
          <Button variant="primary" size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> New template
          </Button>
        </div>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {[{ id: 'all', label: 'All' }, { id: 'fav', label: '★ Favorites' }, ...TEMPLATE_CATEGORIES].map((c) => {
          const n = c.id === 'all' ? templates.length : c.id === 'fav' ? templates.filter((t) => t.favorite).length : templates.filter((t) => t.category === c.id).length;
          if (!n && c.id !== 'all') return null;
          return (
            <button
              key={c.id}
              onClick={() => setCat(c.id as TemplateCategory)}
              className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium', cat === c.id ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              {c.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => {
            const s = stats.get(t.id);
            return (
              <Card key={t.id} className="group flex flex-col p-4 transition-shadow hover:shadow-lift">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold">{t.name}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge tone="outline">{TEMPLATE_CATEGORY_LABEL[t.category]}</Badge>
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground">
                        <ChannelIcon channel={t.channel} className="h-3 w-3" />
                        {CHANNELS.find((c) => c.id === t.channel)?.label}
                      </span>
                    </div>
                  </div>
                  <button aria-label="Favorite" onClick={() => saveTemplate({ favorite: !t.favorite }, t.id)} className="rounded p-1 hover:bg-accent">
                    <Star className={cn('h-4 w-4', t.favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/50')} />
                  </button>
                </div>
                {t.subject && (
                  <p className="mt-3 truncate text-[12.5px] font-medium text-foreground/80">
                    <span className="text-muted-foreground">Subject: </span>
                    <Highlighted text={t.subject} />
                  </p>
                )}
                <p className="mt-2 line-clamp-5 flex-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">
                  <Highlighted text={t.body} />
                </p>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-[12px] text-muted-foreground">
                    {s ? (
                      <>
                        Sent {s.sent} · <b className={cn((s.rate ?? 0) >= 40 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground')}>{fmtPct(s.rate)}</b> response
                      </>
                    ) : (
                      'Not used yet'
                    )}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button size="xs" variant="primary" onClick={() => ui.openComposer({ templateId: t.id })}>
                      <Send className="h-3 w-3" /> Use
                    </Button>
                    <Menu>
                      <MenuTrigger asChild>
                        <Button size="icon-xs" variant="ghost" aria-label="Template actions">
                          <Ellipsis className="h-3.5 w-3.5" />
                        </Button>
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem icon={<Pencil />} onSelect={() => setEditing(t)}>
                          Edit
                        </MenuItem>
                        <MenuItem
                          icon={<Copy />}
                          onSelect={async () => {
                            const { id, createdAt, updatedAt, builtIn, ...rest } = t;
                            await saveTemplate({ ...rest, name: `${t.name} (variant B)`, favorite: false });
                            toast.success('Duplicated — A/B test the two versions and keep the winner');
                          }}
                        >
                          Duplicate (A/B variant)
                        </MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={<Trash2 />} danger onSelect={async () => undoToast('Template deleted', await deleteTemplate(t.id))}>
                          Delete
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<LayoutTemplate className="h-6 w-6" />} title="No templates here" description="Create one, or restore the built-in library from the ⋯ menu." />
        </Card>
      )}

      {editing && <TemplateEditor template={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TemplateEditor({ template, onClose }: { template?: Template; onClose: () => void }) {
  const settings = useSettings();
  const { contacts, apps } = useData();
  const [t, setT] = useState<Partial<Template>>(template ?? { name: '', category: 'linkedin_message', channel: 'linkedin', body: 'Hi {{firstName}},\n\n' });
  const [previewContact, setPreviewContact] = useState<string | undefined>(contacts.find((c) => c.applicationIds.length)?.id ?? contacts[0]?.id);
  const ref = useRef<HTMLTextAreaElement>(null);
  const contact = contacts.find((c) => c.id === previewContact);
  const app = apps.find((a) => a.id === contact?.applicationIds[0]);
  const ctx = useMemo(() => buildContext({ profile: settings.profile, contact, application: app }), [settings.profile, contact, app]);
  const preview = renderTemplate(t.body ?? '', ctx);
  const previewSubject = renderTemplate(t.subject ?? '', ctx);
  const analysis = analyzeMessage(preview.text, { channel: (t.channel ?? 'linkedin') as Channel, category: t.category, subject: previewSubject.text, recipientFirstName: contact ? firstName(contact.name) : undefined, company: app?.company || contact?.company });
  const limit = channelLimit(t.category, (t.channel ?? 'linkedin') as Channel);

  const insertVar = (key: string) => {
    const el = ref.current;
    const token = `{{${key}}}`;
    const body = t.body ?? '';
    if (!el) return setT({ ...t, body: body + token });
    const s = el.selectionStart ?? body.length;
    const e = el.selectionEnd ?? body.length;
    setT({ ...t, body: body.slice(0, s) + token + body.slice(e) });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = s + token.length;
    });
  };

  const save = async () => {
    if (!t.name?.trim() || !t.body?.trim()) {
      toast.error('Name and message are required');
      return;
    }
    await saveTemplate({ ...t, builtIn: template?.builtIn }, template?.id);
    toast.success(template ? 'Template saved' : 'Template created');
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={template ? 'Edit template' : 'New template'}
      description="Use {{variables}} — they’re filled from the recipient, the job and your profile."
      icon={<LayoutTemplate className="h-4 w-4" />}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save template
          </Button>
        </>
      }
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label="Name">
            <Input value={t.name ?? ''} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="e.g. Referral ask — alumni" autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={t.category} onChange={(e) => setT({ ...t, category: e.target.value as TemplateCategory })}>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Channel">
              <Select value={t.channel} onChange={(e) => setT({ ...t, channel: e.target.value as Channel })}>
                {CHANNELS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {t.channel === 'email' && (
            <Field label="Subject">
              <Input value={t.subject ?? ''} onChange={(e) => setT({ ...t, subject: e.target.value })} placeholder="e.g. {{role}} — quick note" />
            </Field>
          )}
          <Field label="Message" aside={<span className={cn('text-[11.5px] tabular-nums', limit.max && preview.text.length > limit.max ? 'text-rose-600' : 'text-muted-foreground')}>{preview.text.length} chars rendered</span>}>
            <Textarea ref={ref} value={t.body ?? ''} onChange={(e) => setT({ ...t, body: e.target.value })} className="min-h-[220px] font-mono text-[13px]" maxRows={20} />
          </Field>
          <div>
            <div className="label-caps mb-2">Insert variable</div>
            {(['Recipient', 'Job', 'You'] as const).map((g) => (
              <div key={g} className="mb-2 flex flex-wrap items-center gap-1">
                <span className="w-16 text-[11px] text-muted-foreground">{g}</span>
                {TEMPLATE_VARS.filter((v) => v.group === g).map((v) => (
                  <button key={v.key} onClick={() => insertVar(v.key)} className="rounded-md border bg-card px-1.5 py-0.5 text-[11.5px] hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
                    {v.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="label-caps">Live preview</span>
            <div className="w-56">
              <SearchSelect
                value={previewContact}
                onChange={setPreviewContact}
                placeholder="Preview as…"
                options={contacts.map((c) => ({ value: c.id, label: c.name, hint: c.company, icon: <Avatar name={c.name} size={18} /> }))}
              />
            </div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4">
            {previewSubject.text && <p className="mb-2 border-b pb-2 text-[13px] font-medium">{previewSubject.text}</p>}
            <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
              <Highlighted text={preview.text} />
            </p>
          </div>
          {preview.missing.length > 0 && <p className="text-[12px] text-amber-600 dark:text-amber-400">Not available for this preview: {preview.missing.join(', ')}</p>}
          <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
            <ProgressRing value={analysis.score} max={100} size={52} stroke={5} barClass={analysis.score >= 80 ? 'stroke-emerald-500' : analysis.score >= 60 ? 'stroke-amber-500' : 'stroke-rose-500'} trackClass="stroke-muted">
              <span className="text-[13px] font-semibold">{analysis.score}</span>
            </ProgressRing>
            <div className="min-w-0 text-[12.5px]">
              <div className="font-semibold">{analysis.grade}</div>
              <div className="text-muted-foreground">
                {analysis.checks
                  .filter((c) => !c.pass)
                  .slice(0, 2)
                  .map((c) => c.tip)
                  .join(' ') || 'Looks great.'}
              </div>
            </div>
          </div>
          {limit.note && <p className="text-[12px] text-muted-foreground">{limit.note}</p>}
        </div>
      </div>
    </Modal>
  );
}
