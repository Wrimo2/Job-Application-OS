import * as React from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { differenceInCalendarDays } from 'date-fns';
import { Download, FileUp, Kanban, Linkedin, ListFilter, Plus, Repeat, Search, Send, Table2, Trash2, Users, X, ChevronsUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { useLocalState } from '@/lib/hooks';
import { confirmDialog, undoToast, useUI } from '@/lib/store';
import { deleteContacts, updateContact } from '@/lib/actions';
import { CONTACT_BOARD_STAGES, CONTACT_STAGES, CONTACT_STAGE_MAP, RELATIONSHIPS } from '@/lib/constants';
import { exportContactsCSV, importLinkedInConnections } from '@/lib/io';
import type { Contact, ContactStage } from '@/lib/types';
import { cn, plural, relDay, toDate } from '@/lib/utils';
import { Board, type BoardColumn } from '@/components/Board';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Segmented } from '@/components/ui';
import { Menu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Modal, Tip } from '@/components/overlay';
import { Avatar, CompanyLogo, ContactStageBadge, DueBadge, PageHeader, RelationshipBadge, WarmthBadge } from '@/components/common';

type Quick = 'all' | 'targets' | 'awaiting' | 'due' | 'conversations' | 'referrers' | 'network' | 'cold' | 'no_response';

