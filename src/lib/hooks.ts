import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, DEFAULT_SETTINGS, mergeSettings } from './db';
import type {
  Application,
  Company,
  Contact,
  DocumentFile,
  Enrollment,
  Interaction,
  Interview,
  Offer,
  Question,
  Sequence,
  Settings,
  Snippet,
  StarStory,
  Task,
  Template,
} from './types';

const EMPTY: never[] = [];

export const useApplications = () => useLiveQuery(() => db.applications.toArray(), []) ?? (EMPTY as Application[]);
export const useInterviews = () => useLiveQuery(() => db.interviews.toArray(), []) ?? (EMPTY as Interview[]);
export const useContacts = () => useLiveQuery(() => db.contacts.toArray(), []) ?? (EMPTY as Contact[]);
export const useInteractions = () => useLiveQuery(() => db.interactions.toArray(), []) ?? (EMPTY as Interaction[]);
export const useTemplates = () => useLiveQuery(() => db.templates.toArray(), []) ?? (EMPTY as Template[]);
export const useSequences = () => useLiveQuery(() => db.sequences.toArray(), []) ?? (EMPTY as Sequence[]);
export const useEnrollments = () => useLiveQuery(() => db.enrollments.toArray(), []) ?? (EMPTY as Enrollment[]);
export const useTasks = () => useLiveQuery(() => db.tasks.toArray(), []) ?? (EMPTY as Task[]);
export const useCompanies = () => useLiveQuery(() => db.companies.toArray(), []) ?? (EMPTY as Company[]);
export const useDocuments = () => useLiveQuery(() => db.documents.toArray(), []) ?? (EMPTY as DocumentFile[]);
export const useSnippets = () => useLiveQuery(() => db.snippets.toArray(), []) ?? (EMPTY as Snippet[]);
export const useStories = () => useLiveQuery(() => db.stories.toArray(), []) ?? (EMPTY as StarStory[]);
export const useQuestions = () => useLiveQuery(() => db.questions.toArray(), []) ?? (EMPTY as Question[]);
export const useOffers = () => useLiveQuery(() => db.offers.toArray(), []) ?? (EMPTY as Offer[]);

export const useApplication = (id: string | undefined) =>
  useLiveQuery(() => (id ? db.applications.get(id) : undefined), [id]);
export const useContact = (id: string | undefined) => useLiveQuery(() => (id ? db.contacts.get(id) : undefined), [id]);

/** Loads settings; `undefined` while loading. */
export function useSettingsQuery(): Settings | undefined {
  const row = useLiveQuery(() => db.kv.get('settings').then((r) => r ?? null), []);
  return useMemo(() => (row === undefined ? undefined : mergeSettings(row?.value as Partial<Settings> | undefined)), [row]);
}

export const SettingsContext = createContext<Settings>(DEFAULT_SETTINGS);
export const useSettings = () => useContext(SettingsContext);

/* ───────────────────────── UI helpers ───────────────────────── */

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const on = () => setMatches(mql.matches);
    on();
    mql.addEventListener('change', on);
    return () => mql.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export function useResolvedTheme(pref: Settings['theme']): 'light' | 'dark' {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)');
  return pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;
}

/** Per-viewer UI preference persisted in localStorage (falls back to memory). */
export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(`pursuit.ui.${key}`);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setVal(v);
      try {
        localStorage.setItem(`pursuit.ui.${key}`, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    [key],
  );
  return [val, set];
}

export function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Re-render every `ms` so relative times stay fresh. */
export function useNow(ms = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function isTyping(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Global keyboard shortcuts. Keys: "mod+k", "n", "?", "g d" (sequence).
 */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true): void {
  const ref = useRef(map);
  ref.current = map;
  useEffect(() => {
    if (!enabled) return;
    let pending: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const mod = e.metaKey || e.ctrlKey;
      if (mod && ref.current[`mod+${key}`]) {
        e.preventDefault();
        ref.current[`mod+${key}`](e);
        return;
      }
      if (mod || e.altKey || isTyping(e)) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (pending) {
        const combo = `${pending} ${key}`;
        pending = null;
        if (timer) clearTimeout(timer);
        if (ref.current[combo]) {
          e.preventDefault();
          ref.current[combo](e);
        }
        return;
      }
      if (Object.keys(ref.current).some((k) => k.startsWith(`${key} `))) {
        pending = key;
        timer = setTimeout(() => (pending = null), 900);
        return;
      }
      const k = e.key === '?' ? '?' : key;
      if (ref.current[k]) {
        e.preventDefault();
        ref.current[k](e);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled]);
}
