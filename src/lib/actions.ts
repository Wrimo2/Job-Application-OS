import { db, DATA_TABLES, getSettings, updateSettings } from './db';
import { CLOSED_STAGES, DEFAULT_CHECKLIST, INTERACTION_KINDS, STAGE_RANK } from './constants';
import { defaultSequences, defaultTemplates } from './outreach';
import type {
  Application,
  Company,
  Contact,
  Enrollment,
  EnrollmentStatus,
  ID,
  Interaction,
  InteractionKind,
  Interview,
  Offer,
  Question,
  Sequence,
  Snippet,
  Stage,
  StarStory,
  Task,
  Template,
  DocumentFile,
} from './types';
import { addDaysISO, companyKey, dueInDays, nowISO, uid } from './utils';

/* ───────────────────────── Bootstrapping ───────────────────────── */

export async function ensureBuiltIns(): Promise<void> {
  const seeded = await db.kv.get('builtinsSeeded');
  if (seeded) return;
  const now = nowISO();
  await db.transaction('rw', db.templates, db.sequences, db.kv, async () => {
    await db.templates.bulkPut(defaultTemplates(now));
    await db.sequences.bulkPut(defaultSequences(now));
    await db.kv.put({ key: 'builtinsSeeded', value: true });
  });
}

export async function restoreDefaultTemplates(): Promise<void> {
  const now = nowISO();
  await db.templates.bulkPut(defaultTemplates(now));
  await db.sequences.bulkPut(defaultSequences(now));
}

/* ───────────────────────── Companies ───────────────────────── */

export async function ensureCompany(name?: string, extra?: Partial<Company>): Promise<ID | undefined> {
  const key = companyKey(name);
  if (!key) return undefined;
  const existing = await db.companies.filter((c) => companyKey(c.name) === key).first();
  if (existing) {
    if (extra && Object.keys(extra).length) {
      const patch: Partial<Company> = {};
      for (const [k, v] of Object.entries(extra)) if (v && !(existing as any)[k]) (patch as any)[k] = v;
      if (Object.keys(patch).length) await db.companies.update(existing.id, { ...patch, updatedAt: nowISO() });
    }
    return existing.id;
  }
  const now = nowISO();
  const c: Company = { id: uid(), name: name!.trim(), tier: 'none', tags: [], createdAt: now, updatedAt: now, ...extra };
  await db.companies.add(c);
  return c.id;
}

export async function saveCompany(input: Partial<Company>, id?: ID): Promise<ID> {
  const now = nowISO();
  if (id) {
    await db.companies.update(id, { ...input, updatedAt: now });
    return id;
  }
  const c: Company = { id: uid(), name: (input.name ?? '').trim() || 'Untitled', tier: 'none', tags: [], createdAt: now, updatedAt: now, ...input } as Company;
  await db.companies.add(c);
  return c.id;
}

export async function deleteCompany(id: ID): Promise<() => Promise<void>> {
  const c = await db.companies.get(id);
  await db.companies.delete(id);
  return async () => {
    if (c) await db.companies.put(c);
  };
}

/* ───────────────────────── Applications ───────────────────────── */

const RESPONSE_STAGES: Stage[] = ['screening', 'assessment', 'interviewing', 'offer', 'accepted', 'rejected'];

