import { format } from 'date-fns';
import { db, DATA_TABLES, getSettings, mergeSettings, updateSettings } from './db';
import { createApplication } from './actions';
import { INTERVIEW_TYPE_LABEL, PLATFORMS, STAGE_MAP, platformMeta, METHOD_MAP, RELATIONSHIP_MAP, CONTACT_STAGE_MAP } from './constants';
import type { Application, Contact, Interview, Relationship, Stage } from './types';
import { downloadFile, nowISO, parseAmount, toDate, uid } from './utils';

/* ───────────────────────── JSON backup ───────────────────────── */

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataURLToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

export async function exportBackup(): Promise<void> {
  const data: Record<string, unknown[]> = {};
  for (const t of DATA_TABLES) {
    const rows: any[] = await (db as any)[t].toArray();
    if (t === 'documents') {
      data[t] = await Promise.all(
        rows.map(async (d) => (d.blob ? { ...d, blob: undefined, blobData: await blobToDataURL(d.blob) } : d)),
      );
    } else data[t] = rows;
  }
  const settings = await getSettings();
  const payload = { app: 'pursuit', version: 1, exportedAt: nowISO(), settings, data };
  downloadFile(`pursuit-backup-${format(new Date(), 'yyyy-MM-dd')}.json`, JSON.stringify(payload, null, 2), 'application/json');
  await updateSettings({ lastBackupAt: nowISO() });
}

export async function importBackup(file: File, mode: 'replace' | 'merge'): Promise<number> {
  const payload = JSON.parse(await file.text());
  if (payload?.app !== 'pursuit' || typeof payload.data !== 'object') throw new Error('This is not a Pursuit backup file.');
  // Convert blobs before opening the transaction (non-Dexie awaits would commit it early).
  const prepared: Record<string, any[]> = {};
  let total = 0;
  for (const t of DATA_TABLES) {
    const rows: any[] = Array.isArray(payload.data[t]) ? payload.data[t] : [];
    if (t === 'documents') {
      prepared[t] = await Promise.all(
        rows.map(async ({ blobData, ...d }) => (blobData ? { ...d, blob: await dataURLToBlob(blobData) } : d)),
      );
    } else prepared[t] = rows;
    total += rows.length;
  }
  await db.transaction('rw', [...DATA_TABLES.map((t) => (db as any)[t]), db.kv], async () => {
    if (mode === 'replace') for (const t of DATA_TABLES) await (db as any)[t].clear();
    for (const t of DATA_TABLES) if (prepared[t].length) await (db as any)[t].bulkPut(prepared[t]);
    if (payload.settings && mode === 'replace') await db.kv.put({ key: 'settings', value: mergeSettings({ ...payload.settings, onboarded: true }) });
    await db.kv.put({ key: 'builtinsSeeded', value: true });
  });
  return total;
}

/* ───────────────────────── CSV ───────────────────────── */

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV<T>(rows: T[], columns: { label: string; get: (r: T) => unknown }[]): string {
  const head = columns.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(c.get(r))).join(',')).join('\r\n');
  return `${head}\r\n${body}`;
}

const d = (iso?: string) => (iso ? format(new Date(iso), 'yyyy-MM-dd') : '');

