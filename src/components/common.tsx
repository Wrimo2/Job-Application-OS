import * as React from 'react';
import { createContext, useContext, useState } from 'react';
import {
  AtSign,
  Check,
  Copy,
  Flag,
  Globe,
  Linkedin,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Twitter,
  Users,
  Briefcase,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  CONTACT_STAGE_MAP,
  RELATIONSHIP_MAP,
  STAGE_MAP,
  WARMTH_MAP,
  platformMeta,
} from '@/lib/constants';
import type { Channel, Company, ContactStage, Priority, Relationship, Stage, Warmth } from '@/lib/types';
import { cn, companyKey, copyText, dueTone, gradientFor, initials, relDay, rootDomain } from '@/lib/utils';
import { useSettings } from '@/lib/hooks';
import { Chip } from './ui';
import { Tip } from './overlay';
import { toast } from 'sonner';

/* ───────────────────────── Company logos ───────────────────────── */

export const CompaniesContext = createContext<Map<string, Company>>(new Map());
export const useCompanyMap = () => useContext(CompaniesContext);

const logoFailed = new Set<string>();
const logoLoaded = new Set<string>();

/** Company favicon with a colored monogram shown until (or instead of) the logo loading. */
export function CompanyLogo({ name, size = 36, className, rounded = 'rounded-lg' }: { name: string; size?: number; className?: string; rounded?: string }) {
  const settings = useSettings();
  const companies = useCompanyMap();
  const company = companies.get(companyKey(name));
  const domain = rootDomain(company?.website);
  const [failed, setFailed] = useState(() => !domain || logoFailed.has(domain));
  const [loaded, setLoaded] = useState(() => !!domain && logoLoaded.has(domain));
  const tryImg = settings.showLogos && !!domain && !failed;
  const showImg = tryImg && loaded;
  return (
    <div
      className={cn('relative grid shrink-0 place-items-center overflow-hidden ring-1 ring-black/5 dark:ring-white/10', rounded, showImg ? 'bg-white' : `bg-gradient-to-br ${gradientFor(name)}`, className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {!showImg && (
        <span className="font-semibold text-white" style={{ fontSize: Math.max(10, size * 0.38) }}>
          {initials(name)}
        </span>
      )}
      {tryImg && (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={cn('absolute inset-0 m-auto h-[72%] w-[72%] object-contain transition-opacity duration-300', showImg ? 'opacity-100' : 'opacity-0')}
          onLoad={(e) => {
            if (e.currentTarget.naturalWidth < 32) {
              logoFailed.add(domain);
              setFailed(true);
            } else {
              logoLoaded.add(domain);
              setLoaded(true);
            }
          }}
          onError={() => {
            logoFailed.add(domain);
            setFailed(true);
          }}
        />
      )}
    </div>
  );
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <div
      className={cn('grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-background', gradientFor(name), className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

/* ───────────────────────── Badges ───────────────────────── */

export function StageBadge({ stage, className }: { stage: Stage; className?: string }) {
  const m = STAGE_MAP[stage];
  return (
    <Chip className={cn(m.chip, className)} dotClass={m.dot} title={m.hint}>
      {m.label}
    </Chip>
  );
}

export function ContactStageBadge({ stage }: { stage: ContactStage }) {
  const m = CONTACT_STAGE_MAP[stage];
  return (
    <Chip className={m.chip} dotClass={m.dot} title={m.hint}>
      {m.label}
    </Chip>
  );
}

export function RelationshipBadge({ rel }: { rel: Relationship }) {
  const m = RELATIONSHIP_MAP[rel];
  return <Chip className={m.chip}>{m.label}</Chip>;
}

export function WarmthBadge({ warmth }: { warmth: Warmth }) {
  const m = WARMTH_MAP[warmth];
  return (
    <Chip className={m.chip}>
      {m.emoji} {m.label}
    </Chip>
  );
}

export function PlatformTag({ platform, className }: { platform: string; className?: string }) {
  const p = platformMeta(platform);
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground', className)}>
      <span className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: p.color }} />
      <span className="truncate">{p.label}</span>
    </span>
  );
}

export function PriorityFlag({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === 2) return null;
  return (
    <Tip content={priority === 3 ? 'High priority' : 'Low priority'}>
      <Flag className={cn('h-3.5 w-3.5 shrink-0', priority === 3 ? 'fill-rose-500 text-rose-500' : 'text-muted-foreground/50', className)} />
    </Tip>
  );
}

export function DueBadge({ due, prefix, className }: { due?: string; prefix?: string; className?: string }) {
  if (!due) return null;
  const tone = dueTone(due);
  const cls =
    tone === 'overdue'
      ? 'bg-rose-500/10 text-rose-700 ring-rose-500/25 dark:text-rose-300'
      : tone === 'today'
        ? 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300'
        : 'bg-muted text-muted-foreground ring-border';
  return (
    <Chip className={cn(cls, className)}>
      {prefix ? `${prefix} ` : ''}
      {tone === 'overdue' ? `overdue · ${relDay(due)}` : relDay(due)}
    </Chip>
  );
}

export function ChannelIcon({ channel, className }: { channel: Channel; className?: string }) {
  const cls = cn('h-3.5 w-3.5', className);
  switch (channel) {
    case 'linkedin':
      return <Linkedin className={cls} />;
    case 'email':
      return <Mail className={cls} />;
    case 'twitter':
      return <Twitter className={cls} />;
    case 'whatsapp':
      return <MessageCircle className={cls} />;
    case 'phone':
      return <Phone className={cls} />;
    case 'naukri':
      return <Briefcase className={cls} />;
    case 'in_person':
      return <Users className={cls} />;
    default:
      return <MessageSquare className={cls} />;
  }
}

/* ───────────────────────── Page scaffolding ───────────────────────── */

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/15 sm:grid">{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[13.5px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  delta,
  deltaGoodWhenUp = true,
  icon,
  spark,
  className,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  delta?: number | null;
  deltaGoodWhenUp?: boolean;
  icon?: React.ReactNode;
  spark?: number[];
  className?: string;
  onClick?: () => void;
}) {
  const hasDelta = delta !== undefined && delta !== null && Number.isFinite(delta) && Math.round(delta) !== 0;
  const up = (delta ?? 0) > 0;
  const good = up === deltaGoodWhenUp;
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'group relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border bg-card p-4 text-left shadow-soft transition-shadow',
        onClick && 'hover:shadow-lift',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-medium text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground/70 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="whitespace-nowrap text-[26px] font-semibold leading-none tracking-tight">{value}</div>
          <div className="mt-2 flex min-h-[18px] flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {hasDelta && (
              <span className={cn('inline-flex items-center gap-0.5 font-medium', good ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {up ? '+' : ''}
                {Math.round(delta!)}
                {typeof value === 'string' && value.endsWith('%') ? ' pts' : ''}
              </span>
            )}
            {sub}
          </div>
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} className="hidden sm:block" />}
      </div>
    </Comp>
  );
}

