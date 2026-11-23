import * as React from 'react';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowLeft, ArrowRight, Briefcase, ChartColumn, Check, Database, Send, Sparkles, Target, Users } from 'lucide-react';
import { toast } from 'sonner';
import { updateSettings } from '@/lib/db';
import { loadSampleData } from '@/lib/seed';
import { useSettings } from '@/lib/hooks';
import { CURRENCIES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Button, Field, Input, Select } from './ui';
import { TagInput } from './fields';
import { Logo } from './layout';
import { celebrate } from '@/lib/store';

export function Onboarding() {
  const settings = useSettings();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [p, setP] = useState({
    name: settings.profile.name,
    currentRole: settings.profile.currentRole,
    currentCompany: settings.profile.currentCompany,
    experienceYears: settings.profile.experienceYears,
    targetRoles: settings.profile.targetRoles,
    targetLocations: settings.profile.targetLocations,
    skills: settings.profile.skills,
    achievement: settings.profile.achievement,
  });
  const [goals, setGoals] = useState(settings.goals);
  const [currency, setCurrency] = useState(settings.currency);

  const finish = async (withSample: boolean) => {
    setBusy(true);
    try {
      await updateSettings({ profile: p, goals, currency, onboarded: true });
      if (withSample) {
        await loadSampleData();
        toast.success('Sample data loaded', { description: 'Explore freely — remove it anytime from Settings → Data.' });
      } else {
        toast.success(`Welcome aboard${p.name ? `, ${p.name.split(' ')[0]}` : ''}!`, { description: 'Add your first application with N, or press ⌘/Ctrl K anytime.' });
      }
      celebrate();
    } finally {
      setBusy(false);
    }
  };

  const steps = ['You', 'Targets', 'Goals'];

  return (
    <Dialog.Root open>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-background/80 backdrop-blur-md" />
        <Dialog.Content
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[81] flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border bg-card shadow-2xl outline-none"
        >
          <Dialog.Title className="sr-only">Welcome to Pursuit</Dialog.Title>
          <Dialog.Description className="sr-only">Set up your profile, targets and weekly goals</Dialog.Description>
          {/* Left: pitch */}
          <div className="relative hidden w-[42%] flex-col justify-between gap-6 overflow-y-auto no-scrollbar bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 text-white md:flex">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-fuchsia-300/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
                  <svg viewBox="0 0 64 64" className="h-5 w-5" aria-hidden>
                    <path d="M23 41 L41 23 M29 23 H41 V35" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="text-lg font-semibold">Pursuit</span>
              </div>
              <h2 className="mt-8 text-[28px] font-semibold leading-tight tracking-tight">Turn your job search into a system.</h2>
              <p className="mt-3 text-[14px] leading-relaxed text-white/80">Everything in one place — applications from every platform, the people you reach out to, and data that tells you what to do next.</p>
            </div>
            <ul className="relative space-y-3 text-[13.5px]">
              {[
                [Briefcase, 'Track every application from LinkedIn, Naukri, referrals & more'],
                [Send, 'Run cold outreach sequences with ready-to-send templates'],
                [Users, 'A personal CRM for recruiters, referrers & hiring managers'],
                [ChartColumn, 'See which platforms, resumes & messages actually work'],
              ].map(([Icon, text], i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/15">
                    {React.createElement(Icon as React.ComponentType<{ className?: string }>, { className: 'h-3.5 w-3.5' })}
                  </span>
                  <span className="text-white/90">{text as string}</span>
                </li>
              ))}
            </ul>
            <p className="relative text-[12px] text-white/60">🔒 Your data stays on this device. No account, no tracking.</p>
          </div>

          {/* Right: form */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="md:hidden">
                <Logo />
              </div>
              <div className="flex items-center gap-2">
                {steps.map((s, i) => (
                  <div key={s} className="flex items-center gap-2">
                    <div
                      className={cn(
                        'grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold',
                        i < step ? 'bg-primary text-primary-foreground' : i === step ? 'bg-primary/15 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </div>
                    <span className={cn('hidden text-[13px] font-medium sm:inline', i === step ? 'text-foreground' : 'text-muted-foreground')}>{s}</span>
                    {i < steps.length - 1 && <div className="h-px w-5 bg-border" />}
                  </div>
                ))}
              </div>
              <button className="text-[12px] text-muted-foreground hover:text-foreground" onClick={() => finish(false)}>
                Skip
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {step === 0 && (
                <div className="space-y-5 animate-fade-up">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">Welcome! Let’s set up your command center 👋</h3>
                    <p className="mt-1 text-[13.5px] text-muted-foreground">This personalizes your outreach templates — every message gets filled in for you.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Your name">
                      <Input autoFocus value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. Aarav Kapoor" />
                    </Field>
                    <Field label="Current role / title">
                      <Input value={p.currentRole} onChange={(e) => setP({ ...p, currentRole: e.target.value })} placeholder="e.g. Frontend Engineer" />
                    </Field>
                    <Field label="Years of experience">
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        value={p.experienceYears ?? ''}
                        onChange={(e) => setP({ ...p, experienceYears: e.target.value === '' ? undefined : Number(e.target.value) })}
                        placeholder="e.g. 4"
                      />
                    </Field>
                    <Field label="Current company" hint="Optional">
                      <Input value={p.currentCompany} onChange={(e) => setP({ ...p, currentCompany: e.target.value })} placeholder="e.g. Acme" />
                    </Field>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="space-y-5 animate-fade-up">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">What are you going after? 🎯</h3>
                    <p className="mt-1 text-[13.5px] text-muted-foreground">Used for job searches, keyword matching and message personalization.</p>
                  </div>
                  <Field label="Target roles" hint="Press Enter after each">
                    <TagInput value={p.targetRoles} onChange={(v) => setP({ ...p, targetRoles: v })} placeholder="e.g. Senior Frontend Engineer" />
                  </Field>
                  <Field label="Preferred locations">
                    <TagInput value={p.targetLocations} onChange={(v) => setP({ ...p, targetLocations: v })} placeholder="e.g. Bengaluru, Remote" />
                  </Field>
                  <Field label="Top skills">
                    <TagInput value={p.skills} onChange={(v) => setP({ ...p, skills: v })} placeholder="e.g. React, TypeScript, SQL" />
                  </Field>
                  <Field
                    label="Your best achievement (one line, with a number)"
                    hint="Write it as an action — it slots into messages like “Recently, I …”. e.g. “cut checkout load time by 40% for 2M users”."
                  >
                    <Input value={p.achievement} onChange={(e) => setP({ ...p, achievement: e.target.value })} placeholder="e.g. grew organic signups 3× in 6 months" />
                  </Field>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-5 animate-fade-up">
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight">Set your weekly rhythm 📈</h3>
                    <p className="mt-1 text-[13.5px] text-muted-foreground">Consistency beats intensity. Pursuit tracks your pace and streaks against these goals.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Applications / week">
                      <Input type="number" min={0} value={goals.applicationsPerWeek} onChange={(e) => setGoals({ ...goals, applicationsPerWeek: Number(e.target.value) || 0 })} />
                    </Field>
                    <Field label="Outreach msgs / week">
                      <Input type="number" min={0} value={goals.outreachPerWeek} onChange={(e) => setGoals({ ...goals, outreachPerWeek: Number(e.target.value) || 0 })} />
                    </Field>
                    <Field label="Currency">
                      <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      disabled={busy}
                      onClick={() => finish(true)}
                      className="group rounded-2xl border-2 border-primary/40 bg-primary/5 p-4 text-left transition-all hover:border-primary hover:bg-primary/10 disabled:opacity-60"
                    >
                      <div className="flex items-center gap-2 font-semibold text-primary">
                        <Sparkles className="h-4 w-4" /> Explore with sample data
                      </div>
                      <p className="mt-1.5 text-[13px] text-muted-foreground">See a realistic search with 48 applications, recruiters, sequences and insights. Remove it in one click later.</p>
                    </button>
                    <button disabled={busy} onClick={() => finish(false)} className="rounded-2xl border-2 p-4 text-left transition-all hover:border-foreground/30 hover:bg-accent disabled:opacity-60">
                      <div className="flex items-center gap-2 font-semibold">
                        <Target className="h-4 w-4" /> Start fresh
                      </div>
                      <p className="mt-1.5 text-[13px] text-muted-foreground">Begin with a clean slate. Import a spreadsheet or your LinkedIn connections anytime.</p>
                    </button>
                  </div>
                  <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <Database className="h-3.5 w-3.5" /> Stored locally in your browser. Export a backup anytime from Settings.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t px-6 py-4">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              {step < 2 ? (
                <Button variant="primary" onClick={() => setStep(step + 1)}>
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <span className="text-[12px] text-muted-foreground">Pick one to finish</span>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
