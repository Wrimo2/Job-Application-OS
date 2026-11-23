import * as React from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { subDays } from 'date-fns';
import { ChartColumn, Download, Flame, Sparkles } from 'lucide-react';
import { useData } from '@/lib/data';
import { useLocalState, useSettings } from '@/lib/hooks';
import { CHANNEL_LABEL, KIND_LABEL, METHOD_MAP, RELATIONSHIP_MAP, platformMeta } from '@/lib/constants';
import { generateInsights } from '@/lib/insights';
import {
  activityByDay,
  breakdownBy,
  closedFrom,
  daysSinceApplied,
  funnel,
  isApplied,
  isPositive,
  outreachStats,
  periodKPIs,
  reachedOffer,
  rejectionBreakdown,
  responseTimeBuckets,
  streak,
  weekdayPerformance,
  weeklySeries,
  type Breakdown,
} from '@/lib/stats';
import type { Application, Interaction } from '@/lib/types';
import { fmtPct, median, plural, responseDaysLabel, toDate } from './util';
import { Button, Card, CardHeader, Segmented } from '@/components/ui';
import { PageHeader, StatTile } from '@/components/common';
import { ActivityHeatmap, BarList, ChartCard, ColumnChart, FlowSankey, Funnel, GroupedBars, Lines, MiniTable } from '@/components/charts';
import { InsightCard } from '@/features/dashboard/DashboardPage';
import { exportApplicationsCSV } from '@/lib/io';

type Range = '30' | '90' | '180' | 'all';