export async function createApplication(input: Partial<Application>): Promise<Application> {
  const s = await getSettings();
  const now = nowISO();
  const status: Stage = input.status ?? 'applied';
  const appliedAt = input.appliedAt ?? (status !== 'wishlist' ? now : undefined);
  const history: Application['history'] = [];
  if (status === 'wishlist') history.push({ stage: 'wishlist', at: now });
  else {
    history.push({ stage: 'applied', at: appliedAt ?? now });
    if (status !== 'applied') history.push({ stage: status, at: now });
  }
  const app: Application = {
    id: uid(),
    platform: 'linkedin',
    method: 'easy_apply',
    priority: 2,
    contactIds: [],
    tags: [],
    currency: s.currency,
    ...input,
    company: (input.company ?? '').trim() || 'Unknown company',
    role: (input.role ?? '').trim() || 'Untitled role',
    status,
    appliedAt,
    history: input.history?.length ? input.history : history,
    createdAt: now,
    updatedAt: now,
  };
  if (status !== 'wishlist' && status !== 'applied' && !app.respondedAt && RESPONSE_STAGES.includes(status)) app.respondedAt = now;
  if (CLOSED_STAGES.includes(status)) app.closedAt = app.closedAt ?? now;
  if (status === 'applied' && !app.nextActionAt) {
    app.nextAction = app.nextAction || 'Follow up if no response';
    app.nextActionAt = addDaysISO(appliedAt, s.followUpDays);
  }
  await db.applications.add(app);
  await ensureCompany(app.company);
  if (app.referrerId) await linkContactToApplication(app.referrerId, app.id);
  return app;
}

export async function updateApplication(id: ID, patch: Partial<Application>): Promise<void> {
  const cur = await db.applications.get(id);
  if (!cur) return;
  if (patch.status && patch.status !== cur.status) {
    const { status, ...rest } = patch;
    if (Object.keys(rest).length) await db.applications.update(id, { ...rest, updatedAt: nowISO() });
    await moveApplication(id, status);
  } else {
    await db.applications.update(id, { ...patch, updatedAt: nowISO() });
  }
  if (patch.company && companyKey(patch.company) !== companyKey(cur.company)) await ensureCompany(patch.company);
  if (patch.referrerId && patch.referrerId !== cur.referrerId) await linkContactToApplication(patch.referrerId, id);
}

/** Moves an application through the pipeline and keeps dates, history & follow-ups consistent. */
export async function moveApplication(id: ID, to: Stage, opts: { note?: string; reason?: string } = {}): Promise<Stage | undefined> {
  const app = await db.applications.get(id);
  if (!app || app.status === to) return undefined;
  const s = await getSettings();
  const now = nowISO();
  const patch: Partial<Application> = {
    status: to,
    updatedAt: now,
    history: [...(app.history ?? []), { stage: to, at: now, note: opts.note }],
  };
  if (to !== 'wishlist' && !app.appliedAt) patch.appliedAt = now;
  if (!app.respondedAt && RESPONSE_STAGES.includes(to) && app.status !== 'wishlist') patch.respondedAt = now;
  if (CLOSED_STAGES.includes(to)) {
    patch.closedAt = now;
    if (to !== 'accepted') patch.closedFromStage = STAGE_RANK[app.status] >= 0 ? app.status : app.closedFromStage;
    if (opts.reason) patch.rejectionReason = opts.reason;
    patch.nextAction = undefined;
    patch.nextActionAt = undefined;
  } else {
    patch.closedAt = undefined;
    if (to === 'applied' && !app.nextActionAt) {
      patch.nextAction = 'Follow up if no response';
      patch.nextActionAt = addDaysISO(now, s.followUpDays);
    }
    if (STAGE_RANK[to] >= 2 && app.nextAction === 'Follow up if no response') {
      patch.nextAction = undefined;
      patch.nextActionAt = undefined;
    }
  }
  await db.applications.update(id, patch);
  return app.status;
}

export async function deleteApplications(ids: ID[]): Promise<() => Promise<void>> {
  const apps = (await db.applications.bulkGet(ids)).filter(Boolean) as Application[];
  const interviews = await db.interviews.where('applicationId').anyOf(ids).toArray();
  await db.transaction('rw', db.applications, db.interviews, async () => {
    await db.applications.bulkDelete(ids);
    await db.interviews.bulkDelete(interviews.map((i) => i.id));
  });
  return async () => {
    await db.applications.bulkPut(apps);
    await db.interviews.bulkPut(interviews);
  };
}

