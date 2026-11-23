import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bell, Bookmark, Check, Database, Download, FileUp, Info, Palette, Save, Settings as SettingsIcon, Shield, Sparkles, Target, Trash2, Upload, User, MousePointerClick } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '@/lib/hooks';
import { useData } from '@/lib/data';
import { updateSettings } from '@/lib/db';
import { confirmDialog } from '@/lib/store';
import { removeSampleData, resetAllData } from '@/lib/actions';
import { loadSampleData } from '@/lib/seed';
import { exportApplicationsCSV, exportBackup, exportContactsCSV, importBackup } from '@/lib/io';
import { bookmarkletHref } from '@/lib/toolkit';
import { ACCENTS, CURRENCIES } from '@/lib/constants';
import type { Profile, ThemePref } from '@/lib/types';
import { bytes, cn, fmtDateTime, relDay } from '@/lib/utils';
import { Button, Card, CardHeader, Field, Input, Segmented, Select, Switch, Tabs, Textarea } from '@/components/ui';
import { TagInput } from '@/components/fields';
import { PageHeader } from '@/components/common';

type Tab = 'profile' | 'automation' | 'appearance' | 'data' | 'capture';

export default function SettingsPage() {
  const { tab = 'profile' } = useParams();
  const navigate = useNavigate();
  return (
    <div className="page max-w-[1100px]">
      <PageHeader icon={<SettingsIcon className="h-5 w-5" />} title="Settings" subtitle="Your profile powers every template, keyword match and insight." />
      <Tabs
        className="mb-5"
        value={tab as Tab}
        onChange={(t) => navigate(`/settings/${t}`)}
        tabs={[
          { id: 'profile', label: 'Profile', icon: <User className="h-4 w-4" /> },
          { id: 'automation', label: 'Goals & automation', icon: <Target className="h-4 w-4" /> },
          { id: 'appearance', label: 'Appearance', icon: <Palette className="h-4 w-4" /> },
          { id: 'capture', label: 'Quick capture', icon: <Bookmark className="h-4 w-4" /> },
          { id: 'data', label: 'Data & backup', icon: <Database className="h-4 w-4" /> },
        ]}
      />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'automation' && <AutomationTab />}
      {tab === 'appearance' && <AppearanceTab />}
      {tab === 'capture' && <CaptureTab />}
      {tab === 'data' && <DataTab />}
    </div>
  );
}

