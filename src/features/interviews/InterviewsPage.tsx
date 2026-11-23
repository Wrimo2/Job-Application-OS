import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { isToday, isTomorrow, format } from 'date-fns';
import { BookOpen, Brain, CalendarDays, CalendarPlus, Download, Eye, Layers, Pencil, Plus, Shuffle, Sparkles, Trash2, TriangleAlert, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useData } from '@/lib/data';
import { undoToast, useUI } from '@/lib/store';
import { deleteRow, saveQuestion, saveStory } from '@/lib/actions';
import { COMPETENCIES, QUESTION_CATEGORIES, QUESTION_CATEGORY_LABEL } from '@/lib/constants';
import { downloadICS } from '@/lib/io';
import type { Question, QuestionCategory, StarStory } from '@/lib/types';
import { cn, plural, toDate } from '@/lib/utils';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Tabs, Textarea } from '@/components/ui';
import { Modal } from '@/components/overlay';
import { PageHeader } from '@/components/common';
import { InterviewCard } from './InterviewCard';

type Tab = 'schedule' | 'questions' | 'stories';

export default function InterviewsPage() {
  const { tab = 'schedule' } = useParams();
  const navigate = useNavigate();
  const ui = useUI();
  const { interviews, questions, stories } = useData();
  const upcoming = interviews.filter((i) => i.outcome === 'scheduled' && toDate(i.scheduledAt)! >= new Date()).length;
  return (
    <div className="page">
      <PageHeader
        icon={<CalendarDays className="h-5 w-5" />}
        title="Interviews"
        subtitle="Schedule, prepare, reflect — and build a question bank & story library that compounds."
        actions={
          <Button size="sm" variant="primary" onClick={() => ui.openInterviewForm()}>
            <CalendarPlus className="h-4 w-4" /> Schedule
          </Button>
        }
      />
      <Tabs
        className="mb-5"
        value={tab as Tab}
        onChange={(t) => navigate(t === 'schedule' ? '/interviews' : `/interviews/${t}`)}
        tabs={[
          { id: 'schedule', label: 'Schedule', icon: <CalendarDays className="h-4 w-4" />, count: upcoming || undefined },
          { id: 'questions', label: 'Question bank', icon: <Brain className="h-4 w-4" />, count: questions.length || undefined },
          { id: 'stories', label: 'STAR stories', icon: <BookOpen className="h-4 w-4" />, count: stories.length || undefined },
        ]}
      />
      {tab === 'schedule' && <Schedule />}
      {tab === 'questions' && <QuestionBank />}
      {tab === 'stories' && <Stories />}
    </div>
  );
}

function dayLabel(d: Date) {
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEEE, d MMMM');
}