export async function duplicateApplication(id: ID): Promise<Application | undefined> {
  const a = await db.applications.get(id);
  if (!a) return undefined;
  const { id: _id, history, createdAt, updatedAt, respondedAt, closedAt, appliedAt, status, ...rest } = a;
  return createApplication({ ...rest, status: 'wishlist', role: `${a.role} (copy)` });
}

export async function completeAppAction(id: ID): Promise<void> {
  await db.applications.update(id, { nextAction: undefined, nextActionAt: undefined, updatedAt: nowISO() });
}

export async function bulkMoveApplications(ids: ID[], to: Stage): Promise<void> {
  for (const id of ids) await moveApplication(id, to);
}

export async function linkContactToApplication(contactId: ID, appId: ID): Promise<void> {
  const [c, a] = await Promise.all([db.contacts.get(contactId), db.applications.get(appId)]);
  if (c && !c.applicationIds.includes(appId)) await db.contacts.update(contactId, { applicationIds: [...c.applicationIds, appId], updatedAt: nowISO() });
  if (a && !a.contactIds.includes(contactId)) await db.applications.update(appId, { contactIds: [...a.contactIds, contactId], updatedAt: nowISO() });
}

export async function unlinkContactFromApplication(contactId: ID, appId: ID): Promise<void> {
  const [c, a] = await Promise.all([db.contacts.get(contactId), db.applications.get(appId)]);
  if (c) await db.contacts.update(contactId, { applicationIds: c.applicationIds.filter((x) => x !== appId) });
  if (a) await db.applications.update(appId, { contactIds: a.contactIds.filter((x) => x !== contactId), referrerId: a.referrerId === contactId ? undefined : a.referrerId });
}

/* ───────────────────────── Interviews ───────────────────────── */

export async function saveInterview(input: Partial<Interview> & { applicationId: ID }, id?: ID): Promise<Interview> {
  const now = nowISO();
  if (id) {
    await db.interviews.update(id, { ...input, updatedAt: now });
    return (await db.interviews.get(id))!;
  }
  const iv: Interview = {
    id: uid(),
    round: 'Interview',
    type: 'technical',
    scheduledAt: dueInDays(2),
    durationMins: 45,
    mode: 'video',
    outcome: 'scheduled',
    checklist: DEFAULT_CHECKLIST.map((text) => ({ id: uid(), text, done: false })),
    createdAt: now,
    updatedAt: now,
    ...input,
  };
  await db.interviews.add(iv);
  // Auto-advance the application.
  const app = await db.applications.get(iv.applicationId);
  if (app) {
    const isScreen = ['phone_screen', 'hr'].includes(iv.type);
    const target: Stage = isScreen ? 'screening' : iv.type === 'take_home' ? 'assessment' : 'interviewing';
    const curRank = STAGE_RANK[app.status];
    if (curRank >= 0 && curRank < STAGE_RANK[target]) await moveApplication(app.id, target, { note: `${iv.round} scheduled` });
  }
  return iv;
}

export async function deleteInterview(id: ID): Promise<() => Promise<void>> {
  const iv = await db.interviews.get(id);
  await db.interviews.delete(id);
  return async () => {
    if (iv) await db.interviews.put(iv);
  };
}

/* ───────────────────────── Contacts ───────────────────────── */

export async function createContact(input: Partial<Contact>): Promise<Contact> {
  const now = nowISO();
  const c: Contact = {
    id: uid(),
    relationship: 'other',
    stage: 'target',
    warmth: 'cold',
    priority: 2,
    tags: [],
    applicationIds: [],
    createdAt: now,
    updatedAt: now,
    ...input,
    name: (input.name ?? '').trim() || 'Unnamed contact',
  };
  await db.contacts.add(c);
  if (c.company) await ensureCompany(c.company);
  for (const appId of c.applicationIds) {
    const a = await db.applications.get(appId);
    if (a && !a.contactIds.includes(c.id)) await db.applications.update(appId, { contactIds: [...a.contactIds, c.id] });
  }
  return c;
}

export async function updateContact(id: ID, patch: Partial<Contact>): Promise<void> {
  await db.contacts.update(id, { ...patch, updatedAt: nowISO() });
  if (patch.company) await ensureCompany(patch.company);
}

