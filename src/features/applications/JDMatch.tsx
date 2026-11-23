import * as React from 'react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CircleCheck, CircleX, Info, Sparkles } from 'lucide-react';
import { useSettings } from '@/lib/hooks';
import { matchJD } from '@/lib/toolkit';
import { cn } from '@/lib/utils';
import { ProgressRing } from '@/components/ui';

export function JDMatchPanel({ jd, compact }: { jd: string; compact?: boolean }) {
  const settings = useSettings();
  const m = useMemo(() => matchJD(jd, settings.profile), [jd, settings.profile]);
  if (!jd.trim()) return null;
  const tone = m.score >= 75 ? 'text-emerald-600 dark:text-emerald-400' : m.score >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400';
  const bar = m.score >= 75 ? 'stroke-emerald-500' : m.score >= 50 ? 'stroke-amber-500' : 'stroke-rose-500';
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
        <ProgressRing value={m.score} max={100} size={compact ? 64 : 76} barClass={bar} trackClass="stroke-muted">
          <span className={cn('text-lg font-semibold', tone)}>{m.score}%</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Keyword match
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {m.matched.length} of {m.matched.length + m.missing.length} skills in this JD appear in your profile.{' '}
            {m.missing.length > 0 ? 'Weave the missing ones you genuinely have into your resume bullets before applying.' : 'Great coverage — tailor your top bullets to their wording.'}
          </p>
          {!m.hasProfile && (
            <p className="mt-1.5 flex items-center gap-1 text-[12px] text-amber-600 dark:text-amber-400">
              <Info className="h-3.5 w-3.5" /> Add skills & resume text in{' '}
              <Link to="/settings/profile" className="underline">
                Settings → Profile
              </Link>{' '}
              for accurate matching.
            </p>
          )}
        </div>
      </div>
      {m.missing.length > 0 && (
        <div>
          <div className="label-caps mb-2 flex items-center gap-1.5">
            <CircleX className="h-3.5 w-3.5 text-rose-500" /> Missing from your profile
          </div>
          <div className="flex flex-wrap gap-1.5">
            {m.missing.map((k) => (
              <span key={k.term} className="rounded-md bg-rose-500/10 px-2 py-0.5 text-[12px] font-medium text-rose-700 ring-1 ring-inset ring-rose-500/20 dark:text-rose-300">
                {k.term}
                {k.count > 1 && <span className="ml-1 opacity-60">×{k.count}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      {m.matched.length > 0 && (
        <div>
          <div className="label-caps mb-2 flex items-center gap-1.5">
            <CircleCheck className="h-3.5 w-3.5 text-emerald-500" /> You have
          </div>
          <div className="flex flex-wrap gap-1.5">
            {m.matched.map((k) => (
              <span key={k.term} className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[12px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/25 dark:text-emerald-300">
                {k.term}
                {k.count > 1 && <span className="ml-1 opacity-60">×{k.count}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
      {m.frequent.length > 0 && (
        <div>
          <div className="label-caps mb-2">Their language (repeated words)</div>
          <div className="flex flex-wrap gap-1.5">
            {m.frequent.map((k) => (
              <span
                key={k.term}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[12px] ring-1 ring-inset',
                  k.inResume ? 'bg-muted text-foreground ring-border' : 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300',
                )}
                title={k.inResume ? 'Also in your resume' : 'Not in your resume yet'}
              >
                {k.term} <span className="opacity-60">×{k.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
