import * as React from 'react';
import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import { ChevronDown, LoaderCircle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ───────────────────────── Button ───────────────────────── */

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'subtle' | 'danger' | 'success' | 'link';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-xs';

const btnBase =
  'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,color,box-shadow,transform,opacity] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 focus-visible:ring-offset-background';

const btnVariants: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90',
  secondary: 'border border-border bg-card text-foreground shadow-soft hover:bg-accent',
  outline: 'border border-border bg-transparent text-foreground hover:bg-accent',
  ghost: 'text-foreground/80 hover:bg-accent hover:text-foreground',
  subtle: 'bg-muted text-foreground hover:bg-accent',
  danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-600/90',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-600/90',
  link: 'h-auto px-0 text-primary underline-offset-4 hover:underline',
};

const btnSizes: Record<Size, string> = {
  xs: 'h-7 gap-1 rounded-md px-2 text-xs',
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-[13px]',
  md: 'h-9 gap-2 rounded-lg px-3.5 text-sm',
  lg: 'h-11 gap-2 rounded-xl px-5 text-[15px]',
  icon: 'h-9 w-9 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-lg',
  'icon-xs': 'h-7 w-7 rounded-md',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', loading, className, children, disabled, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      className={cn(btnBase, btnVariants[variant], btnSizes[size], className)}
      {...props}
    >
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

/* ───────────────────────── Inputs ───────────────────────── */

export const inputCls =
  'h-9 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-soft outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-foreground/20 focus:border-ring/60 focus:ring-[3px] focus:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputCls, className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { autoGrow?: boolean; maxRows?: number }
>(({ className, autoGrow = true, maxRows = 18, onChange, ...props }, ref) => {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const resize = () => {
    const el = inner.current;
    if (!el || !autoGrow) return;
    el.style.height = 'auto';
    const lh = 20;
    el.style.height = `${Math.min(el.scrollHeight + 2, maxRows * lh + 20)}px`;
  };
  useLayoutEffect(resize, [props.value, autoGrow]);
  return (
    <textarea
      ref={(el) => {
        inner.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      onChange={(e) => {
        onChange?.(e);
        resize();
      }}
      className={cn(inputCls, 'h-auto min-h-[76px] resize-y py-2 leading-5', className)}
      {...props}
    />
  );
});
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { wrapperClassName?: string }>(
  ({ className, wrapperClassName, children, ...props }, ref) => (
    <div className={cn('relative w-full min-w-0', wrapperClassName)}>
      <select ref={ref} className={cn(inputCls, 'cursor-pointer appearance-none pr-8', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
);
Select.displayName = 'Select';

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
  required,
  aside,
}: {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
  required?: boolean;
  aside?: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      {(label || aside) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-medium text-foreground/90">
              {label}
              {required && <span className="ml-0.5 text-rose-500">*</span>}
            </label>
          )}
          {aside}
        </div>
      )}
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-foreground/15',
      )}
    >
      <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

/* ───────────────────────── Surfaces ───────────────────────── */

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('rounded-xl border bg-card text-card-foreground shadow-soft', className)} {...props} />
));
Card.displayName = 'Card';

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-4 pt-4 sm:px-5', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-6 tracking-tight">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-1">{action}</div>}
    </div>
  );
}

/* ───────────────────────── Badges ───────────────────────── */

const badgeTones = {
  gray: 'bg-zinc-500/10 text-zinc-700 ring-zinc-500/20 dark:text-zinc-300',
  blue: 'bg-blue-500/10 text-blue-700 ring-blue-500/20 dark:text-blue-300',
  green: 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
  amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/25 dark:text-amber-300',
  red: 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300',
  violet: 'bg-violet-500/10 text-violet-700 ring-violet-500/20 dark:text-violet-300',
  cyan: 'bg-cyan-500/10 text-cyan-700 ring-cyan-500/20 dark:text-cyan-300',
  pink: 'bg-pink-500/10 text-pink-700 ring-pink-500/20 dark:text-pink-300',
  primary: 'bg-primary/10 text-primary ring-primary/20',
  outline: 'bg-transparent text-muted-foreground ring-border',
} as const;