export async function deleteContacts(ids: ID[]): Promise<() => Promise<void>> {
  const contacts = (await db.contacts.bulkGet(ids)).filter(Boolean) as Contact[];
  const interactions = await db.interactions.where('contactId').anyOf(ids).toArray();
  const enrollments = await db.enrollments.where('contactId').anyOf(ids).toArray();
  await db.transaction('rw', db.contacts, db.interactions, db.enrollments, async () => {
    await db.contacts.bulkDelete(ids);
    await db.interactions.bulkDelete(interactions.map((i) => i.id));
    await db.enrollments.bulkDelete(enrollments.map((e) => e.id));
  });
  return async () => {
    await db.contacts.bulkPut(contacts);
    await db.interactions.bulkPut(interactions);
    await db.enrollments.bulkPut(enrollments);
  };
}

const FOLLOW_UP_KINDS: InteractionKind[] = ['connection_request', 'message', 'inmail', 'email', 'follow_up', 'referral_request'];
export const CONTACT_FOLLOWUP_DAYS = 4;

/** Logs a touchpoint and updates the contact's pipeline + follow-up date. */
export async function logInteraction(
  input: Partial<Interaction> & { kind: InteractionKind; channel: Interaction['channel'] },
  opts: { fromSequence?: boolean } = {},
): Promise<Interaction> {
  const now = nowISO();
  if (input.kind === 'note') {
    // Private notes are part of the timeline but never count as outreach or replies.
    const note: Interaction = { id: uid(), date: now, createdAt: now, ...input, direction: 'out', outcome: 'no_reply' };
    await db.interactions.add(note);
    return note;
  }
  const outbound = INTERACTION_KINDS.find((k) => k.id === input.kind)?.outbound ?? true;
  const it: Interaction = {
    id: uid(),
    date: now,
    direction: input.direction ?? (outbound ? 'out' : 'in'),
    outcome: input.outcome ?? (outbound ? 'awaiting' : 'replied'),
    createdAt: now,
    ...input,
  };
  await db.interactions.add(it);
  if (it.contactId) {
    const c = await db.contacts.get(it.contactId);
    if (c) {
      const patch: Partial<Contact> = { lastContactedAt: it.date, updatedAt: now };
      if (it.direction === 'out') {
        if (['target', 'network', 'no_response'].includes(c.stage) && it.kind !== 'comment') patch.stage = 'contacted';
        const hasActiveSeq = opts.fromSequence || (await db.enrollments.where('contactId').equals(c.id).filter((e) => e.status === 'active').count()) > 0;
        if (!hasActiveSeq && FOLLOW_UP_KINDS.includes(it.kind)) patch.nextFollowUpAt = dueInDays(CONTACT_FOLLOWUP_DAYS, new Date(it.date));
        if (it.kind === 'meeting' || it.kind === 'call') patch.stage = c.stage === 'referred' ? 'referred' : 'engaged';
      } else if (it.kind === 'reply') {
        if (['target', 'contacted', 'no_response', 'network'].includes(c.stage)) patch.stage = 'replied';
        patch.nextFollowUpAt = undefined;
      }
      await db.contacts.update(c.id, patch);
    }
  }
  return it;
}

export async function updateInteraction(id: ID, patch: Partial<Interaction>): Promise<void> {
  await db.interactions.update(id, patch);
}

export async function deleteInteraction(id: ID): Promise<() => Promise<void>> {
  const it = await db.interactions.get(id);
  await db.interactions.delete(id);
  return async () => {
    if (it) await db.interactions.put(it);
  };
}

