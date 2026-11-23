import * as React from 'react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Download, ExternalLink, FileText, FileUp, Link2, MessageSquareQuote, Pencil, Plus, Search, Star, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { undoToast } from '@/lib/store';
import { deleteRow, saveDocument, saveSnippet } from '@/lib/actions';
import { breakdownBy } from '@/lib/stats';
import type { DocKind, DocumentFile, Snippet } from '@/lib/types';
import { bytes, cn, copyText, fmtDate, fmtPct, normalizeUrl, plural } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Tabs, Textarea } from '@/components/ui';
import { Modal } from '@/components/overlay';
import { PageHeader } from '@/components/common';
import { db } from '@/lib/db';

type Tab = 'files' | 'snippets';
const KIND_LABEL: Record<DocKind, string> = { resume: 'Resume', cover_letter: 'Cover letter', portfolio: 'Portfolio', other: 'Other' };

export default function DocumentsPage() {
  const { tab = 'files' } = useParams();
  const navigate = useNavigate();
  const { documents, snippets } = useData();
  return (
    <div className="page">
      <PageHeader icon={<FileText className="h-5 w-5" />} title="Documents" subtitle="Resume versions (with performance), cover letters and copy-paste answers for application forms." />
      <Tabs
        className="mb-5"
        value={tab as Tab}
        onChange={(t) => navigate(t === 'files' ? '/documents' : `/documents/${t}`)}
        tabs={[
          { id: 'files', label: 'Resumes & files', icon: <FileText className="h-4 w-4" />, count: documents.length || undefined },
          { id: 'snippets', label: 'Answer library', icon: <MessageSquareQuote className="h-4 w-4" />, count: snippets.length || undefined },
        ]}
      />
      {tab === 'files' ? <Files /> : <Snippets />}
    </div>
  );
}

function guessKind(name: string): DocKind {
  const n = name.toLowerCase();
  if (/cover/.test(n)) return 'cover_letter';
  if (/portfolio|case.?study/.test(n)) return 'portfolio';
  if (/resume|cv|résumé/.test(n)) return 'resume';
  return 'resume';
}

