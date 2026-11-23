import * as React from 'react';
import { useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn, dueInDays, formatMoney, fromDateInput, fromDateTimeInput, parseAmount, toDateInput, toDateTimeInput } from '@/lib/utils';
import { inputCls } from './ui';
import { Popover } from './overlay';

/* ───────────────────────── Tags ───────────────────────── */

export function TagInput({
  value,
  onChange,
  placeholder = 'Add tag…',
  suggestions = [],
  className,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  className?: string;
}) {
  const [draft, setDraft] = useState('');
  const listId = useMemo(() => `tags-${Math.random().toString(36).slice(2)}`, []);
  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const next = [...value];
    for (const p of parts) if (!next.some((x) => x.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft('');
  };
  return (
    <div className={cn(inputCls, 'flex h-auto min-h-9 flex-wrap items-center gap-1.5 py-1.5', className)}>
      {value.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="opacity-70 hover:opacity-100">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        list={suggestions.length ? listId : undefined}
        value={draft}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(',')) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        placeholder={value.length ? '' : placeholder}
        className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
      />
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions
            .filter((s) => !value.includes(s))
            .map((s) => (
              <option key={s} value={s} />
            ))}
        </datalist>
      )}
    </div>
  );
}

/* ───────────────────────── Searchable select ───────────────────────── */

export interface SearchOption {
  value: string;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  keywords?: string[];
}

export function SearchSelect({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  emptyText = 'No matches',
  allowClear = true,
  className,
  footer,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  options: SearchOption[];
  placeholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  className?: string;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0"
      trigger={
        <button type="button" className={cn(inputCls, 'flex items-center justify-between gap-2 text-left', className)}>
          <span className={cn('flex min-w-0 items-center gap-2 truncate', !selected && 'text-muted-foreground/70')}>
            {selected?.icon}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
            {selected?.hint && <span className="truncate text-xs text-muted-foreground">· {selected.hint}</span>}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {allowClear && selected && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(undefined);
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </span>
        </button>
      }
    >
      <Command className="flex flex-col" loop>
        <div className="border-b px-3">
          <Command.Input autoFocus placeholder="Search…" className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/70" />
        </div>
        <Command.List className="max-h-64 overflow-y-auto p-1">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</Command.Empty>
          {options.map((o) => (
            <Command.Item
              key={o.value}
              value={`${o.label} ${o.hint ?? ''} ${o.value}`}
              keywords={o.keywords}
              onSelect={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm aria-selected:bg-accent data-[selected=true]:bg-accent"
            >
              {o.icon}
              <span className="min-w-0 flex-1 truncate">
                {o.label}
                {o.hint && <span className="ml-1.5 text-xs text-muted-foreground">{o.hint}</span>}
              </span>
              {o.value === value && <Check className="h-4 w-4 text-primary" />}
            </Command.Item>
          ))}
        </Command.List>
        {footer && <div className="border-t p-1">{footer}</div>}
      </Command>
    </Popover>
  );
}

/* ───────────────────────── Dates ───────────────────────── */

export function DateInput({
  value,
  onChange,
  quick = true,
  className,
  quickPast,
}: {
  value?: string;
  onChange: (v: string | undefined) => void;
  quick?: boolean;
  quickPast?: boolean;
  className?: string;
}) {
  const chips: [string, number][] = quickPast
    ? [
        ['Today', 0],
        ['Yesterday', -1],
        ['-3d', -3],
        ['-1w', -7],
      ]
    : [
        ['Today', 0],
        ['Tomorrow', 1],
        ['+3d', 3],
        ['+1w', 7],
      ];
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <input type="date" className={inputCls} value={toDateInput(value)} onChange={(e) => onChange(fromDateInput(e.target.value))} />
      {quick && (
        <div className="flex flex-wrap gap-1">
          {chips.map(([label, d]) => (
            <button
              key={label}
              type="button"
              onClick={() => onChange(dueInDays(d))}
              className="rounded-md border bg-card px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {label}
            </button>
          ))}
          {value && (
            <button type="button" onClick={() => onChange(undefined)} className="rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground">
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DateTimeInput({ value, onChange, className }: { value?: string; onChange: (v: string | undefined) => void; className?: string }) {
  return (
    <input type="datetime-local" className={cn(inputCls, className)} value={toDateTimeInput(value)} onChange={(e) => onChange(fromDateTimeInput(e.target.value))} />
  );
}

/* ───────────────────────── Money ───────────────────────── */

export function MoneyInput({
  value,
  onChange,
  currency,
  placeholder,
}: {
  value?: number;
  onChange: (v: number | undefined) => void;
  currency: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value ? String(formatMoney(value, currency)).replace(/^[^\d]+/, '') : '');
  const parsed = parseAmount(text);
  return (
    <div className="relative">
      <input
        className={cn(inputCls, 'pr-16')}
        inputMode="decimal"
        value={text}
        placeholder={placeholder ?? (currency === 'INR' ? 'e.g. 18L' : 'e.g. 120k')}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseAmount(e.target.value));
        }}
      />
      {text && (
        <span className={cn('pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs', parsed ? 'text-muted-foreground' : 'text-rose-500')}>
          {parsed ? formatMoney(parsed, currency) : '?'}
        </span>
      )}
    </div>
  );
}
