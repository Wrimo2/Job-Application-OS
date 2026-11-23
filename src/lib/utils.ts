import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  addDays,
  differenceInCalendarDays,
  format,
  isThisYear,
  isToday,
  isTomorrow,
  isValid,
  isYesterday,
  parseISO,
  startOfDay,
} from 'date-fns';
import { CURRENCIES } from './constants';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const nowISO = () => new Date().toISOString();

/* ───────────────────────── Dates ───────────────────────── */

export function toDate(v: string | Date | undefined | null): Date | null {
  if (!v) return null;
  const d = typeof v === 'string' ? parseISO(v) : v;
  return isValid(d) ? d : null;
}

/** Days from `a` to `b` in calendar days (b - a). */
export function daysBetween(a: string | Date, b: string | Date = new Date()): number {
  const da = toDate(a);
  const db = toDate(b);
  if (!da || !db) return 0;
  return differenceInCalendarDays(db, da);
}

export function addDaysISO(base: string | Date | undefined, days: number): string {
  const d = toDate(base ?? new Date()) ?? new Date();
  return addDays(d, days).toISOString();
}

/** Due date at 9:00 local time `days` from today. */
export function dueInDays(days: number, from: Date = new Date()): string {
  const d = startOfDay(addDays(from, days));
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function fmtDate(v: string | Date | undefined | null, pattern?: string): string {
  const d = toDate(v);
  if (!d) return '—';
  return format(d, pattern ?? (isThisYear(d) ? 'd MMM' : 'd MMM yyyy'));
}

export function fmtDateTime(v: string | Date | undefined | null): string {
  const d = toDate(v);
  if (!d) return '—';
  return format(d, isThisYear(d) ? 'EEE, d MMM · h:mm a' : 'd MMM yyyy · h:mm a');
}

export function fmtTime(v: string | Date | undefined | null): string {
  const d = toDate(v);
  return d ? format(d, 'h:mm a') : '';
}

/** "today", "yesterday", "3d ago", "in 2d", "tomorrow" */
export function relDay(v: string | Date | undefined | null): string {
  const d = toDate(v);
  if (!d) return '—';
  if (isToday(d)) return 'today';
  if (isYesterday(d)) return 'yesterday';
  if (isTomorrow(d)) return 'tomorrow';
  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0) {
    const n = -diff;
    if (n < 14) return `${n}d ago`;
    if (n < 60) return `${Math.round(n / 7)}w ago`;
    return `${Math.round(n / 30)}mo ago`;
  }
  if (diff < 14) return `in ${diff}d`;
  if (diff < 60) return `in ${Math.round(diff / 7)}w`;
  return `in ${Math.round(diff / 30)}mo`;
}

export function dueTone(v: string | undefined | null): 'overdue' | 'today' | 'soon' | 'later' | 'none' {
  const d = toDate(v);
  if (!d) return 'none';
  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 2) return 'soon';
  return 'later';
}

/** yyyy-MM-dd in local time for <input type="date"> */
export function toDateInput(v: string | undefined | null): string {
  const d = toDate(v);
  return d ? format(d, 'yyyy-MM-dd') : '';
}

export function fromDateInput(v: string): string | undefined {
  if (!v) return undefined;
  const [y, m, d] = v.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 9, 0, 0).toISOString();
}

export function toDateTimeInput(v: string | undefined | null): string {
  const d = toDate(v);
  return d ? format(d, "yyyy-MM-dd'T'HH:mm") : '';
}

export function fromDateTimeInput(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isValid(d) ? d.toISOString() : undefined;
}

export const dayKey = (d: Date | string) => format(typeof d === 'string' ? parseISO(d) : d, 'yyyy-MM-dd');

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return 'Burning the midnight oil';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ───────────────────────── Money ───────────────────────── */

/**
 * Parses human salary input: "18L", "18 LPA", "1.2cr", "120k", "$120,000", "85000".
 * Returns an absolute annual amount.
 */
export function parseAmount(input: string | number | undefined | null): number | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input === 'number') return Number.isFinite(input) ? input : undefined;
  const s = input.toLowerCase().replace(/[,₹$€£\s]|inr|usd|eur|gbp|aed|sgd|cad|aud|\/yr|per annum|pa\b/g, '').trim();
  if (!s) return undefined;
  const m = s.match(/^(\d+(?:\.\d+)?)(k|m|mn|l|lpa|lac|lakh|lakhs|cr|crore|crores)?$/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  const unit = m[2];
  const mult =
    unit === 'k' ? 1e3 : unit === 'm' || unit === 'mn' ? 1e6 : unit && unit.startsWith('l') ? 1e5 : unit && unit.startsWith('cr') ? 1e7 : 1;
  return Math.round(n * mult);
}

export function currencySymbol(code = 'INR'): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? `${code} `;
}