function Files() {
  const { documents, apps } = useData();
  const [editing, setEditing] = useState<DocumentFile | 'link' | null>(null);
  const [drag, setDrag] = useState(false);
  const perf = useMemo(() => new Map(breakdownBy(apps.filter((a) => a.resumeId), (a) => a.resumeId, (k) => k).map((b) => [b.key, b])), [apps]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      if (f.size > 15 * 1024 * 1024) {
        toast.error(`${f.name} is larger than 15 MB`);
        continue;
      }
      await saveDocument({ name: f.name.replace(/\.[^.]+$/, ''), fileName: f.name, mimeType: f.type, size: f.size, blob: f, kind: guessKind(f.name), isDefault: !documents.some((d) => d.kind === 'resume') });
    }
    toast.success(`Uploaded ${plural(files.length, 'file')}`, { description: 'Stored privately in this browser.' });
  };

  const open = (d: DocumentFile, download = false) => {
    if (d.link && !d.blob) return window.open(normalizeUrl(d.link), '_blank', 'noopener');
    if (!d.blob) return toast.error('No file attached to this entry');
    const url = URL.createObjectURL(d.blob);
    if (download) {
      const a = document.createElement('a');
      a.href = url;
      a.download = d.fileName ?? d.name;
      a.click();
    } else window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const setDefault = async (d: DocumentFile) => {
    await db.transaction('rw', db.documents, async () => {
      for (const x of documents) if (x.kind === d.kind && x.isDefault) await db.documents.update(x.id, { isDefault: false });
      await db.documents.update(d.id, { isDefault: true });
    });
    toast.success(`${d.name} is now your default ${KIND_LABEL[d.kind].toLowerCase()}`);
  };

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files);
        }}
        className={cn('flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5', drag && 'border-primary bg-primary/5')}
      >
        <FileUp className="h-7 w-7 text-primary" />
        <span className="font-medium">Drop resumes or cover letters here, or click to upload</span>
        <span className="text-[12.5px] text-muted-foreground">PDF, DOCX, anything up to 15 MB · stored locally in your browser</span>
        <input type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
      </label>
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-muted-foreground">Tip: name versions clearly (e.g. “v3 — Frontend, metrics-heavy”) and pick one on each application — Analytics will A/B test them.</p>
        <Button size="sm" variant="secondary" onClick={() => setEditing('link')}>
          <Link2 className="h-3.5 w-3.5" /> Add link
        </Button>
      </div>
      {documents.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {[...documents]
            .sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault) || b.createdAt.localeCompare(a.createdAt))
            .map((d) => {
              const p = perf.get(d.id);
              return (
                <Card key={d.id} className="flex flex-col p-4">
                  <div className="flex items-start gap-3">
                    <div className="grid h-11 w-9 shrink-0 place-items-center rounded-md bg-gradient-to-b from-rose-500/15 to-rose-500/5 text-[9px] font-bold uppercase text-rose-600 ring-1 ring-rose-500/20">
                      {(d.fileName?.split('.').pop() ?? (d.link ? 'link' : 'doc')).slice(0, 4)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-[14px] font-semibold">{d.name}</span>
                        {d.isDefault && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                        <Badge tone="outline">{KIND_LABEL[d.kind]}</Badge>
                        {d.targetRole && <span>{d.targetRole}</span>}
                        {d.size ? <span>· {bytes(d.size)}</span> : null}
                        <span>· {fmtDate(d.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  {d.notes && <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{d.notes}</p>}
                  {d.kind === 'resume' && (
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/50 p-2 text-center">
                      <div>
                        <div className="text-[15px] font-semibold">{p?.total ?? 0}</div>
                        <div className="text-[10.5px] text-muted-foreground">applications</div>
                      </div>
                      <div>
                        <div className="text-[15px] font-semibold">{fmtPct(p?.responseRate ?? null)}</div>
                        <div className="text-[10.5px] text-muted-foreground">response</div>
                      </div>
                      <div>
                        <div className="text-[15px] font-semibold">{fmtPct(p?.positiveRate ?? null)}</div>
                        <div className="text-[10.5px] text-muted-foreground">screening+</div>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex flex-1 items-end gap-1.5 border-t pt-3">
                    <Button size="xs" variant="secondary" onClick={() => open(d)}>
                      <ExternalLink className="h-3 w-3" /> Open
                    </Button>
                    {d.blob && (
                      <Button size="xs" variant="secondary" onClick={() => open(d, true)}>
                        <Download className="h-3 w-3" /> Download
                      </Button>
                    )}
                    {!d.isDefault && (
                      <Button size="xs" variant="ghost" onClick={() => setDefault(d)}>
                        <Star className="h-3 w-3" /> Default
                      </Button>
                    )}
                    <div className="ml-auto flex">
                      <Button size="icon-xs" variant="ghost" onClick={() => setEditing(d)} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon-xs" variant="ghost" onClick={async () => undoToast('Document deleted', await deleteRow('documents', d.id))} aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      ) : (
        <Card>
          <EmptyState compact icon={<FileText className="h-5 w-5" />} title="No documents yet" description="Upload your resume versions to track which one gets more callbacks." />
        </Card>
      )}
      {editing && <DocEditor doc={editing === 'link' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function DocEditor({ doc, onClose }: { doc?: DocumentFile; onClose: () => void }) {
  const [d, setD] = useState<Partial<DocumentFile>>(doc ?? { kind: 'resume' });
  const save = async () => {
    if (!d.name?.trim()) return toast.error('Name is required');
    await saveDocument({ ...d, link: d.link ? normalizeUrl(d.link) : undefined }, doc?.id);
    toast.success('Saved');
    onClose();
  };
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={doc ? 'Edit document' : 'Add a document link'}
      description={doc ? undefined : 'e.g. a Google Docs resume, Notion portfolio or Behance link.'}
      icon={<FileText className="h-4 w-4" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input autoFocus value={d.name ?? ''} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Resume v4 — Product roles" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <Select value={d.kind} onChange={(e) => setD({ ...d, kind: e.target.value as DocKind })}>
              {(Object.keys(KIND_LABEL) as DocKind[]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target role">
            <Input value={d.targetRole ?? ''} onChange={(e) => setD({ ...d, targetRole: e.target.value })} placeholder="e.g. Product Manager" />
          </Field>
        </div>
        {(!doc || !doc.blob) && (
          <Field label="Link">
            <Input value={d.link ?? ''} onChange={(e) => setD({ ...d, link: e.target.value })} placeholder="https://…" />
          </Field>
        )}
        <Field label="Notes" hint="What’s different about this version?">
          <Textarea value={d.notes ?? ''} onChange={(e) => setD({ ...d, notes: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

const STARTERS: [string, string, string][] = [
  ['Tell me about yourself (60 sec)', 'Pitch', 'I’m a [role] with [X] years of experience in [domain/skills]. Recently I [achievement with a number]. Before that, I [one more highlight]. I’m now looking for [what you want next] — which is why [company/role] caught my eye.'],
  ['Why are you looking for a change?', 'Screening', 'I’ve grown a lot in my current role and I’m proud of what we shipped. I’m now looking for [bigger scope / a specific challenge / a domain] — growth, not escape.'],
  ['Notice period', 'Screening', '[30/60/90] days, negotiable — I can try to join sooner if needed.'],
  ['Current & expected CTC', 'Screening', 'My current CTC is [X] (fixed + variable). Based on the scope of this role and market benchmarks, I’m looking for [range], and I’m open to discussing the overall structure.'],
  ['Why this company?', 'Pitch', 'I’ve followed [company] since [moment]. What stands out is [specific product/mission detail]. The [team/problem] in this role is exactly where I can contribute — especially [skill or past result].'],
  ['Biggest achievement', 'Pitch', 'At [company], I [action] which led to [quantified result]. The hardest part was [challenge], which I solved by [approach].'],
  ['Work authorization / relocation', 'Screening', 'I’m based in [city], authorized to work in [country], and open to [remote / hybrid / relocation].'],
  ['Short note to recruiter', 'Messages', 'Hi! I’m a [role] with [X] years in [skills]. I recently [achievement]. I’d love to be considered for this role — happy to share more details.'],
];

function Snippets() {
  const { snippets } = useData();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Snippet | 'new' | null>(null);
  const list = snippets.filter((s) => !q || `${s.title} ${s.body} ${s.category ?? ''}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0));
  const addStarters = async () => {
    const have = new Set(snippets.map((s) => s.title.toLowerCase()));
    let n = 0;
    for (const [title, category, body] of STARTERS) {
      if (have.has(title.toLowerCase())) continue;
      await saveSnippet({ title, category, body });
      n++;
    }
    toast.success(n ? `Added ${plural(n, 'starter snippet')} — fill in the [brackets]` : 'You already have them');
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search answers…" className="pl-9" />
        </div>
        <p className="hidden text-[12.5px] text-muted-foreground md:block">Write once, paste into every application form.</p>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={addStarters}>
            <Layers className="h-3.5 w-3.5" /> Starter answers
          </Button>
          <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> New answer
          </Button>
        </div>
      </div>
      {list.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((s) => (
            <Card key={s.id} className="group flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold">{s.title}</div>
                  {s.category && <Badge tone="outline" className="mt-1">{s.category}</Badge>}
                </div>
                <div className="flex opacity-60 transition-opacity group-hover:opacity-100">
                  <Button size="icon-xs" variant="ghost" onClick={() => setEditing(s)} aria-label="Edit">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-xs" variant="ghost" onClick={async () => undoToast('Deleted', await deleteRow('snippets', s.id))} aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <p className="mt-2 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="text-[11.5px] text-muted-foreground">Copied {s.uses ?? 0}×</span>
                <Button
                  size="xs"
                  variant="primary"
                  onClick={async () => {
                    if (await copyText(s.body)) {
                      await saveSnippet({ uses: (s.uses ?? 0) + 1 }, s.id);
                      toast.success('Copied');
                    }
                  }}
                >
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<MessageSquareQuote className="h-6 w-6" />}
            title="Your answer library"
            description="Store polished answers to the questions every application asks — notice period, CTC, “why us?” — and paste them in seconds."
            action={
              <Button variant="primary" onClick={addStarters}>
                <Layers className="h-4 w-4" /> Add starter answers
              </Button>
            }
          />
        </Card>
      )}
      {editing && <SnippetEditor s={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SnippetEditor({ s, onClose }: { s?: Snippet; onClose: () => void }) {
  const [d, setD] = useState<Partial<Snippet>>(s ?? { category: 'Screening' });
  const save = async () => {
    if (!d.title?.trim() || !d.body?.trim()) return toast.error('Title and answer are required');
    await saveSnippet(d, s?.id);
    toast.success('Saved');
    onClose();
  };
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={s ? 'Edit answer' : 'New answer'}
      icon={<MessageSquareQuote className="h-4 w-4" />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          <Field label="Question / title">
            <Input autoFocus value={d.title ?? ''} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Why do you want to join us?" />
          </Field>
          <Field label="Category">
            <Input value={d.category ?? ''} onChange={(e) => setD({ ...d, category: e.target.value })} list="snip-cats" />
            <datalist id="snip-cats">
              {['Pitch', 'Screening', 'Messages', 'Cover letter'].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
        <Field label="Answer">
          <Textarea value={d.body ?? ''} onChange={(e) => setD({ ...d, body: e.target.value })} className="min-h-[160px]" />
        </Field>
      </div>
    </Modal>
  );
}