export default function AnalyticsPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const data = useData();
  const { apps: allApps, interactions: allTouches, interviews, contacts, templates, documents, tasks, enrollments, offers, now } = data;
  const [range, setRange] = useLocalState<Range>('analytics.range', '90');

  const from = range === 'all' ? new Date(0) : subDays(now, Number(range));
  const inRange = (iso?: string) => {
    const d = toDate(iso);
    return !!d && d >= from;
  };
  const apps = useMemo(() => allApps.filter((a) => (isApplied(a) ? inRange(a.appliedAt) : inRange(a.createdAt))), [allApps, range, now]); // eslint-disable-line react-hooks/exhaustive-deps
  const touches = useMemo(() => allTouches.filter((i) => inRange(i.date)), [allTouches, range, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => periodKPIs(allApps, allTouches, interviews, from, now), [allApps, allTouches, interviews, from.getTime(), now]); // eslint-disable-line react-hooks/exhaustive-deps
  const prevKpi = useMemo(() => {
    if (range === 'all') return null;
    const days = Number(range);
    return periodKPIs(allApps, allTouches, interviews, subDays(now, days * 2), subDays(now, days));
  }, [allApps, allTouches, interviews, range, now]);
  const d = (a: number | null, b: number | null | undefined) => (a === null || b === null || b === undefined ? null : a - b);

  const steps = useMemo(() => funnel(apps), [apps]);
  const byPlatform = useMemo(() => breakdownBy(apps, (a) => a.platform, (k) => platformMeta(k).label), [apps]);
  const byMethod = useMemo(() => breakdownBy(apps, (a) => a.method, (k) => METHOD_MAP[k as Application['method']]?.label ?? k), [apps]);
  const byResume = useMemo(() => breakdownBy(apps.filter((a) => a.resumeId), (a) => a.resumeId, (k) => documents.find((x) => x.id === k)?.name ?? 'Deleted resume'), [apps, documents]);
  const byMode = useMemo(() => breakdownBy(apps.filter((a) => a.workMode), (a) => a.workMode, (k) => k[0].toUpperCase() + k.slice(1)), [apps]);
  const weeks = useMemo(() => weeklySeries(allApps, allTouches, interviews, range === '30' ? 6 : range === '90' ? 13 : range === '180' ? 26 : 26, settings.weekStartsOn, now), [allApps, allTouches, interviews, range, settings.weekStartsOn, now]);
  const rejections = useMemo(() => rejectionBreakdown(apps), [apps]);
  const reasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of apps) if (a.status === 'rejected' && a.rejectionReason) m.set(a.rejectionReason, (m.get(a.rejectionReason) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [apps]);
  const rt = useMemo(() => responseTimeBuckets(apps), [apps]);
  const os = useMemo(() => outreachStats(touches, contacts, templates), [touches, contacts, templates]);
  const weekdays = useMemo(() => weekdayPerformance(apps), [apps]);
  const activity = useMemo(() => activityByDay(allApps, allTouches, interviews, tasks), [allApps, allTouches, interviews, tasks]);
  const st = useMemo(() => streak(activity, now), [activity, now]);
  const insights = useMemo(
    () => generateInsights({ apps: allApps, contacts, interactions: allTouches, interviews, enrollments, templates, documents, offers, activity, settings, now }).filter((i) => i.tone === 'tip' || i.tone === 'win' || i.tone === 'warning'),
    [allApps, contacts, allTouches, interviews, enrollments, templates, documents, offers, activity, settings, now],
  );

  const sankey = useMemo(() => buildSankey(apps, settings.ghostDays), [apps, settings.ghostDays]);
  const applied = apps.filter(isApplied);
  const medResp = median(applied.map((a) => (a.respondedAt && a.appliedAt ? Math.max(0, (toDate(a.respondedAt)!.getTime() - toDate(a.appliedAt)!.getTime()) / 864e5) : NaN)).filter((x) => Number.isFinite(x)));

  const rateRows = (rows: Breakdown[], min = 1) =>
    rows
      .filter((r) => r.total >= min)
      .sort((a, b) => (b.positiveRate ?? 0) - (a.positiveRate ?? 0))
      .map((r) => ({ key: r.key, label: r.label, value: r.positiveRate ?? 0, display: fmtPct(r.positiveRate), sub: `${r.positive}/${r.total}` }));

  return (
    <div className="page space-y-5">
      <PageHeader
        icon={<ChartColumn className="h-5 w-5" />}
        title="Analytics"
        subtitle="What’s working, what isn’t, and where to spend your next hour."
        actions={
          <>
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { id: '30', label: '30d' },
                { id: '90', label: '90d' },
                { id: '180', label: '6mo' },
                { id: 'all', label: 'All' },
              ]}
            />
            <Button size="sm" variant="secondary" onClick={() => exportApplicationsCSV(apps)}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        <StatTile label="Applications" value={kpi.applied} delta={d(kpi.applied, prevKpi?.applied)} sub={prevKpi ? <span>vs prev period</span> : undefined} />
        <StatTile label="Response rate" value={fmtPct(kpi.responseRate)} delta={d(kpi.responseRate, prevKpi?.responseRate)} sub={<span>{kpi.responses} responses</span>} />
        <StatTile label="Screening+ rate" value={fmtPct(kpi.positiveRate)} delta={d(kpi.positiveRate, prevKpi?.positiveRate)} sub={<span>{kpi.positives} positive</span>} />
        <StatTile label="Interviews" value={kpi.interviews} delta={d(kpi.interviews, prevKpi?.interviews)} sub={<span>{kpi.offers} offers</span>} />
        <StatTile label="Outreach sent" value={kpi.outreach} delta={d(kpi.outreach, prevKpi?.outreach)} sub={<span>{kpi.replies} responses</span>} />
        <StatTile label="Median reply time" value={medResp !== null ? `${Math.round(medResp)}d` : '—'} sub={<span>from applying</span>} />
      </div>

      {insights.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Insights from your data
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {insights.slice(0, 6).map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-2"
          title="Conversion funnel"
          subtitle="Share of applications reaching each stage"
          table={<MiniTable head={['Stage', 'Count', '% of applied', 'Step conv.']} rows={steps.map((s) => [s.label, s.count, fmtPct(s.ofTop), fmtPct(s.fromPrev)])} />}
        >
          <Funnel steps={steps} onSelect={() => navigate('/applications')} />
        </ChartCard>
        <ChartCard className="xl:col-span-3" title="Where applications end up" subtitle="Source → first response → outcome. Hover a band for counts.">
          <FlowSankey nodes={sankey.nodes} links={sankey.links} height={300} />
        </ChartCard>
      </div>

      <Card>
        <CardHeader title="Platform performance" subtitle="Which job boards and channels actually convert — for you" icon={<ChartColumn className="h-4 w-4" />} />
        <div className="overflow-x-auto p-4 sm:p-5">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b text-left text-[12px] text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Platform</th>
                <th className="py-2 pr-3 text-right font-medium">Applied</th>
                <th className="py-2 pr-3 text-right font-medium">Response</th>
                <th className="py-2 pr-3 font-medium">Screening+ rate</th>
                <th className="py-2 pr-3 text-right font-medium">Interviews</th>
                <th className="py-2 pr-3 text-right font-medium">Offers</th>
                <th className="py-2 text-right font-medium">Median reply</th>
              </tr>
            </thead>
            <tbody>
              {byPlatform.map((p) => (
                <tr key={p.key} className="border-b last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: platformMeta(p.key).color }} />
                      {p.label}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{p.total}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtPct(p.responseRate)}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${p.positiveRate ?? 0}%`, background: 'var(--s1)' }} />
                      </div>
                      <span className="tabular-nums">{fmtPct(p.positiveRate)}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{p.interviews}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{p.offers}</td>
                  <td className="py-2.5 text-right tabular-nums text-muted-foreground">{responseDaysLabel(p.medianResponseDays)}</td>
                </tr>
              ))}
              {!byPlatform.length && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No applications in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {byPlatform.some((p) => p.total < 5) && <p className="mt-3 text-[12px] text-muted-foreground">Small samples (under ~5 applications) swing a lot — treat them as early signals.</p>}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="By application method" subtitle="Screening+ rate">
          <BarList rows={rateRows(byMethod)} max={100} />
        </ChartCard>
        <ChartCard title="By resume version" subtitle="Your resume A/B test">
          <BarList rows={rateRows(byResume)} max={100} emptyText="Pick the resume used when adding applications to compare versions." />
        </ChartCard>
        <ChartCard title="By work mode" subtitle="Screening+ rate">
          <BarList rows={rateRows(byMode)} max={100} emptyText="Set work mode on applications to compare." />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Weekly effort"
          subtitle="Applications sent vs outreach messages"
          table={<MiniTable head={['Week of', 'Applications', 'Outreach']} rows={weeks.map((w) => [w.label, w.applications, w.outreach])} />}
        >
          <GroupedBars
            data={weeks}
            series={[
              { key: 'applications', name: 'Applications', color: 'var(--s1)' },
              { key: 'outreach', name: 'Outreach', color: 'var(--s2)' },
            ]}
          />
        </ChartCard>
        <ChartCard
          title="Weekly results"
          subtitle="Responses received and interviews held"
          table={<MiniTable head={['Week of', 'Responses', 'Interviews']} rows={weeks.map((w) => [w.label, w.responses, w.interviews])} />}
        >
          <Lines
            data={weeks}
            series={[
              { key: 'responses', name: 'Responses', color: 'var(--s3)' },
              { key: 'interviews', name: 'Interviews', color: 'var(--s7)' },
            ]}
            height={240}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Time to first response" subtitle="How long companies take to reply to you" table={<MiniTable head={['Bucket', 'Applications']} rows={rt.map((r) => [r.label, r.count])} />}>
          <ColumnChart data={rt.map((r) => ({ label: r.label.replace(' days', 'd'), value: r.count }))} name="Applications" />
        </ChartCard>
        <ChartCard title="Where you get rejected" subtitle="Stage at which rejections happen">
          <BarList rows={rejections.map((r) => ({ key: r.stage, label: r.label, value: r.count }))} emptyText="No rejections in this period 🎉" />
          {reasons.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <div className="label-caps mb-2">Top reasons</div>
              <div className="flex flex-wrap gap-1.5">
                {reasons.map(([r, n]) => (
                  <span key={r} className="rounded-full bg-muted px-2.5 py-1 text-[12px]">
                    {r} <b>{n}</b>
                  </span>
                ))}
              </div>
            </div>
          )}
        </ChartCard>
        <ChartCard title="Best day to apply" subtitle="Screening+ rate by weekday you applied">
          {applied.length >= 12 ? (
            <ColumnChart data={weekdays.map((w) => ({ label: w.day, value: Math.round(w.positiveRate ?? 0) }))} name="Screening+ %" />
          ) : (
            <p className="py-8 text-center text-[13px] text-muted-foreground">Needs ~12+ applications for a meaningful pattern.</p>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Outreach — which messages work" subtitle={`${os.sent} sent · ${fmtPct(os.replyRate)} response (replies or accepted invites) · ${fmtPct(os.contactReplyRate)} of people contacted replied`} icon={<Sparkles className="h-4 w-4" />} />
          <div className="overflow-x-auto p-4 sm:p-5">
            <table className="w-full min-w-[480px] text-[13px]">
              <thead>
                <tr className="border-b text-left text-[12px] text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Template</th>
                  <th className="py-2 pr-3 text-right font-medium">Sent</th>
                  <th className="py-2 pr-3 text-right font-medium">Responses</th>
                  <th className="py-2 font-medium">Response rate</th>
                </tr>
              </thead>
              <tbody>
                {os.byTemplate
                  .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.sent - a.sent)
                  .map((t) => (
                    <tr key={t.key} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{t.label}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t.sent}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{t.replied}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full" style={{ width: `${t.rate ?? 0}%`, background: 'var(--s1)' }} />
                          </div>
                          <span className="tabular-nums">{fmtPct(t.rate)}</span>
                          {t.sent < 4 && <span className="text-[11px] text-muted-foreground">(small sample)</span>}
                        </div>
                      </td>
                    </tr>
                  ))}
                {!os.byTemplate.length && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      Send messages from the Composer and Pursuit will rank your templates here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-4">
          <ChartCard title="By channel" subtitle="Response rate">
            <BarList rows={os.byChannel.map((r) => ({ key: r.key, label: CHANNEL_LABEL[r.key as keyof typeof CHANNEL_LABEL] ?? r.key, value: r.rate ?? 0, display: fmtPct(r.rate), sub: `${r.replied}/${r.sent}` }))} max={100} />
          </ChartCard>
          <ChartCard title="By who you contact" subtitle="Response rate">
            <BarList
              rows={os.byRelationship.map((r) => ({ key: r.key, label: RELATIONSHIP_MAP[r.key as keyof typeof RELATIONSHIP_MAP]?.label ?? r.key, value: r.rate ?? 0, display: fmtPct(r.rate), sub: `${r.replied}/${r.sent}` }))}
              max={100}
            />
          </ChartCard>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader title="Consistency" subtitle="Every application, message, interview and task — last 26 weeks" icon={<Flame className="h-4 w-4" />} />
          <div className="p-5">
            <ActivityHeatmap activity={activity} weeks={26} weekStartsOn={settings.weekStartsOn} />
          </div>
        </Card>
        <ChartCard title="By message type" subtitle="Response rate">
          <BarList rows={os.byKind.map((r) => ({ key: r.key, label: KIND_LABEL[r.key as keyof typeof KIND_LABEL] ?? r.key, value: r.rate ?? 0, display: fmtPct(r.rate), sub: `${r.replied}/${r.sent}` }))} max={100} />
          <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-4 text-center">
            <div>
              <div className="text-xl font-semibold">{st.current}d</div>
              <div className="text-[11.5px] text-muted-foreground">current streak</div>
            </div>
            <div>
              <div className="text-xl font-semibold">{st.best}d</div>
              <div className="text-[11.5px] text-muted-foreground">best streak</div>
            </div>
          </div>
        </ChartCard>
      </div>

      <p className="text-center text-[12px] text-muted-foreground">
        {plural(applied.length, 'application')} and {plural(touches.filter((t) => t.direction === 'out').length, 'touchpoint')} in this period · {applied.filter(isPositive).length} reached screening · {applied.filter(reachedOffer).length} offers
      </p>
    </div>
  );
}

function buildSankey(apps: Application[], ghostDays: number) {
  const applied = apps.filter(isApplied);
  const plat = breakdownBy(applied, (a) => a.platform, (k) => platformMeta(k).label);
  const top = plat.slice(0, 5).map((p) => p.key);
  const srcKey = (a: Application) => (top.includes(a.platform) ? a.platform : 'other');
  const sources = [...top, ...(applied.some((a) => !top.includes(a.platform)) ? ['other'] : [])];
  const nodes = [
    ...sources.map((s) => ({ name: s === 'other' ? 'Other' : platformMeta(s).label, color: 'var(--chart-axis)' })),
    { name: 'Positive response', color: 'var(--s3)' },
    { name: 'Rejected at screen', color: 'var(--critical)' },
    { name: 'No response', color: '#a1a1aa' },
    { name: 'Interviewing', color: 'var(--s7)' },
    { name: 'Offer', color: 'var(--good)' },
    { name: 'Rejected later', color: 'var(--serious)' },
    { name: 'Withdrew', color: '#71717a' },
    { name: 'Still waiting', color: 'var(--s1)' },
    { name: 'Ghosted', color: '#52525b' },
  ];
  const idx = (name: string) => nodes.findIndex((n) => n.name === name);
  const S = sources.length;
  const L1 = { pos: S, rej: S + 1, none: S + 2 };
  const L2 = { interviewing: idx('Interviewing'), offer: idx('Offer'), rejLater: idx('Rejected later'), withdrew: idx('Withdrew'), waiting: idx('Still waiting'), ghosted: idx('Ghosted') };
  const counts = new Map<string, number>();
  const add = (a: number, b: number) => counts.set(`${a}-${b}`, (counts.get(`${a}-${b}`) ?? 0) + 1);
  for (const a of applied) {
    const s = sources.indexOf(srcKey(a));
    if (isPositive(a)) {
      add(s, L1.pos);
      if (reachedOffer(a)) add(L1.pos, L2.offer);
      else if (a.status === 'rejected') add(L1.pos, L2.rejLater);
      else if (a.status === 'withdrawn' || a.status === 'ghosted') add(L1.pos, L2.withdrew);
      else add(L1.pos, L2.interviewing);
    } else if (a.status === 'rejected' && closedFrom(a) === 'applied') {
      add(s, L1.rej);
    } else {
      add(s, L1.none);
      if (a.status === 'withdrawn') add(L1.none, L2.withdrew);
      else if (a.status === 'ghosted' || (daysSinceApplied(a) ?? 0) >= ghostDays) add(L1.none, L2.ghosted);
      else add(L1.none, L2.waiting);
    }
  }
  const links = [...counts.entries()].map(([k, value]) => {
    const [source, target] = k.split('-').map(Number);
    return { source, target, value };
  });
  return { nodes, links };
}

