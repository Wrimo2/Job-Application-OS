import { toast } from 'sonner';
import { db } from '@/lib/db';
import { moveApplication } from '@/lib/actions';
import { METHOD_MAP, STAGE_MAP, platformMeta } from '@/lib/constants';
import { celebrate } from '@/lib/store';
import type { Application, Stage } from '@/lib/types';
import { fmtDate, formatSalaryRange } from '@/lib/utils';

export { companyKey } from '@/lib/utils';

export const platformLabel = (id: string) => platformMeta(id).label;

/** Moves an application with celebratory / supportive feedback and a true Undo. */
export async function moveWithFeedback(id: string, to: Stage, navigate?: (path: string) => void): Promise<void> {
  const prev = await db.applications.get(id);
  const from = await moveApplication(id, to);
  if (!from || !prev) return;
  const restore = async () => {
    await db.applications.put(prev);
    toast.success('Change undone');
  };
  if (to === 'offer') {
    celebrate();
    toast.success('An offer! 🎉 Huge congratulations.', {
      description: 'Add the numbers to compare offers side by side.',
      action: navigate ? { label: 'Add offer details', onClick: () => navigate(`/offers?new=${id}`) } : undefined,
      duration: 8000,
    });
    return;
  }
  if (to === 'accepted') {
    celebrate();
    setTimeout(celebrate, 700);
    toast.success('You accepted an offer — incredible work! 🥳', { duration: 8000 });
    return;
  }
  if (to === 'rejected') {
    toast('Marked as rejected', {
      description: 'Rejections are data, not verdicts. Add a reason in the details so Analytics can spot patterns.',
      action: { label: 'Undo', onClick: restore },
      duration: 7000,
    });
    return;
  }
  toast.success(`Moved to ${STAGE_MAP[to].label}`, { action: { label: 'Undo', onClick: restore }, duration: 8000 });
}

export function applicationSummary(a: Application): string {
  return [
    `${a.role} — ${a.company}`,
    `Status: ${STAGE_MAP[a.status].label}`,
    `Platform: ${platformMeta(a.platform).label} (${METHOD_MAP[a.method]?.label ?? a.method})`,
    a.location ? `Location: ${a.location}${a.workMode ? ` · ${a.workMode}` : ''}` : '',
    a.salaryMin || a.salaryMax ? `Salary: ${formatSalaryRange(a.salaryMin, a.salaryMax, a.currency)}` : '',
    a.appliedAt ? `Applied: ${fmtDate(a.appliedAt)}` : '',
    a.url ? `Link: ${a.url}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