/** Records that a contact replied: credits the last outbound touch, stops sequences, advances the pipeline. */
export async function markReplied(contactId: ID, sentiment: 'positive' | 'neutral' | 'negative' = 'neutral', note?: string): Promise<void> {
  const now = nowISO();
  const outbound = await db.interactions
    .where('contactId')
    .equals(contactId)
    .filter((i) => i.direction === 'out' && i.kind !== 'note' && i.kind !== 'comment')
    .toArray();
  outbound.sort((a, b) => b.date.localeCompare(a.date));
  const last = outbound.find((i) => i.outcome === 'awaiting' || i.outcome === 'accepted') ?? outbound[0];
  if (last) {
    await db.interactions.update(last.id, {
      outcome: sentiment === 'positive' ? 'positive' : sentiment === 'negative' ? 'negative' : 'replied',
      repliedAt: now,
    });
  }
  await logInteraction({
    contactId,
    applicationId: last?.applicationId,
    channel: last?.channel ?? 'linkedin',
    kind: 'reply',
    direction: 'in',
    outcome: 'replied',
    content: note,
  });
  const active = await db.enrollments.where('contactId').equals(contactId).filter((e) => e.status === 'active' || e.status === 'paused').toArray();
  for (const e of active) await db.enrollments.update(e.id, { status: 'replied', nextDueAt: undefined, updatedAt: now });
  if (sentiment === 'negative') await db.contacts.update(contactId, { stage: 'closed', nextFollowUpAt: undefined });
  if (sentiment === 'positive') {
    const c = await db.contacts.get(contactId);
    if (c && ['target', 'contacted', 'replied', 'no_response', 'network'].includes(c.stage)) await db.contacts.update(contactId, { stage: 'engaged', warmth: c.warmth === 'cold' ? 'warm' : c.warmth });
  }
}

export async function completeContactFollowUp(contactId: ID): Promise<void> {
  await db.contacts.update(contactId, { nextFollowUpAt: undefined, updatedAt: nowISO() });
}

/* ───────────────────────── Sequences ───────────────────────── */

export async function enrollContacts(sequenceId: ID, contactIds: ID[], opts: { applicationId?: ID } = {}): Promise<number> {
  const seq = await db.sequences.get(sequenceId);
  if (!seq || !seq.steps.length) return 0;
  const now = nowISO();
  let n = 0;
  for (const contactId of contactIds) {
    const existing = await db.enrollments
      .where('contactId')
      .equals(contactId)
      .filter((e) => e.sequenceId === sequenceId && (e.status === 'active' || e.status === 'paused'))
      .count();
    if (existing) continue;
    const e: Enrollment = {
      id: uid(),
      sequenceId,
      contactId,
      applicationId: opts.applicationId,
      status: 'active',
      stepIndex: 0,
      startedAt: now,
      nextDueAt: dueInDays(Math.max(0, seq.steps[0].day)),
      createdAt: now,
      updatedAt: now,
    };
    await db.enrollments.add(e);
    await db.contacts.update(contactId, { nextFollowUpAt: undefined, updatedAt: now });
    n++;
  }
  return n;
}

export async function completeEnrollmentStep(
  enrollmentId: ID,
  opts: { content?: string; subject?: string; templateId?: ID } = {},
): Promise<void> {
  const e = await db.enrollments.get(enrollmentId);
  if (!e) return;
  const seq = await db.sequences.get(e.sequenceId);
  const step = seq?.steps[e.stepIndex];
  const now = nowISO();
  if (step) {
    await logInteraction(
      {
        contactId: e.contactId,
        applicationId: e.applicationId,
        channel: step.channel,
        kind: step.kind,
        templateId: opts.templateId ?? step.templateId,
        enrollmentId: e.id,
        stepIndex: e.stepIndex,
        content: opts.content,
        subject: opts.subject,
        direction: 'out',
        outcome: step.kind === 'comment' ? 'no_reply' : 'awaiting',
      },
      { fromSequence: true },
    );
  }
  const next = e.stepIndex + 1;
  if (!seq || next >= seq.steps.length) {
    await db.enrollments.update(e.id, { status: 'completed', stepIndex: next, nextDueAt: undefined, lastStepAt: now, updatedAt: now });
  } else {
    const gap = Math.max(0, seq.steps[next].day - (step?.day ?? 0));
    await db.enrollments.update(e.id, { stepIndex: next, nextDueAt: dueInDays(gap), lastStepAt: now, updatedAt: now });
  }
}