export default function ContactsPage() {
  const ui = useUI();
  const { contacts, enrollments, sequences, interactions } = useData();
  const [params, setParams] = useSearchParams();
  const quick = (params.get('quick') as Quick) || 'all';
  const setQuick = (q: Quick) => setParams(q === 'all' ? {} : { quick: q }, { replace: true });
  const [view, setView] = useLocalState<'table' | 'board'>('contacts.view', 'table');
  const [search, setSearch] = useState('');
  const [rels, setRels] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  const activeSeq = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of enrollments) if (e.status === 'active' || e.status === 'paused') m.set(e.contactId, sequences.find((s) => s.id === e.sequenceId)?.name ?? 'Sequence');
    return m;
  }, [enrollments, sequences]);

  const awaitingIds = useMemo(() => {
    const s = new Set<string>();
    for (const i of interactions) if (i.direction === 'out' && i.outcome === 'awaiting' && i.contactId) s.add(i.contactId);
    return s;
  }, [interactions]);

  const match = (c: Contact, q: Quick): boolean => {
    const now = new Date();
    switch (q) {
      case 'all':
        return true;
      case 'targets':
        return c.stage === 'target';
      case 'awaiting':
        return c.stage === 'contacted' || (awaitingIds.has(c.id) && !['closed', 'referred'].includes(c.stage));
      case 'due':
        return !!c.nextFollowUpAt && toDate(c.nextFollowUpAt)! <= new Date(new Date().setHours(23, 59, 59));
      case 'conversations':
        return c.stage === 'replied' || c.stage === 'engaged';
      case 'referrers':
        return c.stage === 'referred';
      case 'network':
        return c.stage === 'network';
      case 'cold':
        return (c.warmth === 'warm' || c.warmth === 'hot') && ['network', 'engaged', 'replied', 'referred'].includes(c.stage) && (!c.lastContactedAt || differenceInCalendarDays(now, toDate(c.lastContactedAt)!) > 30);
      case 'no_response':
        return c.stage === 'no_response';
    }
  };

  const counts = useMemo(() => {
    const qs: Quick[] = ['all', 'targets', 'awaiting', 'due', 'conversations', 'referrers', 'network', 'cold', 'no_response'];
    return Object.fromEntries(qs.map((q) => [q, contacts.filter((c) => match(c, q)).length])) as Record<Quick, number>;
  }, [contacts, awaitingIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts
      .filter((c) => match(c, quick))
      .filter((c) => !rels.length || rels.includes(c.relationship))
      .filter((c) => !q || `${c.name} ${c.title ?? ''} ${c.company ?? ''} ${c.tags.join(' ')} ${c.notes ?? ''}`.toLowerCase().includes(q))
      .sort((a, b) => b.priority - a.priority || (b.lastContactedAt ?? b.createdAt).localeCompare(a.lastContactedAt ?? a.createdAt));
  }, [contacts, quick, rels, search, awaitingIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns: BoardColumn<Contact>[] = CONTACT_BOARD_STAGES.map((s) => ({
    id: s,
    title: CONTACT_STAGE_MAP[s].label,
    dot: CONTACT_STAGE_MAP[s].dot,
    hint: CONTACT_STAGE_MAP[s].hint,
    items: filtered.filter((c) => c.stage === s),
  }));

  const selIds = [...selected].filter((id) => contacts.some((c) => c.id === id));
  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const quicks: { id: Quick; label: string }[] = [
    { id: 'all', label: 'Everyone' },
    { id: 'targets', label: 'To reach out' },
    { id: 'awaiting', label: 'Awaiting reply' },
    { id: 'due', label: 'Follow-up due' },
    { id: 'conversations', label: 'Conversations' },
    { id: 'referrers', label: 'Referrers' },
    { id: 'network', label: 'Network' },
    { id: 'cold', label: 'Going cold' },
    { id: 'no_response', label: 'No response' },
  ];

  return (
    <div className="page">
      <PageHeader
        icon={<Users className="h-5 w-5" />}
        title="Contacts"
        subtitle="Your job-search CRM — recruiters, hiring managers, referrers and your network."
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { id: 'table', label: 'List', icon: <Table2 className="h-3.5 w-3.5" /> },
                { id: 'board', label: 'Pipeline', icon: <Kanban className="h-3.5 w-3.5" /> },
              ]}
            />
            <Menu>
              <MenuTrigger asChild>
                <Button size="sm" variant="secondary">
                  <FileUp className="h-3.5 w-3.5" /> Import / export
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Linkedin />} onSelect={() => setImportOpen(true)}>
                  Import LinkedIn connections
                </MenuItem>
                <MenuItem icon={<Download />} onSelect={() => exportContactsCSV(filtered)}>
                  Export {plural(filtered.length, 'contact')} (CSV)
                </MenuItem>
              </MenuContent>
            </Menu>
            <Button size="sm" variant="primary" onClick={() => ui.openContactForm()}>
              <Plus className="h-4 w-4" /> Add person
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1">
          {quicks.map((q) => (
            <button
              key={q.id}
              onClick={() => setQuick(q.id)}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors',
                quick === q.id ? 'border-primary/40 bg-primary/10 text-primary' : 'bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {q.label}
              <span className="tabular-nums opacity-70">{counts[q.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, company, title…" className="pl-9" />
          </div>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" size="sm" className={cn(rels.length && 'border-primary/40 text-primary')}>
                <ListFilter className="h-3.5 w-3.5" /> Relationship{rels.length ? ` · ${rels.length}` : ''}
              </Button>
            </MenuTrigger>
            <MenuContent align="start">
              <MenuLabel>Relationship</MenuLabel>
              {RELATIONSHIPS.map((r) => (
                <MenuCheckItem key={r.id} checked={rels.includes(r.id)} onSelect={() => setRels((x) => (x.includes(r.id) ? x.filter((y) => y !== r.id) : [...x, r.id]))}>
                  {r.label}
                </MenuCheckItem>
              ))}
              {rels.length > 0 && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<X />} onSelect={() => setRels([])}>
                    Clear
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
          <span className="ml-auto text-[12.5px] text-muted-foreground">{plural(filtered.length, 'person', 'people')}</span>
        </div>
      </div>

      {!contacts.length ? (
        <Card>
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title="Build your outreach list"
            description="Add the recruiters, hiring managers and employees at companies you want. Or import your LinkedIn connections to see who you already know everywhere."
            action={
              <>
                <Button variant="primary" onClick={() => ui.openContactForm()}>
                  <Plus className="h-4 w-4" /> Add person
                </Button>
                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                  <Linkedin className="h-4 w-4" /> Import LinkedIn connections
                </Button>
              </>
            }
          />
        </Card>
      ) : view === 'board' ? (
        <Board
          columns={columns}
          getId={(c) => c.id}
          onOpen={(c) => ui.openDrawer('contact', c.id)}
          onMove={(id, to) => updateContact(id, { stage: to as ContactStage }).then(() => toast.success(`Moved to ${CONTACT_STAGE_MAP[to as ContactStage].label}`))}
          renderCard={(c) => <ContactCard c={c} seq={activeSeq.get(c.id)} />}
          columnWidth={260}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[12px] text-muted-foreground">
                  <th className="w-10 px-3 py-2.5">
                    <Checkbox checked={allSelected} indeterminate={!allSelected && selIds.length > 0} onChange={(v) => setSelected(v ? new Set(filtered.map((c) => c.id)) : new Set())} label="Select all" />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Person</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">Relationship</th>
                  <th className="px-3 py-2.5 font-medium">Stage</th>
                  <th className="hidden px-3 py-2.5 font-medium xl:table-cell">Warmth</th>
                  <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Last touch</th>
                  <th className="px-3 py-2.5 font-medium">Next</th>
                  <th className="w-10 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} onClick={() => ui.openDrawer('contact', c.id)} className={cn('cursor-pointer border-b last:border-0 hover:bg-accent/50', selected.has(c.id) && 'bg-primary/5')}>
                    <td className="px-3 py-2.5">
                      <Checkbox
                        checked={selected.has(c.id)}
                        onChange={(v) =>
                          setSelected((s) => {
                            const n = new Set(s);
                            v ? n.add(c.id) : n.delete(c.id);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="max-w-[320px] px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.name} size={32} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate font-medium">
                            {c.name}
                            {c.priority === 3 && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" title="High priority" />}
                          </div>
                          <div className="flex items-center gap-1 truncate text-[12px] text-muted-foreground">
                            {c.company && <CompanyLogo name={c.company} size={14} rounded="rounded" />}
                            {c.title}
                            {c.company ? ` · ${c.company}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      <RelationshipBadge rel={c.relationship} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        <ContactStageBadge stage={c.stage} />
                        {activeSeq.get(c.id) && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-primary">
                            <Repeat className="h-3 w-3" /> {activeSeq.get(c.id)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-3 py-2.5 xl:table-cell">
                      <WarmthBadge warmth={c.warmth} />
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted-foreground sm:table-cell">{c.lastContactedAt ? relDay(c.lastContactedAt) : 'never'}</td>
                    <td className="px-3 py-2.5">{c.nextFollowUpAt ? <DueBadge due={c.nextFollowUpAt} /> : <span className="text-muted-foreground/50">—</span>}</td>
                    <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <Tip content="Compose message">
                        <Button size="icon-xs" variant="ghost" onClick={() => ui.openComposer({ contactId: c.id, applicationId: c.applicationIds[0] })}>
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                      </Tip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && <EmptyState compact icon={<Search className="h-5 w-5" />} title="Nobody here" description="Try another filter." />}
          </div>
        </Card>
      )}

      {selIds.length > 0 && view === 'table' && (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border bg-popover px-3 py-2 shadow-2xl animate-fade-up lg:bottom-6">
          <span className="px-1 text-[13px] font-medium">{selIds.length} selected</span>
          <Button size="sm" variant="primary" onClick={() => ui.openEnroll(selIds)}>
            <Repeat className="h-3.5 w-3.5" /> Start sequence
          </Button>
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="secondary">
                <ChevronsUpDown className="h-3.5 w-3.5" /> Stage
              </Button>
            </MenuTrigger>
            <MenuContent align="center">
              {CONTACT_STAGES.map((s) => (
                <MenuItem
                  key={s.id}
                  icon={<span className={cn('h-2 w-2 rounded-full', s.dot)} />}
                  onSelect={async () => {
                    for (const id of selIds) await updateContact(id, { stage: s.id });
                    toast.success(`Moved ${plural(selIds.length, 'person', 'people')} to ${s.label}`);
                    setSelected(new Set());
                  }}
                >
                  {s.label}
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              const ok = await confirmDialog({ title: `Delete ${plural(selIds.length, 'contact')}?`, confirmLabel: 'Delete', danger: true, undoable: true });
              if (!ok) return;
              const restore = await deleteContacts(selIds);
              setSelected(new Set());
              undoToast('Deleted', restore);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <LinkedInImport open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function ContactCard({ c, seq }: { c: Contact; seq?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-soft transition-all hover:border-foreground/15 hover:shadow-lift">
      <div className="flex items-start gap-2.5">
        <Avatar name={c.name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold">{c.name}</div>
          <div className="truncate text-[12px] text-muted-foreground">
            {c.title}
            {c.company ? ` · ${c.company}` : ''}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <RelationshipBadge rel={c.relationship} />
        {c.warmth !== 'cold' && <WarmthBadge warmth={c.warmth} />}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11.5px] text-muted-foreground">
        <span>{c.lastContactedAt ? `Touched ${relDay(c.lastContactedAt)}` : 'Not contacted'}</span>
        {seq ? (
          <Badge tone="primary">
            <span className="inline-flex items-center gap-1">
              <Repeat className="h-3 w-3" />
              In sequence
            </span>
          </Badge>
        ) : c.nextFollowUpAt ? (
          <DueBadge due={c.nextFollowUpAt} />
        ) : null}
      </div>
    </div>
  );
}

function LinkedInImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const r = await importLinkedInConnections(await f.text());
      toast.success(`Imported ${plural(r.added, 'connection')}`, { description: r.skipped ? `${r.skipped} skipped (duplicates or empty rows).` : 'See who you know at each company on the Companies page.' });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onOpenChange={(v) => !v && onClose()} title="Import your LinkedIn connections" description="Instantly see who you already know at every company you apply to." icon={<Linkedin className="h-4 w-4" />}>
      <div className="space-y-4 text-[13.5px]">
        <ol className="list-decimal space-y-1.5 pl-5 text-muted-foreground">
          <li>
            On LinkedIn, open <b className="text-foreground">Settings & Privacy → Data privacy → Get a copy of your data</b>.
          </li>
          <li>
            Choose <b className="text-foreground">Connections</b> and request the archive (usually ready in ~10 minutes).
          </li>
          <li>
            Download it, unzip, and upload <b className="text-foreground">Connections.csv</b> below.
          </li>
        </ol>
        <label className={cn('flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5', busy && 'pointer-events-none opacity-60')}>
          <FileUp className="h-7 w-7 text-primary" />
          <span className="font-medium">{busy ? 'Importing…' : 'Choose Connections.csv'}</span>
          <span className="text-[12px] text-muted-foreground">Imported as “Network” contacts — duplicates are skipped. Stays on this device.</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
    </Modal>
  );
}