export function Sparkline({ data, width = 84, height = 30, className }: { data: number[]; width?: number; height?: number; className?: string }) {
  const max = Math.max(1, ...data);
  const step = width / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [i * step, height - 3 - (v / max) * (height - 6)] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${d} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className={cn('shrink-0 overflow-visible', className)} aria-hidden>
      <path d={area} fill="hsl(var(--primary) / 0.10)" />
      <path d={d} fill="none" stroke="hsl(var(--muted-foreground) / 0.55)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth={2} />
    </svg>
  );
}

export function CopyButton({ text, label = 'Copy', className, onCopied, size = 'sm' }: { text: string; label?: string; className?: string; onCopied?: () => void; size?: 'xs' | 'sm' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyText(text);
        if (ok) {
          setDone(true);
          onCopied?.();
          setTimeout(() => setDone(false), 1400);
        } else toast.error('Could not copy');
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border bg-card font-medium text-foreground/80 shadow-soft transition-colors hover:bg-accent',
        size === 'xs' ? 'h-6 px-1.5 text-[11px]' : 'h-7 px-2 text-xs',
        className,
      )}
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}

export function InfoRow({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-start gap-3 py-1.5 text-[13px]">
      <div className="flex w-28 shrink-0 items-center gap-1.5 text-muted-foreground [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
        {label}
      </div>
      <div className="min-w-0 flex-1 break-words text-foreground">{children ?? <span className="text-muted-foreground/60">—</span>}</div>
    </div>
  );
}

export function LinkChip({ href, icon, children }: { href?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  if (!href) return null;
  const url = /^(https?:|mailto:|tel:)/i.test(href) ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md border bg-card px-2 text-xs font-medium text-foreground/80 shadow-soft transition-colors hover:bg-accent [&>svg]:h-3.5 [&>svg]:w-3.5"
    >
      {icon ?? <Globe />}
      <span className="truncate">{children}</span>
    </a>
  );
}

export const EmailIcon = AtSign;