function ProfileTab() {
  const settings = useSettings();
  const [p, setP] = useState<Profile>(settings.profile);
  const dirty = JSON.stringify(p) !== JSON.stringify(settings.profile);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));
  const save = async () => {
    await updateSettings({ profile: p });
    toast.success('Profile saved — templates updated');
  };
  const completeness = [p.name, p.currentRole, p.experienceYears !== undefined, p.skills.length, p.targetRoles.length, p.achievement, p.linkedin, p.resumeText, p.pitch, p.email].filter(Boolean).length * 10;
  return (
    <div className="space-y-4 pb-20">
      <Card className="flex items-center gap-4 p-4">
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500 transition-[width]" style={{ width: `${completeness}%` }} />
        </div>
        <span className="text-[13px] font-medium">{completeness}% complete</span>
      </Card>
      <Card>
        <CardHeader title="About you" icon={<User className="h-4 w-4" />} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={p.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label="Headline" hint="How you’d describe yourself in one line">
            <Input value={p.headline} onChange={(e) => set('headline', e.target.value)} placeholder="Frontend Engineer · React & performance" />
          </Field>
          <Field label="Current role">
            <Input value={p.currentRole} onChange={(e) => set('currentRole', e.target.value)} />
          </Field>
          <Field label="Current company">
            <Input value={p.currentCompany} onChange={(e) => set('currentCompany', e.target.value)} />
          </Field>
          <Field label="Years of experience">
            <Input type="number" min={0} value={p.experienceYears ?? ''} onChange={(e) => set('experienceYears', e.target.value === '' ? undefined : Number(e.target.value))} />
          </Field>
          <Field label="School / college" hint="Used for alumni searches & templates">
            <Input value={p.school} onChange={(e) => set('school', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input type="email" value={p.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={p.phone} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="LinkedIn">
            <Input value={p.linkedin} onChange={(e) => set('linkedin', e.target.value)} placeholder="linkedin.com/in/…" />
          </Field>
          <Field label="Portfolio / GitHub">
            <Input value={p.portfolio || p.github} onChange={(e) => set('portfolio', e.target.value)} placeholder="github.com/… or yoursite.com" />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="What you’re looking for" icon={<Target className="h-4 w-4" />} />
        <div className="grid gap-4 p-5">
          <Field label="Target roles">
            <TagInput value={p.targetRoles} onChange={(v) => set('targetRoles', v)} placeholder="e.g. Senior Frontend Engineer" />
          </Field>
          <Field label="Preferred locations">
            <TagInput value={p.targetLocations} onChange={(v) => set('targetLocations', v)} placeholder="e.g. Bengaluru, Remote" />
          </Field>
          <Field label="Skills" hint="Your top 3 fill {{mySkills}} in templates; all are used for JD keyword matching.">
            <TagInput value={p.skills} onChange={(v) => set('skills', v)} placeholder="e.g. React" />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Proof & pitch" subtitle="The two lines that make cold outreach work" icon={<Sparkles className="h-4 w-4" />} />
        <div className="grid gap-4 p-5">
          <Field label="Best achievement — {{myAchievement}}" hint="Start with a verb, include a number: “cut checkout load time by 40% for 2M+ users”.">
            <Input value={p.achievement} onChange={(e) => set('achievement', e.target.value)} />
          </Field>
          <Field label="Elevator pitch — {{myPitch}}">
            <Textarea value={p.pitch} onChange={(e) => set('pitch', e.target.value)} placeholder="One or two sentences on who you are and what you’re great at." />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Compensation & availability" subtitle="Used in recruiter replies (common on Naukri & with Indian recruiters)" icon={<Info className="h-4 w-4" />} />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <Field label="Notice period">
            <Input value={p.noticePeriod} onChange={(e) => set('noticePeriod', e.target.value)} placeholder="e.g. 30 days (negotiable)" />
          </Field>
          <Field label="Current CTC">
            <Input value={p.currentCtc} onChange={(e) => set('currentCtc', e.target.value)} placeholder="e.g. 18 LPA" />
          </Field>
          <Field label="Expected CTC">
            <Input value={p.expectedCtc} onChange={(e) => set('expectedCtc', e.target.value)} placeholder="e.g. 28–32 LPA" />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Resume text" subtitle="Paste your resume as plain text — used only for JD keyword matching, never leaves your device." icon={<FileUp className="h-4 w-4" />} />
        <div className="p-5">
          <Textarea value={p.resumeText} onChange={(e) => set('resumeText', e.target.value)} className="min-h-[180px] font-mono text-[12.5px]" maxRows={24} placeholder="Copy everything from your resume and paste it here…" />
        </div>
      </Card>
      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-30 mx-auto flex w-fit items-center gap-3 rounded-2xl border bg-popover px-4 py-2.5 shadow-2xl animate-fade-up lg:bottom-6">
          <span className="text-[13px]">You have unsaved changes</span>
          <Button size="sm" variant="ghost" onClick={() => setP(settings.profile)}>
            Discard
          </Button>
          <Button size="sm" variant="primary" onClick={save}>
            <Save className="h-3.5 w-3.5" /> Save profile
          </Button>
        </div>
      )}
    </div>
  );
}

function NumberField({ label, hint, value, onChange, min = 0, max = 365, suffix }: { label: string; hint?: string; value: number; onChange: (v: number) => void; min?: number; max?: number; suffix?: string }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <Input type="number" min={min} max={max} value={value} onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} className={suffix ? 'pr-14' : ''} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-muted-foreground">{suffix}</span>}
      </div>
    </Field>
  );
}