export function exportApplicationsCSV(apps: Application[]): void {
  const csv = toCSV(apps, [
    { label: 'Company', get: (a) => a.company },
    { label: 'Role', get: (a) => a.role },
    { label: 'Status', get: (a) => STAGE_MAP[a.status].label },
    { label: 'Platform', get: (a) => platformMeta(a.platform).label },
    { label: 'Method', get: (a) => METHOD_MAP[a.method]?.label ?? a.method },
    { label: 'Location', get: (a) => a.location },
    { label: 'Work mode', get: (a) => a.workMode },
    { label: 'Applied', get: (a) => d(a.appliedAt) },
    { label: 'First response', get: (a) => d(a.respondedAt) },
    { label: 'Salary min', get: (a) => a.salaryMin },
    { label: 'Salary max', get: (a) => a.salaryMax },
    { label: 'Currency', get: (a) => a.currency },
    { label: 'Priority', get: (a) => a.priority },
    { label: 'Job URL', get: (a) => a.url },
    { label: 'Next action', get: (a) => a.nextAction },
    { label: 'Next action date', get: (a) => d(a.nextActionAt) },
    { label: 'Rejection reason', get: (a) => a.rejectionReason },
    { label: 'Tags', get: (a) => a.tags },
    { label: 'Notes', get: (a) => a.notes },
  ]);
  downloadFile(`pursuit-applications-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv, 'text/csv');
}

export function exportContactsCSV(contacts: Contact[]): void {
  const csv = toCSV(contacts, [
    { label: 'Name', get: (c) => c.name },
    { label: 'Title', get: (c) => c.title },
    { label: 'Company', get: (c) => c.company },
    { label: 'Relationship', get: (c) => RELATIONSHIP_MAP[c.relationship]?.label },
    { label: 'Stage', get: (c) => CONTACT_STAGE_MAP[c.stage]?.label },
    { label: 'Warmth', get: (c) => c.warmth },
    { label: 'Email', get: (c) => c.email },
    { label: 'Phone', get: (c) => c.phone },
    { label: 'LinkedIn', get: (c) => c.linkedin },
    { label: 'Last contacted', get: (c) => d(c.lastContactedAt) },
    { label: 'Next follow-up', get: (c) => d(c.nextFollowUpAt) },
    { label: 'Tags', get: (c) => c.tags },
    { label: 'Notes', get: (c) => c.notes },
  ]);
  downloadFile(`pursuit-contacts-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv, 'text/csv');
}

/* ───────────────────────── Spreadsheet import ───────────────────────── */

export interface ImportField {
  key: 'company' | 'role' | 'status' | 'platform' | 'appliedAt' | 'url' | 'location' | 'salary' | 'notes';
  label: string;
  required?: boolean;
  aliases: string[];
}

export const APP_IMPORT_FIELDS: ImportField[] = [
  { key: 'company', label: 'Company', required: true, aliases: ['company', 'company name', 'organization', 'organisation', 'employer'] },
  { key: 'role', label: 'Role / title', required: true, aliases: ['role', 'title', 'job title', 'position', 'job', 'designation'] },
  { key: 'status', label: 'Status', aliases: ['status', 'stage', 'result', 'outcome'] },
  { key: 'platform', label: 'Platform / source', aliases: ['platform', 'source', 'job board', 'site', 'portal', 'where', 'applied via', 'applied through'] },
  { key: 'appliedAt', label: 'Date applied', aliases: ['applied', 'date applied', 'applied on', 'date', 'application date', 'applied date'] },
  { key: 'url', label: 'Job URL', aliases: ['url', 'link', 'job link', 'job url', 'posting', 'job posting'] },
  { key: 'location', label: 'Location', aliases: ['location', 'city', 'place'] },
  { key: 'salary', label: 'Salary', aliases: ['salary', 'ctc', 'compensation', 'pay', 'package'] },
  { key: 'notes', label: 'Notes', aliases: ['notes', 'note', 'comments', 'comment', 'remarks'] },
];

export function guessMapping(headers: string[]): Record<ImportField['key'], number> {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const out = {} as Record<ImportField['key'], number>;
  const used = new Set<number>();
  for (const f of APP_IMPORT_FIELDS) {
    let idx = norm.findIndex((h, i) => !used.has(i) && f.aliases.includes(h));
    if (idx < 0) idx = norm.findIndex((h, i) => !used.has(i) && f.aliases.some((a) => h.includes(a)));
    out[f.key] = idx;
    if (idx >= 0) used.add(idx);
  }
  return out;
}

