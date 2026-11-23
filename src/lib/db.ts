import Dexie, { type EntityTable } from 'dexie';
import type {
  Application,
  Company,
  Contact,
  DocumentFile,
  Enrollment,
  Interaction,
  Interview,
  KV,
  Offer,
  Question,
  Sequence,
  Settings,
  Snippet,
  StarStory,
  Task,
  Template,
} from './types';

export class PursuitDB extends Dexie {
  applications!: EntityTable<Application, 'id'>;
  interviews!: EntityTable<Interview, 'id'>;
  contacts!: EntityTable<Contact, 'id'>;
  interactions!: EntityTable<Interaction, 'id'>;
  templates!: EntityTable<Template, 'id'>;
  sequences!: EntityTable<Sequence, 'id'>;
  enrollments!: EntityTable<Enrollment, 'id'>;
  tasks!: EntityTable<Task, 'id'>;
  companies!: EntityTable<Company, 'id'>;
  documents!: EntityTable<DocumentFile, 'id'>;
  snippets!: EntityTable<Snippet, 'id'>;
  stories!: EntityTable<StarStory, 'id'>;
  questions!: EntityTable<Question, 'id'>;
  offers!: EntityTable<Offer, 'id'>;
  kv!: EntityTable<KV, 'key'>;

  constructor() {
    super('pursuit-job-search');
    // Note: booleans are not valid IndexedDB keys, so boolean flags are filtered in memory.
    this.version(1).stores({
      applications: 'id, status, platform, company, appliedAt, nextActionAt, updatedAt, createdAt',
      interviews: 'id, applicationId, scheduledAt',
      contacts: 'id, stage, company, nextFollowUpAt, lastContactedAt, updatedAt, linkedin',
      interactions: 'id, contactId, applicationId, date, templateId, enrollmentId',
      templates: 'id, category, updatedAt',
      sequences: 'id, updatedAt',
      enrollments: 'id, contactId, sequenceId, status, nextDueAt',
      tasks: 'id, dueAt, applicationId, contactId',
      companies: 'id, name, tier',
      documents: 'id, kind, createdAt',
      snippets: 'id, updatedAt',
      stories: 'id, updatedAt',
      questions: 'id, applicationId, category, createdAt',
      offers: 'id, applicationId',
      kv: 'key',
    });
  }
}

export const db = new PursuitDB();

export const DATA_TABLES = [
  'applications',
  'interviews',
  'contacts',
  'interactions',
  'templates',
  'sequences',
  'enrollments',
  'tasks',
  'companies',
  'documents',
  'snippets',
  'stories',
  'questions',
  'offers',
] as const;
export type DataTable = (typeof DATA_TABLES)[number];

/* ───────────────────────── Settings ───────────────────────── */

export const DEFAULT_SETTINGS: Settings = {
  profile: {
    name: '',
    headline: '',
    currentRole: '',
    currentCompany: '',
    experienceYears: undefined,
    skills: [],
    targetRoles: [],
    targetLocations: [],
    linkedin: '',
    github: '',
    portfolio: '',
    email: '',
    phone: '',
    school: '',
    pitch: '',
    achievement: '',
    noticePeriod: '',
    currentCtc: '',
    expectedCtc: '',
    resumeText: '',
  },
  goals: { applicationsPerWeek: 10, outreachPerWeek: 25, dailyOutreach: 5 },
  followUpDays: 7,
  ghostDays: 21,
  staleWishlistDays: 5,
  currency: 'INR',
  theme: 'system',
  accent: 'indigo',
  showLogos: true,
  notifications: false,
  customPlatforms: [],
  onboarded: false,
  weekStartsOn: 1,
};

export function mergeSettings(v: Partial<Settings> | undefined | null): Settings {
  const s = (v ?? {}) as Partial<Settings>;
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    profile: { ...DEFAULT_SETTINGS.profile, ...(s.profile ?? {}) },
    goals: { ...DEFAULT_SETTINGS.goals, ...(s.goals ?? {}) },
  };
}

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return mergeSettings(row?.value as Partial<Settings> | undefined);
}

export type SettingsPatch = Omit<Partial<Settings>, 'profile' | 'goals'> & {
  profile?: Partial<Settings['profile']>;
  goals?: Partial<Settings['goals']>;
};

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  const cur = await getSettings();
  const next: Settings = {
    ...cur,
    ...patch,
    profile: { ...cur.profile, ...(patch.profile ?? {}) },
    goals: { ...cur.goals, ...(patch.goals ?? {}) },
  };
  await db.kv.put({ key: 'settings', value: next });
  try {
    localStorage.setItem('pursuit.theme', next.theme);
    localStorage.setItem('pursuit.accent', next.accent);
  } catch {
    /* ignore */
  }
  return next;
}