export async function skipEnrollmentStep(enrollmentId: ID): Promise<void> {
  const e = await db.enrollments.get(enrollmentId);
  if (!e) return;
  const seq = await db.sequences.get(e.sequenceId);
  const now = nowISO();
  const next = e.stepIndex + 1;
  if (!seq || next >= seq.steps.length) {
    await db.enrollments.update(e.id, { status: 'completed', stepIndex: next, nextDueAt: undefined, updatedAt: now });
  } else {
    const gap = Math.max(0, seq.steps[next].day - seq.steps[e.stepIndex].day);
    await db.enrollments.update(e.id, { stepIndex: next, nextDueAt: dueInDays(gap), updatedAt: now });
  }
}

export async function setEnrollmentStatus(enrollmentId: ID, status: EnrollmentStatus): Promise<void> {
  const patch: Partial<Enrollment> = { status, updatedAt: nowISO() };
  if (status === 'active') {
    const e = await db.enrollments.get(enrollmentId);
    if (e && !e.nextDueAt) patch.nextDueAt = dueInDays(0);
  }
  if (status === 'stopped' || status === 'completed') patch.nextDueAt = undefined;
  await db.enrollments.update(enrollmentId, patch);
}

export async function saveSequence(input: Partial<Sequence>, id?: ID): Promise<ID> {
  const now = nowISO();
  if (id) {
    await db.sequences.update(id, { ...input, updatedAt: now });
    return id;
  }
  const s: Sequence = { id: uid(), name: 'New sequence', steps: [], createdAt: now, updatedAt: now, ...input };
  await db.sequences.add(s);
  return s.id;
}

export async function deleteSequence(id: ID): Promise<void> {
  const enrollments = await db.enrollments.where('sequenceId').equals(id).toArray();
  await db.transaction('rw', db.sequences, db.enrollments, async () => {
    await db.sequences.delete(id);
    for (const e of enrollments) if (e.status === 'active' || e.status === 'paused') await db.enrollments.update(e.id, { status: 'stopped', nextDueAt: undefined });
  });
}

/* ───────────────────────── Templates ───────────────────────── */

export async function saveTemplate(input: Partial<Template>, id?: ID): Promise<ID> {
  const now = nowISO();
  if (id) {
    await db.templates.update(id, { ...input, updatedAt: now });
    return id;
  }
  const t: Template = { id: uid(), name: 'New template', category: 'other', channel: 'linkedin', body: '', createdAt: now, updatedAt: now, ...input };
  await db.templates.add(t);
  return t.id;
}

export async function deleteTemplate(id: ID): Promise<() => Promise<void>> {
  const t = await db.templates.get(id);
  await db.templates.delete(id);
  return async () => {
    if (t) await db.templates.put(t);
  };
}

/* ───────────────────────── Tasks ───────────────────────── */

export async function saveTask(input: Partial<Task>, id?: ID): Promise<ID> {
  const now = nowISO();
  if (id) {
    await db.tasks.update(id, { ...input, updatedAt: now });
    return id;
  }
  const t: Task = { id: uid(), title: 'New task', done: false, priority: 2, createdAt: now, updatedAt: now, ...input };
  await db.tasks.add(t);
  return t.id;
}

export async function toggleTask(id: ID): Promise<void> {
  const t = await db.tasks.get(id);
  if (!t) return;
  await db.tasks.update(id, { done: !t.done, doneAt: !t.done ? nowISO() : undefined, updatedAt: nowISO() });
}

export async function deleteTask(id: ID): Promise<() => Promise<void>> {
  const t = await db.tasks.get(id);
  await db.tasks.delete(id);
  return async () => {
    if (t) await db.tasks.put(t);
  };
}

/* ───────────────────────── Agenda snooze ───────────────────────── */

