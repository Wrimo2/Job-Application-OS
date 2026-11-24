# Pursuit — Job Search OS

A local-first web app that turns a job search into a system: track every application from every platform, run cold-outreach sequences, manage your network like a CRM, prepare for interviews, compare offers — and see in your own data what actually works.

> **Private by design.** Everything is stored in your browser (IndexedDB). No account, no server, no tracking. Export a backup any time.

**Try it live: https://wrimo2.github.io/Job-Application-OS/** — nothing to install. New to the app? Read the [User Guide](Pursuit-User-Guide.docx).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build (static files, works from any host or sub-folder):

```bash
npm run build      # outputs to dist/
npm run preview
```

On first launch an onboarding wizard sets up your profile and weekly goals, and offers a realistic **sample dataset** (removable in one click from Settings → Data & backup).

## What's inside

### Command center (Dashboard)
- Today's game plan: overdue + due follow-ups, sequence steps, interviews, thank-you notes and tasks — each with one-click **Write / Done / Snooze**.
- KPI tiles with 30-day deltas and sparklines, weekly goal rings, daily outreach target, streaks.
- **"What to do next" insights** generated from your data (stale applications, likely ghosting, best platform, referral power, resume A/B winner, rejection patterns, interview prep gaps, offer deadlines, going-cold contacts…).
- Pipeline snapshot, upcoming interviews, consistency heatmap, platform traction.

### Applications
- Kanban board (drag & drop, touch & keyboard friendly) and sortable table with bulk actions.
- Smart filters: needs action, no reply in N days, likely ghosted, interviewing, offers, wishlist…
- **Paste a job link** → platform, apply method and company auto-detected (LinkedIn, Naukri, Indeed, Wellfound, Instahyre, Cutshort, Glassdoor, Foundit, IIMJobs, Hirist, Internshala, Greenhouse, Lever, Ashby, Workday… plus custom platforms).
- Duplicate detection, "you know people at this company" referral nudges, automatic follow-up reminders, stage history, response-time tracking, rejection reasons.
- Detail drawer: stage stepper, next step, activity timeline, interviews, linked people, **JD keyword match** against your skills/resume, notes, company research links.
- Import your existing tracker from CSV (auto column mapping); export to CSV.

### Outreach engine
- **Composer**: pick a person + job + template → message is personalized from your profile, their contact card and the job. Live **message-quality score** (length per channel, personalization, proof, clear ask, clichés…), character limits, "Copy & mark sent", open Gmail / LinkedIn / WhatsApp.
- 20 battle-tested templates (connection notes, referral asks, recruiter/hiring-manager emails, follow-ups, thank-yous, negotiation) with per-template **response-rate tracking** and A/B duplicates.
- **Sequences**: multi-step cadences (referral hunt, recruiter direct, hiring-manager email, informational chat, warm reconnect, founder outreach). Steps land in your queue on the right day, pre-drafted; replies stop the sequence automatically.
- Toolkit: Boolean **people finder** (recruiters, hiring managers, peers, alumni, founders), **fresh-job finder** (LinkedIn last 24h, hiring posts, Naukri, hidden ATS jobs via Google X-ray, X/Twitter, startup boards), **email-pattern finder**, message checker, resume-vs-JD matcher.
- Playbook: practical strategies (apply + reach-out double tap, 3×3 referral method, advice-not-jobs, follow-up rules, hidden job market, Naukri tips…).

### Network CRM
- Contacts with relationship, warmth, pipeline stage, personalization hooks, timeline of every touch (with editable outcomes), follow-up dates and sequence status.
- List and pipeline-board views, quick filters (to reach out, awaiting reply, follow-up due, referrers, going cold…), bulk enroll.
- **Import LinkedIn connections** (Connections.csv) to see who you already know everywhere.
- Companies: Dream / Target / Backup tiers, people & applications per company, team-mapping searches, "where your network already is".

### Interviews & offers
- Interview scheduling with prep checklists, calendar export (.ics / Google Calendar), outcome + reflection, thank-you reminders.
- Question bank (auto-filled from interviews) with flashcard practice, and a STAR story library with competency coverage gaps.
- Offer comparison: first-year vs recurring value, compensation breakdown, weighted scoring by what matters to you, negotiation draft.

### Analytics
Funnel, application-flow Sankey, platform/method/resume/work-mode performance, weekly effort vs results, time-to-response, rejection stages & reasons, best weekday, outreach response by template/channel/person type, consistency heatmap — every chart with a table view.

### Everything else
- Agenda across all item types · Documents (resume versions with performance) & answer library for application forms.
- One-click **quick-capture bookmarklet** (Settings → Quick capture) — save any job page to Pursuit.
- Command palette (Ctrl/⌘ K), keyboard shortcuts (`?`), dark/light/system themes, 6 accent colors, mobile layout, desktop notifications, offline PWA, JSON backup/restore.

## Tech

React 18 · TypeScript · Vite · Tailwind CSS · Dexie (IndexedDB) · Recharts · dnd-kit · Radix UI · cmdk · sonner · date-fns.

```
src/
  lib/            data model, Dexie DB, actions (all writes), stats & insights engines,
                  outreach templates/sequences/analyzer, toolkit (search builders, JD matcher), import/export, sample data
  components/     design system (ui, overlays, fields, charts, board), layout, command palette, onboarding
  features/       dashboard, agenda, applications, contacts, companies, outreach, interviews, offers, analytics, documents, settings, capture
```
