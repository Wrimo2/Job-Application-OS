import * as React from 'react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Archive,
  Briefcase,
  ChevronsUpDown,
  Download,
  Eye,
  EyeOff,
  FileUp,
  Kanban,
  ListFilter,
  Plus,
  Search,
  Table2,
  Trash2,
  Upload,
  X,
  CalendarDays,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { useLocalState, useSettings } from '@/lib/hooks';
import { confirmDialog, undoToast, useUI } from '@/lib/store';
import { bulkMoveApplications, deleteApplications, updateApplication } from '@/lib/actions';
import { BOARD_STAGES, CLOSED_STAGES, PLATFORMS, STAGES, STAGE_MAP, STAGE_RANK, WORK_MODES, platformMeta } from '@/lib/constants';
import { exportApplicationsCSV, parseCSV, guessMapping, APP_IMPORT_FIELDS, importApplicationRows, type ImportField } from '@/lib/io';
import { daysSinceApplied, isClosed, responseDays } from '@/lib/stats';
import type { Application, Interview, Stage } from '@/lib/types';
import { cn, fmtDate, formatSalaryRange, plural, relDay, toDate } from '@/lib/utils';
import { Board, type BoardColumn } from '@/components/Board';
import { Badge, Button, Card, Checkbox, EmptyState, Input, Segmented, Select, Switch } from '@/components/ui';
import { Menu, MenuCheckItem, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Modal, Tip } from '@/components/overlay';
import { CompanyLogo, DueBadge, PageHeader, PlatformTag, PriorityFlag, StageBadge } from '@/components/common';
import { moveWithFeedback } from './helpers';

type Quick = 'active' | 'all' | 'action' | 'stale' | 'ghost' | 'interviewing' | 'offers' | 'wishlist' | 'closed' | 'archived';
type SortKey = 'company' | 'status' | 'appliedAt' | 'nextActionAt' | 'priority' | 'salary' | 'updatedAt';