export async function snoozeItem(kind: 'app' | 'contact' | 'enrollment' | 'task', id: ID, days: number): Promise<void> {
  const due = dueInDays(days);
  if (kind === 'app') await db.applications.update(id, { nextActionAt: due });
  else if (kind === 'contact') await db.contacts.update(id, { nextFollowUpAt: due });
  else if (kind === 'enrollment') await db.enrollments.update(id, { nextDueAt: due });
  else await db.tasks.update(id, { dueAt: due });
}

/* ───────────────────────── Library: stories, questions, docs, snippets, offers ───────────────────────── */

async function saveGeneric<T extends { id: ID; createdAt: string; updatedAt: string }>(
  table: { add: (x: T) => Promise<unknown>; update: (id: ID, p: Partial<T>) => Promise<unknown> },
  defaults: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
  input: Partial<T>,
  id?: ID,
): Promise<ID> {
  const now = nowISO();
  if (id) {
    await table.update(id, { ...input, updatedAt: now } as Partial<T>);
    return id;
  }
  const row = { ...defaults, ...input, id: uid(), createdAt: now, updatedAt: now } as T;
  await table.add(row);
  return row.id;
}

export const saveStory = (input: Partial<StarStory>, id?: ID) =>
  saveGeneric<StarStory>(db.stories as any, { title: 'Untitled story', competencies: [], situation: '', task: '', action: '', result: '' }, input, id);

export const saveQuestion = (input: Partial<Question>, id?: ID) =>
  saveGeneric<Question>(db.questions as any, { text: '', category: 'behavioral', confidence: 2 }, input, id);

export const saveSnippet = (input: Partial<Snippet>, id?: ID) =>
  saveGeneric<Snippet>(db.snippets as any, { title: 'Untitled', body: '', uses: 0 }, input, id);

export const saveDocument = (input: Partial<DocumentFile>, id?: ID) =>
  saveGeneric<DocumentFile>(db.documents as any, { name: 'Untitled document', kind: 'resume' }, input, id);

export async function saveOffer(input: Partial<Offer>, id?: ID): Promise<ID> {
  const s = await getSettings();
  const newId = await saveGeneric<Offer>(
    db.offers as any,
    {
      company: '',
      role: '',
      currency: s.currency,
      base: 0,
      bonus: 0,
      equity: 0,
      joiningBonus: 0,
      benefits: 0,
      status: 'pending',
      ratings: { growth: 3, learning: 3, culture: 3, wlb: 3, stability: 3, brand: 3 },
    },
    input,
    id,
  );
  if (!id && input.applicationId) {
    const app = await db.applications.get(input.applicationId);
    if (app && STAGE_RANK[app.status] >= 0 && STAGE_RANK[app.status] < STAGE_RANK.offer) await moveApplication(app.id, 'offer');
  }
  return newId;
}

export async function deleteRow(table: (typeof DATA_TABLES)[number], id: ID): Promise<() => Promise<void>> {
  const t = (db as any)[table];
  const row = await t.get(id);
  await t.delete(id);
  return async () => {
    if (row) await t.put(row);
  };
}

/* ───────────────────────── Data management ───────────────────────── */

export async function removeSampleData(): Promise<void> {
  await db.transaction('rw', DATA_TABLES.map((t) => (db as any)[t]), async () => {
    for (const t of DATA_TABLES) {
      const table = (db as any)[t];
      const keys = await table.filter((r: { isSample?: boolean }) => r.isSample).primaryKeys();
      await table.bulkDelete(keys);
    }
  });
  await updateSettings({ sampleLoaded: false });
}

export async function resetAllData(): Promise<void> {
  await db.transaction('rw', [...DATA_TABLES.map((t) => (db as any)[t]), db.kv], async () => {
    for (const t of DATA_TABLES) await (db as any)[t].clear();
    await db.kv.clear();
  });
  try {
    localStorage.removeItem('pursuit.theme');
    localStorage.removeItem('pursuit.accent');
  } catch {
    /* ignore */
  }
  await ensureBuiltIns();
}