function AutomationTab() {
  const s = useSettings();
  const perm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Weekly goals" subtitle="Drive your pace tracking, streaks and dashboard rings" icon={<Target className="h-4 w-4" />} />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <NumberField label="Applications per week" value={s.goals.applicationsPerWeek} onChange={(v) => updateSettings({ goals: { applicationsPerWeek: v } })} max={200} />
          <NumberField label="Outreach messages per week" value={s.goals.outreachPerWeek} onChange={(v) => updateSettings({ goals: { outreachPerWeek: v } })} max={500} />
          <NumberField label="Daily outreach target" value={s.goals.dailyOutreach} onChange={(v) => updateSettings({ goals: { dailyOutreach: v } })} max={100} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Automation" subtitle="Pursuit schedules reminders and flags stale items for you" icon={<Sparkles className="h-4 w-4" />} />
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <NumberField label="Follow up on applications after" hint="Auto-reminder when you mark something Applied" value={s.followUpDays} onChange={(v) => updateSettings({ followUpDays: v })} min={1} max={60} suffix="days" />
          <NumberField label="Consider ghosted after" hint="No response → flagged as likely ghosted" value={s.ghostDays} onChange={(v) => updateSettings({ ghostDays: v })} min={3} max={120} suffix="days" />
          <NumberField label="Wishlist goes stale after" hint="Nudges you to apply while postings are fresh" value={s.staleWishlistDays} onChange={(v) => updateSettings({ staleWishlistDays: v })} min={1} max={60} suffix="days" />
          <Field label="Week starts on">
            <Segmented
              value={String(s.weekStartsOn) as '0' | '1'}
              onChange={(v) => updateSettings({ weekStartsOn: Number(v) as 0 | 1 })}
              options={[
                { id: '1', label: 'Monday' },
                { id: '0', label: 'Sunday' },
              ]}
            />
          </Field>
          <Field label="Default currency">
            <Select value={s.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Reminders" icon={<Bell className="h-4 w-4" />} />
        <div className="flex items-center justify-between gap-4 p-5">
          <div>
            <div className="text-[13.5px] font-medium">Desktop notifications</div>
            <p className="text-[12.5px] text-muted-foreground">Get a daily nudge with what’s due when you open Pursuit. {perm === 'denied' && 'Notifications are blocked in your browser settings.'}</p>
          </div>
          <Switch
            checked={s.notifications && perm === 'granted'}
            onChange={async (v) => {
              if (!v) return updateSettings({ notifications: false });
              if (typeof Notification === 'undefined') return toast.error('Notifications are not supported in this browser');
              const r = await Notification.requestPermission();
              if (r === 'granted') {
                await updateSettings({ notifications: true });
                new Notification('Pursuit reminders are on', { body: 'You’ll get a nudge when follow-ups are due.' });
              } else toast.error('Permission not granted');
            }}
            label="Desktop notifications"
          />
        </div>
      </Card>
    </div>
  );
}

function AppearanceTab() {
  const s = useSettings();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Theme" icon={<Palette className="h-4 w-4" />} />
        <div className="space-y-5 p-5">
          <Field label="Mode">
            <Segmented
              value={s.theme}
              onChange={(v: ThemePref) => updateSettings({ theme: v })}
              options={[
                { id: 'system', label: 'System' },
                { id: 'light', label: 'Light' },
                { id: 'dark', label: 'Dark' },
              ]}
            />
          </Field>
          <Field label="Accent color">
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => updateSettings({ accent: a.id })}
                  className={cn('flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[13px] transition-all', s.accent === a.id ? 'border-foreground/30 bg-accent font-medium' : 'hover:bg-accent')}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: a.swatch }}>
                    {s.accent === a.id && <Check className="h-3.5 w-3.5 text-white" />}
                  </span>
                  {a.label}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13.5px] font-medium">Company logos</div>
              <p className="text-[12.5px] text-muted-foreground">Fetches favicons for companies with a website set. Turn off to use initials only (fully offline).</p>
            </div>
            <Switch checked={s.showLogos} onChange={(v) => updateSettings({ showLogos: v })} label="Company logos" />
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Custom platforms" subtitle="Add any job source you use that isn’t in the list (e.g. a WhatsApp group, a niche board)." icon={<Sparkles className="h-4 w-4" />} />
        <div className="p-5">
          <TagInput value={s.customPlatforms} onChange={(v) => updateSettings({ customPlatforms: v })} placeholder="e.g. Frontend Jobs Telegram" />
        </div>
      </Card>
    </div>
  );
}

