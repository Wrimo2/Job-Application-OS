export { fmtPct, median, plural, toDate } from '@/lib/utils';

export function responseDaysLabel(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return '—';
  const d = Math.round(days);
  return d === 0 ? 'same day' : `${d}d`;
}
