import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Handshake, Linkedin, Mail, Repeat, Rocket, Search, Sparkles, Target, Timer, TrendingUp, Users, Zap, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui';

interface Play {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  tagline: string;
  steps: string[];
  cta?: { label: string; to: string };
}

const PLAYS: Play[] = [
  {
    id: 'double-tap',
    icon: Zap,
    title: 'The apply + reach-out double-tap',
    tagline: 'Never apply silently. Every application gets a human touch within 24 hours.',
    steps: [
      'Apply as normal (Easy Apply or the careers page).',
      'Open the application in Pursuit → People → “Find people at …” and locate the recruiter and the likely hiring manager.',
      'Add them as targets and enroll them in “Recruiter direct” — your connection note and email snapshot are pre-written.',
      'Applications with a person attached stand out from the pile — your analytics will show you how much for you.',
    ],
    cta: { label: 'Open sequences', to: '/outreach/sequences' },
  },
  {
    id: 'referral-3x3',
    icon: Users,
    title: 'The 3×3 referral method',
    tagline: 'For each dream company, find 3 people in 3 different roles.',
    steps: [
      'Pick your top companies and mark them “Dream” on the Companies page.',
      'For each one find: a peer in your target role, a recruiter, and an engineering/hiring manager.',
      'Warm up the peer first (react to or comment on a recent post), then connect — the “Referral hunt” sequence does this for you.',
      'Ask the peer for a referral and send a forwardable blurb (template: “Forwardable referral blurb”). Make saying yes take 2 minutes.',
    ],
    cta: { label: 'Map a company', to: '/companies' },
  },
  {
    id: 'advice-not-jobs',
    icon: Handshake,
    title: 'Ask for advice, not a job',
    tagline: '“Can I get 15 minutes of your advice?” gets far more yeses than “Do you have openings?”',
    steps: [
      'Connect with a short, specific note (mention their post, team or shared school).',
      'Ask for a 15-minute chat about how the team works — use the “15-min advice chat” template.',
      'Come prepared with 3 thoughtful questions. Don’t ask for a referral on the call.',
      'Send a thank-you within 24 hours. People who enjoyed helping often offer the referral themselves.',
    ],
    cta: { label: 'Use the template', to: '/outreach/templates' },
  },
  {
    id: 'follow-up',
    icon: Repeat,
    title: 'Follow up like a professional',
    tagline: 'Most replies come after a follow-up — but each one must add value.',
    steps: [
      'Follow-up #1 (≈4 days): a gentle, two-line bump.',
      'Follow-up #2 (≈1 week later): add value — a relevant idea, a project, or a link to something you built.',
      'Final note (≈1 week later): close the loop politely and leave the door open.',
      'Then stop. Mark them “No response” and move on — Pursuit tracks it so nothing falls through the cracks.',
    ],
  },
  {
    id: 'hiring-posts',
    icon: Search,
    title: 'Hunt “we’re hiring” posts',
    tagline: 'Hiring managers who post openings are actively asking for messages.',
    steps: [
      'Toolkit → Fresh job finder → “LinkedIn hiring posts” (sorted by latest).',
      'Comment something specific, then DM the poster within a few hours of the post.',
      'Lead with one line of proof (a number), link your work, and ask the next step.',
      'Track each poster as a target with source “LinkedIn hiring post” to see how this channel performs.',
    ],
    cta: { label: 'Open toolkit', to: '/outreach/toolkit' },
  },
  {
    id: 'hidden-market',
    icon: Target,
    title: 'Tap the hidden job market',
    tagline: 'Many roles appear on company ATS boards, X and founder networks before (or instead of) job boards.',
    steps: [
      'Use the ATS X-ray search (Greenhouse, Lever, Ashby, Workable) filtered to the past week.',
      'Follow founders and engineering leaders at startups you like on X and LinkedIn.',
      'For early-stage startups, DM the founder directly with what you’d build in your first 30 days.',
    ],
    cta: { label: 'Find hidden jobs', to: '/outreach/toolkit' },
  },
  {
    id: 'personalize',
    icon: Sparkles,
    title: 'The one-line personalization rule',
    tagline: 'One specific detail about them beats three paragraphs about you.',
    steps: [
      'Before writing, spend 2 minutes on their profile: recent posts, talks, projects, shared school or ex-company.',
      'Save it as “Common ground” on their contact card — templates insert it for you.',
      'Keep LinkedIn invite notes under ~200 characters and cold emails to roughly 75–150 words.',
      'Use the Message checker: aim for 80+ before sending.',
    ],
  },
  {
    id: 'timing',
    icon: Timer,
    title: 'Speed & timing',
    tagline: 'Fresh postings get the most attention — be early.',
    steps: [
      'Check “posted in the last 24h” searches every morning; apply to the best fits the same day.',
      'Send outreach on weekday mornings in the recipient’s time zone; avoid late Friday and weekends.',
      'Batch your work: one focused block for applications, one for outreach, one for follow-ups.',
    ],
  },
  {
    id: 'linkedin-profile',
    icon: Linkedin,
    title: 'Make your profile do the selling',
    tagline: 'Every message you send drives people to your profile.',
    steps: [
      'Headline = target role + proof (e.g. “Frontend Engineer · Cut load time 40% for 2M users”).',
      'Turn on “Open to work” (recruiters-only visibility is enough).',
      'Pin your best project or post in the Featured section.',
      'Add the skills and keywords that show up in your target JDs (use the JD matcher to find them).',
    ],
  },
  {
    id: 'naukri',
    icon: Briefcase,
    title: 'Naukri & Indian job boards',
    tagline: 'Recruiters search profiles — make yours easy to find.',
    steps: [
      'Refresh your profile regularly (even small edits) — recently updated profiles tend to surface higher in recruiter searches.',
      'Write a keyword-rich resume headline and set your notice period and CTC accurately.',
      'Reply to recruiter messages fast with the “Reply to an inbound recruiter” template — it covers CTC, notice and next steps in one go.',
      'Track Naukri, Instahyre, Cutshort and Hirist as separate platforms to see which actually converts for you.',
    ],
  },
  {
    id: 'email',
    icon: Mail,
    title: 'Cold emails that get opened',
    tagline: 'Subject + first line decide everything.',
    steps: [
      'Subject: specific and short (role + proof), under ~60 characters.',
      'First line: about them or their team — not “I hope this email finds you well”.',
      'Middle: one line of proof with a number. End: one clear, small ask.',
      'Use the Email pattern finder to find their address; send from a professional email.',
    ],
  },
  {
    id: 'iterate',
    icon: TrendingUp,
    title: 'Run it like an experiment',
    tagline: 'Measure, keep what works, kill what doesn’t.',
    steps: [
      'Duplicate a template as “variant B” and alternate between them.',
      'After ~20 sends each, check Analytics → Outreach and keep the winner.',
      'Compare platforms, resume versions and application methods weekly — shift time to what converts.',
    ],
    cta: { label: 'See analytics', to: '/analytics' },
  },
];

export default function PlaybookTab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState<string | null>('double-tap');
  return (
    <div className="space-y-4">
      <Card className="flex items-start gap-4 overflow-hidden bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-transparent p-5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <Rocket className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-[15px] font-semibold">The outreach playbook</h3>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
            Applying alone is a lottery. The candidates who land offers fastest combine targeted applications with relentless, well-crafted outreach — and track everything. These plays are wired into Pursuit’s templates, sequences and toolkit.
          </p>
        </div>
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        {PLAYS.map((p) => {
          const isOpen = open === p.id;
          return (
            <Card key={p.id} className={cn('overflow-hidden transition-shadow', isOpen && 'shadow-lift ring-1 ring-primary/20')}>
              <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : p.id)} aria-expanded={isOpen}>
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <p.icon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold">{p.title}</div>
                  <div className="mt-0.5 text-[12.5px] text-muted-foreground">{p.tagline}</div>
                </div>
                <ChevronDown className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="border-t px-4 pb-4 pt-3">
                  <ol className="space-y-2">
                    {p.steps.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold">{i + 1}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                  {p.cta && (
                    <button onClick={() => navigate(p.cta!.to)} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
                      {p.cta.label} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