function Schedule() {
  const ui = useUI();
  const { interviews, apps } = useData();
  const [params] = useSearchParams();
  const focus = params.get('focus');
  const [showPast, setShowPast] = useState(false);
  const now = new Date();
  const appOf = (id: string) => apps.find((a) => a.id === id);
  const upcoming = interviews.filter((i) => i.outcome === 'scheduled' && toDate(i.scheduledAt)! >= now).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const needsUpdate = interviews.filter((i) => (i.outcome === 'scheduled' || i.outcome === 'awaiting') && toDate(i.scheduledAt)! < now).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const past = interviews.filter((i) => !upcoming.includes(i) && !needsUpdate.includes(i)).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));

  useEffect(() => {
    if (focus) setTimeout(() => document.getElementById(`iv-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
  }, [focus]);

  const groups = new Map<string, typeof upcoming>();
  for (const iv of upcoming) {
    const k = dayLabel(toDate(iv.scheduledAt)!);
    groups.set(k, [...(groups.get(k) ?? []), iv]);
  }

  if (!interviews.length)
    return (
      <Card>
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="No interviews yet"
          description="When you land one, schedule it here: you’ll get a prep checklist, calendar export, and a thank-you reminder afterwards."
          action={
            <Button variant="primary" onClick={() => ui.openInterviewForm()}>
              <CalendarPlus className="h-4 w-4" /> Schedule interview
            </Button>
          }
        />
      </Card>
    );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Upcoming</h2>
          {upcoming.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => downloadICS(upcoming.map((iv) => ({ iv, app: appOf(iv.applicationId) })), 'pursuit-interviews')}>
              <Download className="h-3.5 w-3.5" /> Export all to calendar
            </Button>
          )}
        </div>
        {upcoming.length ? (
          [...groups.entries()].map(([label, list]) => (
            <div key={label}>
              <div className="label-caps mb-2">{label}</div>
              <div className="space-y-2">
                {list.map((iv) => (
                  <div key={iv.id} id={`iv-${iv.id}`}>
                    <InterviewCard iv={iv} app={appOf(iv.applicationId)} showCompany defaultOpen={iv.id === focus} />
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <Card>
            <EmptyState compact icon={<CalendarDays className="h-5 w-5" />} title="Nothing scheduled" description="Keep the outreach engine running — conversations turn into interviews." />
          </Card>
        )}
        {past.length > 0 && (
          <div>
            <button onClick={() => setShowPast(!showPast)} className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
              {showPast ? 'Hide' : 'Show'} past interviews ({past.length})
            </button>
            {showPast && (
              <div className="mt-3 space-y-2">
                {past.map((iv) => (
                  <InterviewCard key={iv.id} iv={iv} app={appOf(iv.applicationId)} showCompany />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="space-y-4">
        {needsUpdate.length > 0 && (
          <Card className="border-amber-500/30 p-4">
            <div className="flex items-center gap-2 text-[14px] font-semibold">
              <TriangleAlert className="h-4 w-4 text-amber-500" /> How did these go?
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Log the outcome, questions asked and a quick reflection while it’s fresh.</p>
            <div className="mt-3 space-y-2">
              {needsUpdate.slice(0, 6).map((iv) => {
                const a = appOf(iv.applicationId);
                return (
                  <button key={iv.id} onClick={() => ui.openInterviewForm(iv.applicationId, iv.id)} className="flex w-full items-center gap-2 rounded-lg border bg-card px-3 py-2 text-left hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium">
                        {a?.company} — {iv.round}
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">{format(toDate(iv.scheduledAt)!, 'd MMM, h:mm a')}</div>
                    </div>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </Card>
        )}
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Interview prep ritual
          </div>
          <ol className="mt-2 space-y-1.5 text-[12.5px] text-muted-foreground">
            <li>1. Re-read the JD and map 3 requirements to your stories.</li>
            <li>2. Research the interviewers and the team’s recent work.</li>
            <li>3. Practice your weakest questions in the Question bank.</li>
            <li>4. Prepare 3 sharp questions for them.</li>
            <li>5. After: log questions asked + reflection, send a thank-you within 24h.</li>
          </ol>
        </Card>
      </div>
    </div>
  );
}

const COMMON_QUESTIONS: [string, QuestionCategory][] = [
  ['Tell me about yourself', 'hr'],
  ['Why do you want to work here?', 'company'],
  ['Why are you leaving your current role?', 'hr'],
  ['What are your salary expectations?', 'hr'],
  ['What is your notice period?', 'hr'],
  ['Tell me about your biggest achievement', 'behavioral'],
  ['Tell me about a time you failed', 'behavioral'],
  ['Describe a conflict with a teammate and how you resolved it', 'behavioral'],
  ['Tell me about a time you disagreed with your manager', 'behavioral'],
  ['Describe a project with a tight deadline', 'behavioral'],
  ['Tell me about a time you showed leadership without authority', 'behavioral'],
  ['How do you prioritize when everything is urgent?', 'behavioral'],
  ['Tell me about a time you received critical feedback', 'behavioral'],
  ['Walk me through the most complex project you’ve worked on', 'technical'],
  ['Where do you see yourself in 3–5 years?', 'hr'],
  ['What questions do you have for us?', 'company'],
];

function QuestionBank() {
  const { questions, stories } = useData();
  const [cat, setCat] = useState<QuestionCategory | 'all'>('all');
  const [sort, setSort] = useState<'weakest' | 'recent'>('weakest');
  const [editing, setEditing] = useState<Question | 'new' | null>(null);
  const [practice, setPractice] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const list = questions
    .filter((q) => cat === 'all' || q.category === cat)
    .sort((a, b) => (sort === 'weakest' ? a.confidence - b.confidence || a.text.localeCompare(b.text) : b.createdAt.localeCompare(a.createdAt)));
  const avg = questions.length ? questions.reduce((a, q) => a + q.confidence, 0) / questions.length : 0;

  const addCommon = async () => {
    const existing = new Set(questions.map((q) => q.text.toLowerCase()));
    let n = 0;
    for (const [text, category] of COMMON_QUESTIONS) {
      if (existing.has(text.toLowerCase())) continue;
      await saveQuestion({ text, category, confidence: 2 });
      n++;
    }
    toast.success(n ? `Added ${plural(n, 'common question')}` : 'You already have them all');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={cat} onChange={(e) => setCat(e.target.value as QuestionCategory | 'all')} wrapperClassName="w-auto" className="h-8 w-44 text-[13px]">
          <option value="all">All categories</option>
          {QUESTION_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as 'weakest' | 'recent')} wrapperClassName="w-auto" className="h-8 w-40 text-[13px]">
          <option value="weakest">Weakest first</option>
          <option value="recent">Most recent</option>
        </Select>
        {questions.length > 0 && <span className="text-[12.5px] text-muted-foreground">Avg confidence {avg.toFixed(1)}/5</span>}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={addCommon}>
            <Layers className="h-3.5 w-3.5" /> Add common questions
          </Button>
          <Button size="sm" variant="secondary" disabled={!questions.length} onClick={() => setPractice(true)}>
            <Shuffle className="h-3.5 w-3.5" /> Practice
          </Button>
          <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> Question
          </Button>
        </div>
      </div>
      {list.length ? (
        <Card className="divide-y">
          {list.map((q) => {
            const story = stories.find((s) => s.id === q.storyId);
            const isOpen = open === q.id;
            return (
              <div key={q.id} className="group px-4 py-3">
                <div className="flex items-start gap-3">
                  <button className="min-w-0 flex-1 text-left" onClick={() => setOpen(isOpen ? null : q.id)}>
                    <div className="text-[13.5px] font-medium">{q.text}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone="outline">{QUESTION_CATEGORY_LABEL[q.category]}</Badge>
                      {q.company && <Badge tone="gray">{q.company}</Badge>}
                      {story && <Badge tone="violet">STAR: {story.title}</Badge>}
                      {!q.answer && <span className="text-[11.5px] text-amber-600 dark:text-amber-400">No answer drafted</span>}
                    </div>
                  </button>
                  <Confidence value={q.confidence} onChange={(v) => saveQuestion({ confidence: v }, q.id)} />
                  <div className="flex opacity-60 transition-opacity group-hover:opacity-100">
                    <Button size="icon-xs" variant="ghost" onClick={() => setEditing(q)} aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon-xs" variant="ghost" onClick={async () => undoToast('Question deleted', await deleteRow('questions', q.id))} aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {isOpen && q.answer && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 p-3 text-[13px] leading-relaxed">{q.answer}</p>}
              </div>
            );
          })}
        </Card>
      ) : (
        <Card>
          <EmptyState
            icon={<Brain className="h-6 w-6" />}
            title="Build your question bank"
            description="Log every question you’re asked (the interview form does it automatically), draft answers and practice the weakest ones."
            action={
              <Button variant="primary" onClick={addCommon}>
                <Layers className="h-4 w-4" /> Start with 16 common questions
              </Button>
            }
          />
        </Card>
      )}
      {editing && <QuestionEditor q={editing === 'new' ? undefined : editing} stories={stories} onClose={() => setEditing(null)} />}
      {practice && <Practice questions={list.length ? list : questions} onClose={() => setPractice(false)} />}
    </div>
  );
}

function Confidence({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5" title="Confidence">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          aria-label={`Confidence ${n}`}
          onClick={() => onChange(n)}
          className={cn('h-2.5 w-2.5 rounded-full transition-colors', n <= value ? (value <= 2 ? 'bg-rose-500' : value === 3 ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-muted-foreground/20 hover:bg-muted-foreground/40')}
        />
      ))}
    </div>
  );
}

function QuestionEditor({ q, stories, onClose }: { q?: Question; stories: StarStory[]; onClose: () => void }) {
  const [d, setD] = useState<Partial<Question>>(q ?? { category: 'behavioral', confidence: 2 });
  const save = async () => {
    if (!d.text?.trim()) return toast.error('Write the question');
    await saveQuestion(d, q?.id);
    toast.success('Saved');
    onClose();
  };
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={q ? 'Edit question' : 'Add question'}
      icon={<Brain className="h-4 w-4" />}
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
        <Field label="Question">
          <Input autoFocus value={d.text ?? ''} onChange={(e) => setD({ ...d, text: e.target.value })} placeholder="e.g. Tell me about a time you failed" />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Category">
            <Select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as QuestionCategory })}>
              {QUESTION_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Company (optional)">
            <Input value={d.company ?? ''} onChange={(e) => setD({ ...d, company: e.target.value })} />
          </Field>
          <Field label="Confidence">
            <div className="flex h-9 items-center">
              <Confidence value={d.confidence ?? 2} onChange={(v) => setD({ ...d, confidence: v })} />
            </div>
          </Field>
        </div>
        <Field label="Linked STAR story">
          <Select value={d.storyId ?? ''} onChange={(e) => setD({ ...d, storyId: e.target.value || undefined })}>
            <option value="">None</option>
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Your answer" hint="Bullet points beat a script — you want to sound natural.">
          <Textarea value={d.answer ?? ''} onChange={(e) => setD({ ...d, answer: e.target.value })} className="min-h-[140px]" />
        </Field>
      </div>
    </Modal>
  );
}

function Practice({ questions, onClose }: { questions: Question[]; onClose: () => void }) {
  const deck = useMemo(() => [...questions].sort((a, b) => a.confidence - b.confidence + (Math.random() - 0.5) * 2), [questions]);
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const q = deck[i];
  const next = (d: number) => {
    setReveal(false);
    setI((x) => Math.min(deck.length - 1, Math.max(0, x + d)));
  };
  if (!q) return null;
  return (
    <Modal open onOpenChange={(v) => !v && onClose()} title="Practice mode" description={`Card ${i + 1} of ${deck.length} · weakest first. Answer out loud, then rate yourself.`} icon={<Shuffle className="h-4 w-4" />} size="lg">
      <div className="space-y-5">
        <div className="grid min-h-[160px] place-items-center rounded-2xl border bg-gradient-to-br from-primary/10 to-transparent p-8 text-center">
          <div>
            <Badge tone="outline">{QUESTION_CATEGORY_LABEL[q.category]}</Badge>
            <p className="mt-3 text-xl font-semibold tracking-tight">{q.text}</p>
            {q.company && <p className="mt-1 text-[13px] text-muted-foreground">Asked at {q.company}</p>}
          </div>
        </div>
        {reveal ? (
          <div className="rounded-xl border bg-muted/40 p-4 text-[13.5px] leading-relaxed">{q.answer ? <p className="whitespace-pre-wrap">{q.answer}</p> : <p className="text-muted-foreground">No answer saved yet — write one in the question bank after this session.</p>}</div>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => setReveal(true)}>
            <Eye className="h-4 w-4" /> Reveal my notes
          </Button>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[13px]">
            How confident?
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={async () => {
                  await saveQuestion({ confidence: n }, q.id);
                  next(1);
                }}
                className={cn('h-8 w-8 rounded-lg border text-[13px] font-semibold hover:bg-accent', q.confidence === n && 'border-primary bg-primary/10 text-primary')}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => next(-1)} disabled={i === 0}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button size="sm" variant="secondary" onClick={() => (i === deck.length - 1 ? onClose() : next(1))}>
              {i === deck.length - 1 ? 'Finish' : 'Next'} <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function Stories() {
  const { stories } = useData();
  const [editing, setEditing] = useState<StarStory | 'new' | null>(null);
  const coverage = COMPETENCIES.map((c) => ({ c, n: stories.filter((s) => s.competencies.includes(c)).length }));
  const gaps = coverage.filter((x) => !x.n);
  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[14px] font-semibold">Competency coverage</div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {gaps.length ? `${gaps.length} common behavioral themes have no story yet — interviewers love these.` : 'Every common theme has at least one story. You’re ready for behavioral rounds.'}
            </p>
          </div>
          <Button size="sm" variant="primary" onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> New story
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {coverage.map(({ c, n }) => (
            <span
              key={c}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset',
                n ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300' : 'bg-muted text-muted-foreground ring-border',
              )}
            >
              {c}
              <span className="tabular-nums opacity-70">{n}</span>
            </span>
          ))}
        </div>
      </Card>
      {stories.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {stories.map((s) => (
            <Card key={s.id} className="group p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="text-[14.5px] font-semibold">{s.title}</div>
                <div className="flex opacity-60 transition-opacity group-hover:opacity-100">
                  <Button size="icon-xs" variant="ghost" onClick={() => setEditing(s)} aria-label="Edit story">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon-xs" variant="ghost" onClick={async () => undoToast('Story deleted', await deleteRow('stories', s.id))} aria-label="Delete story">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {s.competencies.map((c) => (
                  <Badge key={c} tone="violet">
                    {c}
                  </Badge>
                ))}
              </div>
              <dl className="mt-3 space-y-2 text-[13px]">
                {(
                  [
                    ['S', 'Situation', s.situation],
                    ['T', 'Task', s.task],
                    ['A', 'Action', s.action],
                    ['R', 'Result', s.result],
                  ] as const
                ).map(([k, label, v]) => (
                  <div key={k} className="flex gap-2.5">
                    <dt className={cn('grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] font-bold', k === 'R' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-muted text-muted-foreground')} title={label}>
                      {k}
                    </dt>
                    <dd className={cn('leading-relaxed', k === 'R' ? 'font-medium' : 'text-muted-foreground')}>{v || <span className="italic opacity-60">Add the {label.toLowerCase()}</span>}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<BookOpen className="h-6 w-6" />} title="Write your first STAR story" description="5–8 strong stories cover most behavioral questions. Lead with the result, and always include a number." />
        </Card>
      )}
      {editing && <StoryEditor s={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StoryEditor({ s, onClose }: { s?: StarStory; onClose: () => void }) {
  const [d, setD] = useState<Partial<StarStory>>(s ?? { competencies: [], situation: '', task: '', action: '', result: '' });
  const save = async () => {
    if (!d.title?.trim()) return toast.error('Give the story a title');
    await saveStory(d, s?.id);
    toast.success('Story saved');
    onClose();
  };
  const fields: [keyof StarStory, string, string][] = [
    ['situation', 'Situation', 'Context in 1–2 sentences. Where, when, what was at stake?'],
    ['task', 'Task', 'Your specific responsibility or goal.'],
    ['action', 'Action', 'What YOU did — the steps, decisions and trade-offs. Use “I”, not “we”.'],
    ['result', 'Result', 'The outcome with numbers (%, ₹/$, time saved, users). What you learned.'],
  ];
  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={s ? 'Edit STAR story' : 'New STAR story'}
      icon={<BookOpen className="h-4 w-4" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save story
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input autoFocus value={d.title ?? ''} onChange={(e) => setD({ ...d, title: e.target.value })} placeholder="e.g. Cut checkout load time by 40%" />
        </Field>
        <Field label="Competencies it demonstrates">
          <div className="flex flex-wrap gap-1.5">
            {COMPETENCIES.map((c) => {
              const on = d.competencies?.includes(c);
              return (
                <button
                  key={c}
                  onClick={() => setD({ ...d, competencies: on ? d.competencies!.filter((x) => x !== c) : [...(d.competencies ?? []), c] })}
                  className={cn('rounded-full border px-2.5 py-1 text-[12px] font-medium', on ? 'border-primary/40 bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent')}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </Field>
        {fields.map(([k, label, hint]) => (
          <Field key={k} label={label} hint={hint}>
            <Textarea value={(d[k] as string) ?? ''} onChange={(e) => setD({ ...d, [k]: e.target.value })} className="min-h-[64px]" />
          </Field>
        ))}
      </div>
    </Modal>
  );
}
