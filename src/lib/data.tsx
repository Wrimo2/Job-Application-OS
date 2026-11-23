import * as React from 'react';
import { createContext, useContext, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { buildAgenda, type AgendaItem } from './stats';
import { useNow } from './hooks';
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
  Snippet,
  StarStory,
  Task,
  Template,
} from './types';

export interface AppData {
  loaded: boolean;
  apps: Application[];
  interviews: Interview[];
  contacts: Contact[];
  interactions: Interaction[];
  templates: Template[];
  sequences: Sequence[];
  enrollments: Enrollment[];
  tasks: Task[];
  companies: Company[];
  documents: DocumentFile[];
  snippets: Snippet[];
  stories: StarStory[];
  questions: Question[];
  offers: Offer[];
  agenda: AgendaItem[];
  now: Date;
}

const E: never[] = [];

const DataContext = createContext<AppData | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const apps = useLiveQuery(() => db.applications.toArray(), []);
  const interviews = useLiveQuery(() => db.interviews.toArray(), []);
  const contacts = useLiveQuery(() => db.contacts.toArray(), []);
  const interactions = useLiveQuery(() => db.interactions.toArray(), []);
  const templates = useLiveQuery(() => db.templates.toArray(), []);
  const sequences = useLiveQuery(() => db.sequences.toArray(), []);
  const enrollments = useLiveQuery(() => db.enrollments.toArray(), []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const companies = useLiveQuery(() => db.companies.toArray(), []);
  const documents = useLiveQuery(() => db.documents.toArray(), []);
  const snippets = useLiveQuery(() => db.snippets.toArray(), []);
  const stories = useLiveQuery(() => db.stories.toArray(), []);
  const questions = useLiveQuery(() => db.questions.toArray(), []);
  const offers = useLiveQuery(() => db.offers.toArray(), []);
  const now = useNow(60_000);

  const agenda = useMemo(
    () =>
      buildAgenda(
        {
          apps: apps ?? E,
          contacts: contacts ?? E,
          enrollments: enrollments ?? E,
          sequences: sequences ?? E,
          tasks: tasks ?? E,
          interviews: interviews ?? E,
        },
        now,
      ),
    [apps, contacts, enrollments, sequences, tasks, interviews, now],
  );

  const value = useMemo<AppData>(
    () => ({
      loaded: apps !== undefined && contacts !== undefined && templates !== undefined,
      apps: apps ?? E,
      interviews: interviews ?? E,
      contacts: contacts ?? E,
      interactions: interactions ?? E,
      templates: templates ?? E,
      sequences: sequences ?? E,
      enrollments: enrollments ?? E,
      tasks: tasks ?? E,
      companies: companies ?? E,
      documents: documents ?? E,
      snippets: snippets ?? E,
      stories: stories ?? E,
      questions: questions ?? E,
      offers: offers ?? E,
      agenda,
      now,
    }),
    [apps, interviews, contacts, interactions, templates, sequences, enrollments, tasks, companies, documents, snippets, stories, questions, offers, agenda, now],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): AppData {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}

export function useDueCounts() {
  const { agenda } = useData();
  return useMemo(() => {
    const overdue = agenda.filter((a) => a.bucket === 'overdue').length;
    const today = agenda.filter((a) => a.bucket === 'today').length;
    const outreach = agenda.filter((a) => (a.kind === 'sequence' || a.kind === 'contact') && (a.bucket === 'overdue' || a.bucket === 'today')).length;
    return { overdue, today, due: overdue + today, outreach };
  }, [agenda]);
}