export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  tone = 'gray',
  className,
  children,
  dotClass,
  title,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
  dotClass?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex h-[22px] max-w-full items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[11.5px] font-medium ring-1 ring-inset',
        badgeTones[tone],
        className,
      )}
    >
      {dotClass && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Badge using a raw class string (stage / relationship chips from constants). */
export function Chip({ className, children, dotClass, title }: { className: string; children: React.ReactNode; dotClass?: string; title?: string }) {
  return (
    <span title={title} className={cn('inline-flex h-[22px] max-w-full items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-[11.5px] font-medium ring-1 ring-inset', className)}>
      {dotClass && <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-[10.5px] font-medium text-muted-foreground',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/* ───────────────────────── Tabs & segmented ───────────────────────── */

export interface TabItem<T extends string> {
  id: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  size = 'md',
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div role="tablist" className={cn('no-scrollbar -mb-px flex items-center gap-1 overflow-x-auto border-b', className)}>
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 font-medium transition-colors',
              size === 'sm' ? 'h-9 text-[13px]' : 'h-10 text-sm',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                {t.count}
              </span>
            )}
            {active && <span className="absolute inset-x-1.5 -bottom-px h-[2px] rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'sm',
}: {
  options: { id: T; label: React.ReactNode; icon?: React.ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'xs' | 'sm';
}) {
  return (
    <div className={cn('inline-flex items-center rounded-lg border bg-muted/60 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.title}
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md font-medium transition-all',
            size === 'xs' ? 'h-6 px-2 text-xs' : 'h-7 px-2.5 text-[13px]',
            o.id === value ? 'bg-card text-foreground shadow-soft ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────────────────── Feedback ───────────────────────── */

export function Progress({ value, max = 100, className, barClassName }: { value: number; max?: number; className?: string; barClassName?: string }) {
  const p = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-primary/10', className)} role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={cn('h-full rounded-full bg-primary transition-[width] duration-500', barClassName)} style={{ width: `${p}%` }} />
    </div>
  );
}

export function ProgressRing({
  value,
  max,
  size = 76,
  stroke = 7,
  className,
  children,
  trackClass = 'stroke-primary/15',
  barClass = 'stroke-primary',
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
  trackClass?: string;
  barClass?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, value / Math.max(1, max)));
  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className={trackClass} style={{ stroke: undefined }} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          className={cn(barClass, 'transition-[stroke-dashoffset] duration-700 ease-out')}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 px-4 py-8' : 'gap-3 px-6 py-14', className)}>
      {icon && (
        <div className={cn('grid place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/15', compact ? 'h-10 w-10' : 'h-14 w-14')}>
          {icon}
        </div>
      )}
      <div className="max-w-sm">
        <p className={cn('font-semibold tracking-tight', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />;
}

export function StarRating({ value, onChange, size = 16, max = 5, readOnly }: { value: number; onChange?: (v: number) => void; size?: number; max?: number; readOnly?: boolean }) {
  return (
    <div className="inline-flex items-center gap-0.5" role={readOnly ? 'img' : 'radiogroup'} aria-label={`${value} of ${max}`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < value;
        const Comp = readOnly ? 'span' : 'button';
        return (
          <Comp
            key={i}
            {...(!readOnly ? { type: 'button' as const, onClick: () => onChange?.(value === i + 1 ? 0 : i + 1), 'aria-label': `${i + 1} stars` } : {})}
            className={cn('rounded transition-transform', !readOnly && 'hover:scale-110')}
          >
            <Star style={{ width: size, height: size }} className={cn(filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
          </Comp>
        );
      })}
    </div>
  );
}

export function Divider({ className, label }: { className?: string; label?: string }) {
  if (!label) return <div className={cn('h-px w-full bg-border', className)} />;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="h-px flex-1 bg-border" />
      <span className="label-caps">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export function Checkbox({ checked, onChange, className, label, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; className?: string; label?: string; indeterminate?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className={cn('h-4 w-4 cursor-pointer rounded border-input accent-[hsl(var(--primary))]', className)}
    />
  );
}