export default function ApplicationsPage() {
  const ui = useUI();
  const navigate = useNavigate();
  const settings = useSettings();
  const { apps, interviews, contacts } = useData();
  const [params, setParams] = useSearchParams();
  const quick = (params.get('quick') as Quick) || 'active';
  const setQuick = (q: Quick) => setParams(q === 'active' ? {} : { quick: q }, { replace: true });
  const [view, setView] = useLocalState<'board' | 'table'>('apps.view', 'board');
  const [showClosed, setShowClosed] = useLocalState('apps.showClosed', false);
  const [search, setSearch] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [modes, setModes] = useState<string[]>([]);
  const [highOnly, setHighOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importOpen, setImportOpen] = useState(false);

  const nextInterview = useMemo(() => {
    const m = new Map<string, Interview>();
    const now = new Date();
    for (const iv of interviews) {
      if (iv.outcome !== 'scheduled' || toDate(iv.scheduledAt)! < now) continue;
      const cur = m.get(iv.applicationId);
      if (!cur || iv.scheduledAt < cur.scheduledAt) m.set(iv.applicationId, iv);
    }
    return m;
  }, [interviews]);

  const counts = useMemo(() => {
    const c: Record<Quick, number> = { active: 0, all: apps.length, action: 0, stale: 0, ghost: 0, interviewing: 0, offers: 0, wishlist: 0, closed: 0, archived: 0 };
    for (const a of apps) {
      if (matchesQuick(a, 'active', settings)) c.active++;
      if (matchesQuick(a, 'action', settings)) c.action++;
      if (matchesQuick(a, 'stale', settings)) c.stale++;
      if (matchesQuick(a, 'ghost', settings)) c.ghost++;
      if (matchesQuick(a, 'interviewing', settings)) c.interviewing++;
      if (matchesQuick(a, 'offers', settings)) c.offers++;
      if (matchesQuick(a, 'wishlist', settings)) c.wishlist++;
      if (matchesQuick(a, 'closed', settings)) c.closed++;
      if (a.archived) c.archived++;
    }
    return c;
  }, [apps, settings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const effectiveQuick: Quick = view === 'board' && quick === 'active' && showClosed ? 'all' : quick;
    return apps.filter((a) => {
      if (!matchesQuick(a, effectiveQuick, settings)) return false;
      if (platforms.length && !platforms.includes(a.platform)) return false;
      if (modes.length && (!a.workMode || !modes.includes(a.workMode))) return false;
      if (highOnly && a.priority !== 3) return false;
      if (q) {
        const hay = `${a.role} ${a.company} ${a.location ?? ''} ${a.tags.join(' ')} ${a.notes ?? ''} ${platformMeta(a.platform).label}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [apps, quick, search, platforms, modes, highOnly, settings, view, showClosed]);

  const sorted = useMemo(() => {
    const val = (a: Application): string | number => {
      switch (sort.key) {
        case 'company':
          return a.company.toLowerCase();
        case 'status':
          return STAGES.findIndex((s) => s.id === a.status);
        case 'appliedAt':
          return a.appliedAt ?? '';
        case 'nextActionAt':
          return a.nextActionAt ?? '9999';
        case 'priority':
          return a.priority;
        case 'salary':
          return a.salaryMax ?? a.salaryMin ?? 0;
        default:
          return a.updatedAt;
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [filtered, sort]);

  const columns: BoardColumn<Application>[] = useMemo(() => {
    const stages: Stage[] = [...BOARD_STAGES, ...(showClosed || quick === 'closed' || quick === 'all' ? CLOSED_STAGES : [])];
    const visible = stages.filter((s) => filtered.some((a) => a.status === s) || BOARD_STAGES.includes(s) || showClosed);
    return visible.map((s) => ({
      id: s,
      title: STAGE_MAP[s].label,
      dot: STAGE_MAP[s].dot,
      hint: STAGE_MAP[s].hint,
      items: filtered
        .filter((a) => a.status === s)
        .sort((a, b) => b.priority - a.priority || (b.updatedAt > a.updatedAt ? 1 : -1)),
    }));
  }, [filtered, showClosed, quick]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'company' ? 1 : -1 }));
  const allSelected = sorted.length > 0 && sorted.every((a) => selected.has(a.id));
  const selIds = [...selected].filter((id) => apps.some((a) => a.id === id));

  const quicks: { id: Quick; label: string; tone?: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'action', label: 'Needs action', tone: 'text-rose-600' },
    { id: 'stale', label: `No reply ${settings.followUpDays}d+` },
    { id: 'ghost', label: 'Likely ghosted' },
    { id: 'interviewing', label: 'Interviewing' },
    { id: 'offers', label: 'Offers' },
    { id: 'wishlist', label: 'Wishlist' },
    { id: 'closed', label: 'Closed' },
    { id: 'all', label: 'All' },
  ];
  if (counts.archived) quicks.push({ id: 'archived', label: 'Archived' });

  const filtersActive = platforms.length + modes.length + (highOnly ? 1 : 0);

  return (
    <div className="page">
      <PageHeader
        icon={<Briefcase className="h-5 w-5" />}
        title="Applications"
        subtitle={`${counts.active} active · ${apps.filter((a) => a.status !== 'wishlist').length} applied all-time`}
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { id: 'board', label: 'Board', icon: <Kanban className="h-3.5 w-3.5" /> },
                { id: 'table', label: 'Table', icon: <Table2 className="h-3.5 w-3.5" /> },
              ]}
            />
            <Menu>
              <MenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  <Upload className="h-3.5 w-3.5" /> Import / export
                </Button>
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<FileUp />} onSelect={() => setImportOpen(true)}>
                  Import from spreadsheet (CSV)
                </MenuItem>
                <MenuItem icon={<Download />} onSelect={() => exportApplicationsCSV(sorted)}>
                  Export {plural(sorted.length, 'row')} to CSV
                </MenuItem>
              </MenuContent>
            </Menu>
            <Button variant="primary" size="sm" onClick={() => ui.openAppForm()}>
              <Plus className="h-4 w-4" /> Add application
            </Button>
          </>
        }
      />

      {/* Filter bar */}
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
              <span className={cn('tabular-nums', quick === q.id ? 'text-primary/80' : 'text-muted-foreground/70')}>{counts[q.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search role, company, tag…" className="pl-9" />
          </div>
          <Menu>
            <MenuTrigger asChild>
              <Button variant="secondary" size="sm" className={cn(filtersActive && 'border-primary/40 text-primary')}>
                <ListFilter className="h-3.5 w-3.5" /> Filters{filtersActive ? ` · ${filtersActive}` : ''}
              </Button>
            </MenuTrigger>
            <MenuContent align="start" className="max-h-[60vh] w-64 overflow-y-auto">
              <MenuLabel>Platform</MenuLabel>
              {PLATFORMS.filter((p) => apps.some((a) => a.platform === p.id)).map((p) => (
                <MenuCheckItem
                  key={p.id}
                  checked={platforms.includes(p.id)}
                  onSelect={() => setPlatforms((x) => (x.includes(p.id) ? x.filter((y) => y !== p.id) : [...x, p.id]))}
                >
                  {p.label}
                </MenuCheckItem>
              ))}
              <MenuSeparator />
              <MenuLabel>Work mode</MenuLabel>
              {WORK_MODES.map((w) => (
                <MenuCheckItem key={w.id} checked={modes.includes(w.id)} onSelect={() => setModes((x) => (x.includes(w.id) ? x.filter((y) => y !== w.id) : [...x, w.id]))}>
                  {w.label}
                </MenuCheckItem>
              ))}
              <MenuSeparator />
              <MenuCheckItem checked={highOnly} onSelect={() => setHighOnly(!highOnly)}>
                High priority only
              </MenuCheckItem>
              {filtersActive > 0 && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<X />} onSelect={() => { setPlatforms([]); setModes([]); setHighOnly(false); }}>
                    Clear filters
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
          {view === 'board' && quick === 'active' && (
            <Button variant="ghost" size="sm" onClick={() => setShowClosed(!showClosed)}>
              {showClosed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showClosed ? 'Hide closed' : 'Show closed'}
            </Button>
          )}
          <span className="ml-auto text-[12.5px] text-muted-foreground">{plural(filtered.length, 'application')}</span>
        </div>
      </div>

      {!apps.length ? (
        <Card>
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title="Track your first application"
            description="Paste a job link from LinkedIn, Naukri or any careers page — Pursuit detects the platform, sets a follow-up reminder and starts your analytics."
            action={
              <>
                <Button variant="primary" onClick={() => ui.openAppForm()}>
                  <Plus className="h-4 w-4" /> Add application
                </Button>
                <Button variant="secondary" onClick={() => setImportOpen(true)}>
                  <FileUp className="h-4 w-4" /> Import spreadsheet
                </Button>
              </>
            }
          />
        </Card>
      ) : view === 'board' ? (
        <Board
          columns={columns}
          getId={(a) => a.id}
          onOpen={(a) => ui.openDrawer('application', a.id)}
          onMove={(id, to) => moveWithFeedback(id, to as Stage, navigate)}
          renderCard={(a) => <AppCard app={a} interview={nextInterview.get(a.id)} hasPeople={a.contactIds.length > 0 || contacts.some((c) => c.applicationIds.includes(a.id))} />}
          emptyText="Drag cards here"
        />
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-[12px] text-muted-foreground">
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox checked={allSelected} indeterminate={!allSelected && selIds.length > 0} onChange={(v) => setSelected(v ? new Set(sorted.map((a) => a.id)) : new Set())} label="Select all" />
                    </th>
                    <Th k="company" sort={sort} onSort={toggleSort}>Role & company</Th>
                    <Th k="status" sort={sort} onSort={toggleSort}>Status</Th>
                    <th className="px-3 py-2.5 font-medium">Platform</th>
                    <Th k="appliedAt" sort={sort} onSort={toggleSort}>Applied</Th>
                    <th className="px-3 py-2.5 font-medium">Response</th>
                    <Th k="salary" sort={sort} onSort={toggleSort}>Salary</Th>
                    <Th k="nextActionAt" sort={sort} onSort={toggleSort}>Next step</Th>
                    <Th k="priority" sort={sort} onSort={toggleSort} className="w-10"> </Th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((a) => {
                    const rd = responseDays(a);
                    const waiting = a.status === 'applied' ? daysSinceApplied(a) : null;
                    return (
                      <tr
                        key={a.id}
                        onClick={() => ui.openDrawer('application', a.id)}
                        className={cn('cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50', selected.has(a.id) && 'bg-primary/5')}
                      >
                        <td className="px-3 py-2.5">
                          <Checkbox
                            checked={selected.has(a.id)}
                            onChange={(v) =>
                              setSelected((s) => {
                                const n = new Set(s);
                                v ? n.add(a.id) : n.delete(a.id);
                                return n;
                              })
                            }
                          />
                        </td>
                        <td className="max-w-[320px] px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <CompanyLogo name={a.company} size={30} />
                            <div className="min-w-0">
                              <div className="truncate font-medium">{a.role}</div>
                              <div className="truncate text-[12px] text-muted-foreground">
                                {a.company}
                                {a.location ? ` · ${a.location}` : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <StatusMenu app={a} />
                        </td>
                        <td className="px-3 py-2.5">
                          <PlatformTag platform={a.platform} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                          {a.appliedAt ? (
                            <Tip content={fmtDate(a.appliedAt)}>
                              <span>{relDay(a.appliedAt)}</span>
                            </Tip>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                          {rd !== null ? `${rd}d` : waiting !== null ? <span className={cn(waiting >= settings.ghostDays ? 'text-rose-600' : waiting >= settings.followUpDays ? 'text-amber-600' : '')}>waiting {waiting}d</span> : '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{formatSalaryRange(a.salaryMin, a.salaryMax, a.currency ?? settings.currency) || <span className="text-muted-foreground/50">—</span>}</td>
                        <td className="max-w-[220px] px-3 py-2.5">
                          {a.nextActionAt && !isClosed(a) ? (
                            <div className="flex min-w-0 items-center gap-2">
                              <DueBadge due={a.nextActionAt} />
                              <span className="truncate text-[12px] text-muted-foreground">{a.nextAction}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <PriorityFlag priority={a.priority} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!sorted.length && <EmptyState compact icon={<Search className="h-5 w-5" />} title="Nothing matches" description="Try another filter or search." />}
            </div>
          </Card>
          {/* Mobile list */}
          <div className="space-y-2 md:hidden">
            {sorted.map((a) => (
              <div key={a.id} onClick={() => ui.openDrawer('application', a.id)}>
                <AppCard app={a} interview={nextInterview.get(a.id)} showStage />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Bulk action bar */}
      {view === 'table' && selIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-2xl border bg-popover px-3 py-2 shadow-2xl animate-fade-up lg:bottom-6">
          <span className="px-1 text-[13px] font-medium">{selIds.length} selected</span>
          <Menu>
            <MenuTrigger asChild>
              <Button size="sm" variant="secondary">
                <ChevronsUpDown className="h-3.5 w-3.5" /> Move to
              </Button>
            </MenuTrigger>
            <MenuContent align="center">
              {STAGES.map((s) => (
                <MenuItem
                  key={s.id}
                  icon={<span className={cn('h-2 w-2 rounded-full', s.dot)} />}
                  onSelect={async () => {
                    await bulkMoveApplications(selIds, s.id);
                    toast.success(`Moved ${plural(selIds.length, 'application')} to ${s.label}`);
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
            variant="secondary"
            onClick={async () => {
              for (const id of selIds) await updateApplication(id, { archived: true });
              toast.success('Archived');
              setSelected(new Set());
            }}
          >
            <Archive className="h-3.5 w-3.5" /> Archive
          </Button>
          <Button size="sm" variant="secondary" onClick={() => exportApplicationsCSV(apps.filter((a) => selIds.includes(a.id)))}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              const ok = await confirmDialog({ title: `Delete ${plural(selIds.length, 'application')}?`, confirmLabel: 'Delete', danger: true, undoable: true });
              if (!ok) return;
              const restore = await deleteApplications(selIds);
              setSelected(new Set());
              undoToast(`Deleted ${plural(selIds.length, 'application')}`, restore);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

function matchesQuick(a: Application, q: Quick, s: { followUpDays: number; ghostDays: number }): boolean {
  if (q === 'archived') return !!a.archived;
  if (a.archived) return false;
  const closed = CLOSED_STAGES.includes(a.status);
  switch (q) {
    case 'all':
      return true;
    case 'active':
      return !closed;
    case 'action':
      return !closed && !!a.nextActionAt && (toDate(a.nextActionAt)! <= new Date() || relDay(a.nextActionAt) === 'today');
    case 'stale': {
      const d = daysSinceApplied(a);
      return a.status === 'applied' && d !== null && d >= s.followUpDays && d < s.ghostDays;
    }
    case 'ghost':
      return a.status === 'applied' && (daysSinceApplied(a) ?? 0) >= s.ghostDays;
    case 'interviewing':
      return ['screening', 'assessment', 'interviewing'].includes(a.status);
    case 'offers':
      return a.status === 'offer' || a.status === 'accepted';
    case 'wishlist':
      return a.status === 'wishlist';
    case 'closed':
      return closed;
  }
}

function Th({ k, sort, onSort, children, className }: { k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; children: React.ReactNode; className?: string }) {
  const active = sort.key === k;
  return (
    <th className={cn('px-3 py-2.5 font-medium', className)}>
      <button onClick={() => onSort(k)} className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')}>
        {children}
        {active && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );
}

function StatusMenu({ app }: { app: Application }) {
  const navigate = useNavigate();
  return (
    <Menu>
      <MenuTrigger asChild>
        <button className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
          <StageBadge stage={app.status} />
        </button>
      </MenuTrigger>
      <MenuContent align="start">
        {STAGES.map((s) => (
          <MenuItem key={s.id} icon={<span className={cn('h-2 w-2 rounded-full', s.dot)} />} onSelect={() => moveWithFeedback(app.id, s.id, navigate)}>
            {s.label}
          </MenuItem>
        ))}
      </MenuContent>
    </Menu>
  );
}

export function AppCard({ app, interview, showStage, hasPeople }: { app: Application; interview?: Interview; showStage?: boolean; hasPeople?: boolean }) {
  const settings = useSettings();
  const salary = formatSalaryRange(app.salaryMin, app.salaryMax, app.currency ?? settings.currency);
  const waiting = app.status === 'applied' ? daysSinceApplied(app) : null;
  const closed = isClosed(app);
  return (
    <div className="group rounded-xl border bg-card p-3 shadow-soft transition-all hover:border-foreground/15 hover:shadow-lift">
      <div className="flex items-start gap-2.5">
        <CompanyLogo name={app.company} size={34} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="truncate text-[13.5px] font-semibold leading-5">{app.role}</span>
            <PriorityFlag priority={app.priority} />
          </div>
          <div className="truncate text-[12.5px] text-muted-foreground">
            {app.company}
            {app.location ? ` · ${app.location}` : ''}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {showStage && <StageBadge stage={app.status} />}
        <PlatformTag platform={app.platform} />
        {(app.method === 'referral' || app.referrerId) && <Badge tone="green">Referral</Badge>}
        {hasPeople && !app.referrerId && (
          <Tip content="People linked">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          </Tip>
        )}
        {salary && <span className="text-[12px] tabular-nums text-muted-foreground">{salary}</span>}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
        <span className="truncate">
          {app.status === 'wishlist' ? `Saved ${relDay(app.createdAt)}` : app.appliedAt ? `Applied ${relDay(app.appliedAt)}` : ''}
          {waiting !== null && waiting >= settings.followUpDays && <span className={cn('ml-1', waiting >= settings.ghostDays ? 'text-rose-600' : 'text-amber-600')}>· no reply</span>}
        </span>
        {interview ? (
          <Badge tone="violet">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {relDay(interview.scheduledAt)}
            </span>
          </Badge>
        ) : app.nextActionAt && !closed ? (
          <DueBadge due={app.nextActionAt} />
        ) : app.deadline && app.status === 'wishlist' ? (
          <DueBadge due={app.deadline} prefix="Apply by" />
        ) : null}
      </div>
    </div>
  );
}

/* ───────────────────────── CSV import ───────────────────────── */

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const settings = useSettings();
  const [rows, setRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Record<ImportField['key'], number> | null>(null);
  const [dayFirst, setDayFirst] = useState(settings.currency === 'INR' || settings.currency === 'GBP' || settings.currency === 'EUR');
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setRows(null);
    setMapping(null);
    setFileName('');
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    const parsed = parseCSV(await f.text());
    if (parsed.length < 2) {
      toast.error('That file looks empty');
      return;
    }
    setFileName(f.name);
    setRows(parsed);
    setMapping(guessMapping(parsed[0]));
  };

  const run = async () => {
    if (!rows || !mapping) return;
    if (mapping.company < 0 || mapping.role < 0) {
      toast.error('Map at least the Company and Role columns');
      return;
    }
    setBusy(true);
    try {
      const n = await importApplicationRows(rows.slice(1), mapping, { dayFirst });
      toast.success(`Imported ${plural(n, 'application')}`);
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset();
          onClose();
        }
      }}
      title="Import applications"
      description="Bring your existing tracker from Excel, Google Sheets or Notion (export as CSV)."
      icon={<FileUp className="h-4 w-4" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!rows} loading={busy} onClick={run}>
            Import {rows ? plural(rows.length - 1, 'row') : ''}
          </Button>
        </>
      }
    >
      {!rows ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5">
          <FileUp className="h-8 w-8 text-primary" />
          <span className="font-medium">Choose a CSV file</span>
          <span className="text-[13px] text-muted-foreground">We’ll auto-detect columns like Company, Role, Status, Date applied, Link…</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[13px]">
            <span>
              <b>{fileName}</b> · {plural(rows.length - 1, 'row')}
            </span>
            <Button size="xs" variant="ghost" onClick={reset}>
              Choose another file
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {APP_IMPORT_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1">
                <div className="text-[12px] font-medium">
                  {f.label}
                  {f.required && <span className="text-rose-500"> *</span>}
                </div>
                <Select value={mapping?.[f.key] ?? -1} onChange={(e) => setMapping((m) => ({ ...(m as Record<ImportField['key'], number>), [f.key]: Number(e.target.value) }))} className="h-8 text-[13px]">
                  <option value={-1}>— Skip —</option>
                  {rows[0].map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <Switch checked={dayFirst} onChange={setDayFirst} label="Day first" /> Dates are day-first (DD/MM/YYYY)
          </label>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[12px]">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  {['Company', 'Role', 'Status', 'Platform', 'Applied'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(1, 6).map((r, i) => {
                  const g = (k: ImportField['key']) => (mapping && mapping[k] >= 0 ? r[mapping[k]] : '');
                  return (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-1.5">{g('company')}</td>
                      <td className="px-3 py-1.5">{g('role')}</td>
                      <td className="px-3 py-1.5">{g('status')}</td>
                      <td className="px-3 py-1.5">{g('platform')}</td>
                      <td className="px-3 py-1.5">{g('appliedAt')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-muted-foreground">Statuses like “Interview”, “Rejected”, “No response” and platforms like “LinkedIn”, “Naukri”, “Referral” are recognized automatically.</p>
        </div>
      )}
    </Modal>
  );
}
