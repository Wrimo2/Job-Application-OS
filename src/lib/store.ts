import { create } from 'zustand';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import type { Application, Contact, ID, Interview, Task } from './types';

interface Overlay<T> {
  open: boolean;
  id?: ID;
  prefill?: Partial<T>;
}

export interface ComposerOpts {
  contactId?: ID;
  applicationId?: ID;
  templateId?: ID;
  enrollmentId?: ID;
  interviewId?: ID;
}

interface ConfirmState {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** An Undo toast will follow the action */
  undoable?: boolean;
  resolve?: (v: boolean) => void;
}

export type DrawerType = 'application' | 'contact' | 'company';

interface UIState {
  appForm: Overlay<Application>;
  contactForm: Overlay<Contact>;
  taskForm: Overlay<Task>;
  interviewForm: Overlay<Interview> & { applicationId?: ID };
  logForm: { open: boolean; contactId?: ID; applicationId?: ID };
  composer: ComposerOpts & { open: boolean };
  enroll: { open: boolean; contactIds: ID[]; sequenceId?: ID; applicationId?: ID };
  drawer: { type: DrawerType | null; id?: ID; tab?: string };
  palette: boolean;
  shortcuts: boolean;
  mobileNav: boolean;
  confirm: ConfirmState;

  openAppForm: (id?: ID, prefill?: Partial<Application>) => void;
  closeAppForm: () => void;
  openContactForm: (id?: ID, prefill?: Partial<Contact>) => void;
  closeContactForm: () => void;
  openTaskForm: (id?: ID, prefill?: Partial<Task>) => void;
  closeTaskForm: () => void;
  openInterviewForm: (applicationId?: ID, id?: ID, prefill?: Partial<Interview>) => void;
  closeInterviewForm: () => void;
  openLog: (contactId?: ID, applicationId?: ID) => void;
  closeLog: () => void;
  openComposer: (opts?: ComposerOpts) => void;
  closeComposer: () => void;
  openEnroll: (contactIds: ID[], sequenceId?: ID, applicationId?: ID) => void;
  closeEnroll: () => void;
  openDrawer: (type: DrawerType, id: ID, tab?: string) => void;
  closeDrawer: () => void;
  setPalette: (v: boolean) => void;
  setShortcuts: (v: boolean) => void;
  setMobileNav: (v: boolean) => void;
}

export const useUI = create<UIState>()((set) => ({
  appForm: { open: false },
  contactForm: { open: false },
  taskForm: { open: false },
  interviewForm: { open: false },
  logForm: { open: false },
  composer: { open: false },
  enroll: { open: false, contactIds: [] },
  drawer: { type: null },
  palette: false,
  shortcuts: false,
  mobileNav: false,
  confirm: { open: false, title: '' },

  openAppForm: (id, prefill) => set({ appForm: { open: true, id, prefill } }),
  closeAppForm: () => set((s) => ({ appForm: { ...s.appForm, open: false } })),
  openContactForm: (id, prefill) => set({ contactForm: { open: true, id, prefill } }),
  closeContactForm: () => set((s) => ({ contactForm: { ...s.contactForm, open: false } })),
  openTaskForm: (id, prefill) => set({ taskForm: { open: true, id, prefill } }),
  closeTaskForm: () => set((s) => ({ taskForm: { ...s.taskForm, open: false } })),
  openInterviewForm: (applicationId, id, prefill) => set({ interviewForm: { open: true, applicationId, id, prefill } }),
  closeInterviewForm: () => set((s) => ({ interviewForm: { ...s.interviewForm, open: false } })),
  openLog: (contactId, applicationId) => set({ logForm: { open: true, contactId, applicationId } }),
  closeLog: () => set((s) => ({ logForm: { ...s.logForm, open: false } })),
  openComposer: (opts = {}) => set({ composer: { open: true, ...opts } }),
  closeComposer: () => set((s) => ({ composer: { ...s.composer, open: false } })),
  openEnroll: (contactIds, sequenceId, applicationId) => set({ enroll: { open: true, contactIds, sequenceId, applicationId } }),
  closeEnroll: () => set((s) => ({ enroll: { ...s.enroll, open: false } })),
  openDrawer: (type, id, tab) => set({ drawer: { type, id, tab } }),
  closeDrawer: () => set({ drawer: { type: null } }),
  setPalette: (v) => set({ palette: v }),
  setShortcuts: (v) => set({ shortcuts: v }),
  setMobileNav: (v) => set({ mobileNav: v }),
}));

export const ui = () => useUI.getState();

export function confirmDialog(opts: { title: string; description?: string; confirmLabel?: string; danger?: boolean; undoable?: boolean }): Promise<boolean> {
  return new Promise((resolve) => useUI.setState({ confirm: { open: true, ...opts, resolve } }));
}

/** Toast with an Undo button wired to a restore function. */
export function undoToast(message: string, restore: () => Promise<void>): void {
  toast(message, {
    action: {
      label: 'Undo',
      onClick: () => {
        restore().then(() => toast.success('Restored'));
      },
    },
    duration: 8000,
  });
}

export function celebrate(): void {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  const colors = ['#6366f1', '#a855f7', '#22c55e', '#f59e0b', '#ec4899'];
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 }, colors });
  setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 }, colors }), 200);
  setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 }, colors }), 350);
}