/** Compact money: ₹18L, ₹1.2Cr, $120k, $1.5M */
export function formatMoney(n: number | undefined | null, currency = 'INR', opts: { compact?: boolean } = {}): string {
  if (n === undefined || n === null || !Number.isFinite(n)) return '—';
  const sym = currencySymbol(currency);
  const compact = opts.compact ?? true;
  if (!compact) {
    return sym + new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { maximumFractionDigits: 0 }).format(n);
  }
  const trim = (x: number) => (Math.round(x * 100) / 100).toString().replace(/\.0+$/, '');
  if (currency === 'INR') {
    if (Math.abs(n) >= 1e7) return `${sym}${trim(n / 1e7)}Cr`;
    if (Math.abs(n) >= 1e5) return `${sym}${trim(n / 1e5)}L`;
    if (Math.abs(n) >= 1e3) return `${sym}${trim(n / 1e3)}k`;
    return `${sym}${trim(n)}`;
  }
  if (Math.abs(n) >= 1e6) return `${sym}${trim(n / 1e6)}M`;
  if (Math.abs(n) >= 1e3) return `${sym}${trim(n / 1e3)}k`;
  return `${sym}${trim(n)}`;
}

export function formatSalaryRange(min?: number, max?: number, currency = 'INR'): string {
  if (!min && !max) return '';
  if (min && max && min !== max) {
    const a = formatMoney(min, currency);
    const b = formatMoney(max, currency);
    const sym = currencySymbol(currency);
    return `${a}–${b.startsWith(sym) ? b.slice(sym.length) : b}`;
  }
  return formatMoney(min || max, currency);
}

/* ───────────────────────── Numbers ───────────────────────── */

export function pct(num: number, den: number): number | null {
  if (!den) return null;
  return (num / den) * 100;
}

export function fmtPct(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}

export function compactNumber(n: number): string {
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1e4) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return new Intl.NumberFormat('en-US').format(n);
}

export const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
export const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
export function percentile(xs: number[], p: number): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}
export const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/* ───────────────────────── Strings ───────────────────────── */

export function initials(name: string | undefined): string {
  if (!name) return '?';
  const parts = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const firstName = (name: string | undefined) => (name ?? '').trim().split(/\s+/)[0] ?? '';
export const lastName = (name: string | undefined) => {
  const p = (name ?? '').trim().split(/\s+/);
  return p.length > 1 ? p[p.length - 1] : '';
};

export function titleCase(s: string): string {
  return s
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1));
}

export function truncate(s: string | undefined, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

export function plural(n: number, word: string, pluralWord?: string): string {
  return `${n} ${n === 1 ? word : pluralWord ?? word + 's'}`;
}

export function companyKey(name: string | undefined): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\b(inc|ltd|llc|pvt|private|limited|corp|corporation|technologies|technology|labs)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const PALETTE = [
  'from-indigo-500 to-violet-500',
  'from-sky-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
  'from-fuchsia-500 to-purple-600',
  'from-cyan-500 to-sky-600',
  'from-lime-500 to-green-600',
  'from-orange-500 to-red-500',
  'from-violet-500 to-indigo-600',
];

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export const gradientFor = (s: string) => PALETTE[hashString(s.toLowerCase()) % PALETTE.length];

/* ───────────────────────── URLs ───────────────────────── */

export function normalizeUrl(u: string | undefined): string | undefined {
  if (!u) return undefined;
  const t = u.trim();
  if (!t) return undefined;
  if (/^(https?:|mailto:|tel:)/i.test(t)) return t;
  return `https://${t}`;
}

export function hostOf(u: string | undefined): string {
  if (!u) return '';
  try {
    return new URL(normalizeUrl(u)!).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Registrable-ish domain: jobs.lever.co → lever.co, careers.razorpay.com → razorpay.com */
export function rootDomain(u: string | undefined): string {
  const h = hostOf(u);
  if (!h) return '';
  const parts = h.split('.');
  if (parts.length <= 2) return h;
  const twoLevelTlds = ['co.in', 'co.uk', 'com.au', 'co.jp', 'com.sg', 'org.in', 'net.in', 'ac.in'];
  const last2 = parts.slice(-2).join('.');
  if (twoLevelTlds.includes(last2)) return parts.slice(-3).join('.');
  return last2;
}

/* ───────────────────────── Browser helpers ───────────────────────── */

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadFile(name: string, content: BlobPart | Blob, mime = 'text/plain'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function openUrl(url: string | undefined): void {
  const u = normalizeUrl(url);
  if (u) window.open(u, '_blank', 'noopener,noreferrer');
}

export function groupBy<T, K extends string>(items: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const it of items) {
    const k = key(it);
    (out[k] ||= []).push(it);
  }
  return out;
}

export function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

export function bytes(n: number | undefined): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = isMac ? '⌘' : 'Ctrl';