export function mapStatus(s: string | undefined): Stage {
  const v = (s ?? '').toLowerCase();
  if (!v) return 'applied';
  if (/(wish|saved|interested|to apply|bookmark|planned)/.test(v)) return 'wishlist';
  if (/(accept|joined|signed)/.test(v)) return 'accepted';
  if (/offer/.test(v)) return 'offer';
  if (/(reject|declin|not selected|unsuccessful|regret)/.test(v)) return 'rejected';
  if (/(ghost|no response|no reply)/.test(v)) return 'ghosted';
  if (/withdr/.test(v)) return 'withdrawn';
  if (/(interview|round|onsite|panel|technical)/.test(v)) return 'interviewing';
  if (/(assess|test|assignment|take.?home|challenge)/.test(v)) return 'assessment';
  if (/(screen|hr|recruiter|call|shortlist)/.test(v)) return 'screening';
  return 'applied';
}

export function mapPlatform(s: string | undefined): string {
  const v = (s ?? '').toLowerCase().trim();
  if (!v) return 'other';
  for (const p of PLATFORMS) {
    if (v === p.id || v.includes(p.label.toLowerCase()) || p.domains.some((dm) => v.includes(dm.split('.')[0]))) return p.id;
  }
  if (/refer/.test(v)) return 'referral';
  if (/(career|company|website|direct)/.test(v)) return 'company_site';
  if (/twitter|\bx\b/.test(v)) return 'twitter';
  return 'other';
}

export function parseLooseDate(s: string | undefined, dayFirst = true): string | undefined {
  const v = (s ?? '').trim();
  if (!v) return undefined;
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    let a = Number(m[1]);
    let b = Number(m[2]);
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    let day = dayFirst ? a : b;
    let month = dayFirst ? b : a;
    if (month > 12 && day <= 12) [day, month] = [month, day];
    const dt = new Date(y, month - 1, day, 9);
    return isNaN(dt.getTime()) ? undefined : dt.toISOString();
  }
  const dt = new Date(v);
  return isNaN(dt.getTime()) ? undefined : dt.toISOString();
}

export async function importApplicationRows(
  rows: string[][],
  mapping: Record<ImportField['key'], number>,
  opts: { dayFirst: boolean },
): Promise<number> {
  let n = 0;
  const cell = (r: string[], k: ImportField['key']) => (mapping[k] >= 0 ? (r[mapping[k]] ?? '').trim() : '');
  for (const r of rows) {
    const company = cell(r, 'company');
    const role = cell(r, 'role');
    if (!company && !role) continue;
    const salaryRaw = cell(r, 'salary');
    const parts = salaryRaw.split(/\s*(?:-|–|to)\s*/i);
    await createApplication({
      company,
      role,
      status: mapStatus(cell(r, 'status')),
      platform: mapPlatform(cell(r, 'platform')),
      appliedAt: parseLooseDate(cell(r, 'appliedAt'), opts.dayFirst),
      url: cell(r, 'url') || undefined,
      location: cell(r, 'location') || undefined,
      salaryMin: parseAmount(parts[0]),
      salaryMax: parseAmount(parts[1] ?? parts[0]),
      notes: cell(r, 'notes') || undefined,
      tags: ['imported'],
    });
    n++;
  }
  return n;
}

/* ───────────────────────── LinkedIn connections import ───────────────────────── */

export function guessRelationship(title: string | undefined): Relationship {
  const t = (title ?? '').toLowerCase();
  if (/(recruit|talent|\bhr\b|human resources|people partner|sourcer)/.test(t)) return 'recruiter';
  if (/(founder|\bceo\b|\bcto\b|co-founder)/.test(t)) return 'founder';
  if (/(\bvp\b|vice president|director|chief|head of)/.test(t)) return 'leader';
  if (/(manager|\blead\b)/.test(t)) return 'hiring_manager';
  return 'employee';
}

const normLinkedIn = (u?: string) => (u ?? '').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/+$/, '');

