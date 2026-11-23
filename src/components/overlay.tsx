import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DM from '@radix-ui/react-dropdown-menu';
import * as PO from '@radix-ui/react-popover';
import * as TT from '@radix-ui/react-tooltip';
import { Check, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUI } from '@/lib/store';
import { Button } from './ui';

/* ───────────────────────── Modal ───────────────────────── */

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-[1200px]',
};

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
  bodyClassName,
  icon,
  headerAction,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: keyof typeof modalSizes;
  className?: string;
  bodyClassName?: string;
  icon?: React.ReactNode;
  headerAction?: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <Dialog.Content
          aria-describedby={description ? undefined : undefined}
          className={cn(
            'fixed left-1/2 top-[3vh] z-50 flex max-h-[94vh] w-[calc(100vw-1rem)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl outline-none data-[state=open]:animate-scale-in sm:top-[7vh] sm:max-h-[86vh] sm:w-[calc(100vw-2rem)]',
            modalSizes[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
            <div className="flex min-w-0 items-start gap-3">
              {icon && <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</div>}
              <div className="min-w-0">
                <Dialog.Title className="text-base font-semibold tracking-tight">{title}</Dialog.Title>
                {description ? (
                  <Dialog.Description className="mt-0.5 text-[13px] text-muted-foreground">{description}</Dialog.Description>
                ) : (
                  <Dialog.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</Dialog.Description>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {headerAction}
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </Dialog.Close>
            </div>
          </div>
          <div className={cn('min-h-0 flex-1 overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-muted/30 px-5 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/* ───────────────────────── Sheet (side drawer) ───────────────────────── */

export function Sheet({
  open,
  onOpenChange,
  children,
  className,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 data-[state=open]:animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-background shadow-2xl outline-none data-[state=open]:animate-slide-in-right sm:max-w-[720px]',
            className,
          )}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{title} details</Dialog.Description>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const SheetClose = Dialog.Close;

/* ───────────────────────── Dropdown menu ───────────────────────── */

export const Menu = DM.Root;
export const MenuTrigger = DM.Trigger;

export function MenuContent({ children, align = 'end', className, sideOffset = 6 }: { children: React.ReactNode; align?: 'start' | 'end' | 'center'; className?: string; sideOffset?: number }) {
  return (
    <DM.Portal>
      <DM.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn('z-[60] min-w-[200px] overflow-hidden rounded-xl border bg-popover p-1 text-popover-foreground shadow-lift data-[state=open]:animate-pop-in', className)}
      >
        {children}
      </DM.Content>
    </DM.Portal>
  );
}

export function MenuItem({
  children,
  onSelect,
  icon,
  shortcut,
  danger,
  disabled,
}: {
  children: React.ReactNode;
  onSelect?: () => void;
  icon?: React.ReactNode;
  shortcut?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <DM.Item
      disabled={disabled}
      onSelect={() => onSelect?.()}
      className={cn(
        'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-accent data-[disabled]:opacity-50',
        danger && 'text-rose-600 data-[highlighted]:bg-rose-500/10 dark:text-rose-400',
      )}
    >
      {icon && <span className="grid h-4 w-4 place-items-center text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-[11px] text-muted-foreground">{shortcut}</span>}
    </DM.Item>
  );
}

export function MenuCheckItem({ children, checked, onSelect, dotClass }: { children: React.ReactNode; checked: boolean; onSelect: () => void; dotClass?: string }) {
  return (
    <DM.Item
      onSelect={(e) => {
        e.preventDefault();
        onSelect();
      }}
      className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-accent"
    >
      <span className={cn('grid h-4 w-4 place-items-center rounded border', checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input')}>
        {checked && <Check className="h-3 w-3" />}
      </span>
      {dotClass && <span className={cn('h-2 w-2 rounded-full', dotClass)} />}
      <span className="flex-1">{children}</span>
    </DM.Item>
  );
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <DM.Label className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</DM.Label>;
}

export function MenuSeparator() {
  return <DM.Separator className="my-1 h-px bg-border" />;
}

export function SubMenu({ label, icon, children }: { label: React.ReactNode; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <DM.Sub>
      <DM.SubTrigger className="flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] outline-none data-[highlighted]:bg-accent data-[state=open]:bg-accent">
        {icon && <span className="grid h-4 w-4 place-items-center text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        <span className="flex-1">{label}</span>
        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
      </DM.SubTrigger>
      <DM.Portal>
        <DM.SubContent sideOffset={6} collisionPadding={8} className="z-[61] max-h-[60vh] min-w-[190px] overflow-y-auto rounded-xl border bg-popover p-1 shadow-lift data-[state=open]:animate-pop-in">
          {children}
        </DM.SubContent>
      </DM.Portal>
    </DM.Sub>
  );
}

/* ───────────────────────── Popover ───────────────────────── */

export function Popover({
  trigger,
  children,
  align = 'start',
  className,
  open,
  onOpenChange,
}: {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: 'start' | 'end' | 'center';
  className?: string;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  return (
    <PO.Root open={open} onOpenChange={onOpenChange}>
      <PO.Trigger asChild>{trigger}</PO.Trigger>
      <PO.Portal>
        <PO.Content
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn('z-[60] w-72 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lift outline-none data-[state=open]:animate-pop-in', className)}
        >
          {children}
        </PO.Content>
      </PO.Portal>
    </PO.Root>
  );
}

/* ───────────────────────── Tooltip ───────────────────────── */

export const TooltipProvider = TT.Provider;

export function Tip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactElement; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  if (!content) return children;
  return (
    <TT.Root delayDuration={250}>
      <TT.Trigger asChild>{children}</TT.Trigger>
      <TT.Portal>
        <TT.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className="z-[70] max-w-xs rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-lift data-[state=delayed-open]:animate-fade-in"
        >
          {content}
        </TT.Content>
      </TT.Portal>
    </TT.Root>
  );
}

/* ───────────────────────── Confirm dialog (global) ───────────────────────── */

export function ConfirmHost() {
  const confirm = useUI((s) => s.confirm);
  const close = (v: boolean) => {
    confirm.resolve?.(v);
    useUI.setState({ confirm: { ...confirm, open: false, resolve: undefined } });
  };
  return (
    <Modal
      open={confirm.open}
      onOpenChange={(v) => !v && close(false)}
      title={confirm.title}
      description={confirm.description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button variant={confirm.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
            {confirm.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <p className="text-sm text-muted-foreground">
        {confirm.undoable ? 'You can undo this for a few seconds afterwards.' : confirm.danger ? 'This can’t be undone.' : 'Are you sure?'}
      </p>
    </Modal>
  );
}