function CaptureTab() {
  const ref = useRef<HTMLAnchorElement>(null);
  const appUrl = `${location.origin}${location.pathname}`;
  useEffect(() => {
    ref.current?.setAttribute('href', bookmarkletHref(appUrl));
  }, [appUrl]);
  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-fuchsia-500/5 to-transparent p-6">
          <div className="flex items-center gap-2 text-[15px] font-semibold">
            <MousePointerClick className="h-5 w-5 text-primary" /> Save jobs from any site in one click
          </div>
          <p className="mt-1 max-w-2xl text-[13.5px] text-muted-foreground">
            Drag the button below to your bookmarks bar. On any job posting — LinkedIn, Naukri, Indeed, Wellfound, a company careers page — click it and Pursuit opens with the job pre-filled (title, company, link and platform). Select the job description text first to capture it too.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <a
              ref={ref}
              onClick={(e) => {
                e.preventDefault();
                toast('Drag this button to your bookmarks bar', { description: 'Clicking it here does nothing — use it on a job page.' });
              }}
              className="inline-flex cursor-grab items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-4 py-2.5 text-[14px] font-semibold text-white shadow-lg shadow-indigo-500/30 active:cursor-grabbing"
            >
              <Bookmark className="h-4 w-4" /> + Save to Pursuit
            </a>
            <span className="text-[12.5px] text-muted-foreground">← drag me to your bookmarks bar (Ctrl/⌘ + Shift + B shows it)</span>
          </div>
        </div>
        <div className="grid gap-4 border-t p-6 sm:grid-cols-3">
          {[
            ['1', 'Open a job posting', 'On LinkedIn, Naukri, Indeed or any careers page.'],
            ['2', 'Optionally select the JD', 'Highlight the description text to capture it for keyword matching.'],
            ['3', 'Click “Save to Pursuit”', 'Review the pre-filled form, pick Wishlist or Applied, save.'],
          ].map(([n, t, d]) => (
            <div key={n} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary">{n}</span>
              <div>
                <div className="text-[13.5px] font-medium">{t}</div>
                <div className="text-[12.5px] text-muted-foreground">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <p className="text-[12.5px] text-muted-foreground">
        The bookmark points to this exact address ({appUrl}). If you move Pursuit to another URL (e.g. after deploying), re-add the button from there.
      </p>
    </div>
  );
}

function DataTab() {
  const s = useSettings();
  const { apps, contacts } = useData();
  const [usage, setUsage] = useState<{ used: number; quota: number; persisted: boolean } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    (async () => {
      if (!navigator.storage?.estimate) return;
      const e = await navigator.storage.estimate();
      const persisted = (await navigator.storage.persisted?.()) ?? false;
      setUsage({ used: e.usage ?? 0, quota: e.quota ?? 0, persisted });
    })();
  }, [apps.length, contacts.length]);

  const onImport = async (f?: File) => {
    if (!f) return;
    if (mode === 'replace') {
      const ok = await confirmDialog({ title: 'Replace all data with this backup?', description: 'Everything currently in Pursuit will be overwritten.', confirmLabel: 'Replace', danger: true });
      if (!ok) return;
    }
    setBusy(true);
    try {
      const n = await importBackup(f, mode);
      toast.success(`Imported ${n} records`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const daysSinceBackup = s.lastBackupAt ? Math.floor((Date.now() - new Date(s.lastBackupAt).getTime()) / 864e5) : null;

  return (
    <div className="space-y-4">
      <Card className="flex items-start gap-3 border-emerald-500/25 bg-emerald-500/[0.05] p-4">
        <Shield className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="text-[13px]">
          <div className="font-semibold">Private by design</div>
          <p className="text-muted-foreground">
            Everything lives in this browser’s storage (IndexedDB) — no account, no server, no tracking. That also means clearing site data deletes it, so export a backup regularly.
            {usage && ` Using ${bytes(usage.used)}${usage.persisted ? ' · persistent storage granted' : ''}.`}
          </p>
        </div>
      </Card>
      <Card>
        <CardHeader title="Backup" subtitle={s.lastBackupAt ? `Last backup ${relDay(s.lastBackupAt)} (${fmtDateTime(s.lastBackupAt)})` : 'You haven’t exported a backup yet'} icon={<Download className="h-4 w-4" />} />
        <div className="space-y-4 p-5">
          {(daysSinceBackup === null || daysSinceBackup > 7) && (apps.length > 0 || contacts.length > 0) && (
            <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[13px] text-amber-700 dark:text-amber-300">Tip: export a backup weekly — it takes one click and protects weeks of work.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => exportBackup().then(() => toast.success('Backup downloaded'))}>
              <Download className="h-4 w-4" /> Export full backup (.json)
            </Button>
            <Button variant="secondary" onClick={() => exportApplicationsCSV(apps)}>
              Applications CSV
            </Button>
            <Button variant="secondary" onClick={() => exportContactsCSV(contacts)}>
              Contacts CSV
            </Button>
          </div>
          <div className="rounded-xl border p-4">
            <div className="text-[13.5px] font-medium">Restore from backup</div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">Move your data to another browser or device.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { id: 'merge', label: 'Merge' },
                  { id: 'replace', label: 'Replace everything' },
                ]}
              />
              <label className={cn('inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3.5 text-sm font-medium shadow-soft hover:bg-accent', busy && 'pointer-events-none opacity-60')}>
                <Upload className="h-4 w-4" /> {busy ? 'Importing…' : 'Choose backup file'}
                <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => onImport(e.target.files?.[0])} />
              </label>
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Sample data" icon={<Sparkles className="h-4 w-4" />} />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-[13px] text-muted-foreground">{s.sampleLoaded ? 'Sample data is loaded. Remove it when you’re ready — your own entries are kept.' : 'Load a realistic demo search to explore every feature.'}</p>
          {s.sampleLoaded ? (
            <Button
              variant="secondary"
              onClick={async () => {
                const ok = await confirmDialog({ title: 'Remove sample data?', description: 'Only demo records are removed. Anything you added yourself stays.', confirmLabel: 'Remove' });
                if (ok) {
                  await removeSampleData();
                  toast.success('Sample data removed');
                }
              }}
            >
              Remove sample data
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={async () => {
                await loadSampleData();
                toast.success('Sample data loaded');
              }}
            >
              Load sample data
            </Button>
          )}
        </div>
      </Card>
      <Card className="border-rose-500/30">
        <CardHeader title="Danger zone" icon={<Trash2 className="h-4 w-4" />} />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-[13px] text-muted-foreground">Permanently delete all applications, contacts, outreach history, documents and settings from this browser.</p>
          <Button
            variant="danger"
            onClick={async () => {
              const ok = await confirmDialog({ title: 'Delete everything?', description: 'This cannot be undone. Export a backup first if you might need it.', confirmLabel: 'Delete everything', danger: true });
              if (!ok) return;
              await resetAllData();
              toast.success('All data deleted');
            }}
          >
            Reset everything
          </Button>
        </div>
      </Card>
    </div>
  );
}