export async function importLinkedInConnections(text: string): Promise<{ added: number; skipped: number }> {
  const rows = parseCSV(text);
  const headerIdx = rows.findIndex((r) => r.some((c) => /^first name$/i.test(c.trim())));
  if (headerIdx < 0) throw new Error('Could not find the header row. Use the “Connections.csv” file from your LinkedIn data export.');
  const header = rows[headerIdx].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const [fi, li, ui, ei, ci, pi, oi] = ['first name', 'last name', 'url', 'email address', 'company', 'position', 'connected on'].map(col);
  const existing = new Set((await db.contacts.toArray()).map((c) => normLinkedIn(c.linkedin)).filter(Boolean));
  const now = nowISO();
  const toAdd: Contact[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerIdx + 1)) {
    const name = `${(r[fi] ?? '').trim()} ${(r[li] ?? '').trim()}`.trim();
    const url = (r[ui] ?? '').trim();
    if (!name || (url && existing.has(normLinkedIn(url)))) {
      skipped++;
      continue;
    }
    if (url) existing.add(normLinkedIn(url));
    const connected = toDate(new Date(r[oi] ?? '').toString() === 'Invalid Date' ? undefined : new Date(r[oi]).toISOString());
    toAdd.push({
      id: uid(),
      name,
      title: (r[pi] ?? '').trim() || undefined,
      company: (r[ci] ?? '').trim() || undefined,
      linkedin: url || undefined,
      email: (r[ei] ?? '').trim() || undefined,
      relationship: guessRelationship(r[pi]),
      stage: 'network',
      warmth: 'warm',
      priority: 2,
      source: 'LinkedIn connection',
      tags: ['linkedin-import'],
      applicationIds: [],
      connectedOn: connected?.toISOString(),
      createdAt: now,
      updatedAt: now,
    });
  }
  if (toAdd.length) await db.contacts.bulkAdd(toAdd);
  return { added: toAdd.length, skipped };
}

/* ───────────────────────── Calendar ───────────────────────── */

const icsDate = (dt: Date) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function vevent(iv: Interview, app: Application | undefined): string[] {
  const start = new Date(iv.scheduledAt);
  const end = new Date(start.getTime() + (iv.durationMins || 45) * 60000);
  const title = `${iv.round} — ${app?.company ?? 'Interview'}${app ? ` (${app.role})` : ''}`;
  const desc = [
    `${INTERVIEW_TYPE_LABEL[iv.type]} · ${iv.mode}`,
    iv.interviewers ? `Interviewers: ${iv.interviewers}` : '',
    iv.prepNotes ? `Prep: ${iv.prepNotes}` : '',
    app?.url ? `Job: ${app.url}` : '',
    'Tracked in Pursuit',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    'BEGIN:VEVENT',
    `UID:${iv.id}@pursuit.app`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    iv.location ? `LOCATION:${icsEscape(iv.location)}` : '',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Interview in 30 minutes',
    'END:VALARM',
    'END:VEVENT',
  ].filter(Boolean);
}

export function downloadICS(items: { iv: Interview; app?: Application }[], name = 'interviews'): void {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Pursuit//Job Search OS//EN', 'CALSCALE:GREGORIAN', ...items.flatMap((x) => vevent(x.iv, x.app)), 'END:VCALENDAR'];
  downloadFile(`${name}.ics`, lines.join('\r\n'), 'text/calendar');
}

export function googleCalendarUrl(iv: Interview, app?: Application): string {
  const start = new Date(iv.scheduledAt);
  const end = new Date(start.getTime() + (iv.durationMins || 45) * 60000);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${iv.round} — ${app?.company ?? 'Interview'}`,
    dates: `${icsDate(start)}/${icsDate(end)}`,
    details: [app?.role, iv.interviewers ? `Interviewers: ${iv.interviewers}` : '', iv.location].filter(Boolean).join('\n'),
    location: iv.location ?? '',
  });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
