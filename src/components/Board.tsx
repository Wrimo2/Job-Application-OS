import * as React from 'react';
import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { cn } from '@/lib/utils';

export interface BoardColumn<T> {
  id: string;
  title: string;
  dot: string;
  hint?: string;
  items: T[];
  footer?: React.ReactNode;
}

const collision: CollisionDetection = (args) => {
  const p = pointerWithin(args);
  return p.length ? p : rectIntersection(args);
};

function Column<T>({
  col,
  getId,
  renderCard,
  onOpen,
  empty,
  width,
}: {
  col: BoardColumn<T>;
  getId: (t: T) => string;
  renderCard: (t: T, opts: { dragging: boolean }) => React.ReactNode;
  onOpen: (t: T) => void;
  empty?: React.ReactNode;
  width: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div className="flex shrink-0 snap-start flex-col" style={{ width }}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={cn('h-2 w-2 rounded-full', col.dot)} />
        <span className="text-[13px] font-semibold">{col.title}</span>
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium tabular-nums text-muted-foreground">{col.items.length}</span>
        {col.hint && <span className="ml-auto truncate text-[11px] text-muted-foreground/80">{col.hint}</span>}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[140px] flex-1 flex-col gap-2 rounded-xl border border-dashed border-transparent bg-muted/45 p-2 transition-colors dark:bg-muted/30',
          isOver && 'border-primary/50 bg-primary/5',
        )}
      >
        {col.items.map((it) => (
          <DraggableCard key={getId(it)} id={getId(it)} onOpen={() => onOpen(it)}>
            {renderCard(it, { dragging: false })}
          </DraggableCard>
        ))}
        {!col.items.length && <div className="grid flex-1 place-items-center px-2 py-6 text-center text-[12px] text-muted-foreground/70">{empty ?? 'Drop here'}</div>}
        {col.footer}
      </div>
    </div>
  );
}

function DraggableCard({ id, children, onOpen }: { id: string; children: React.ReactNode; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen();
        listeners?.onKeyDown?.(e as any);
      }}
      className={cn('cursor-grab touch-manipulation outline-none active:cursor-grabbing', isDragging && 'opacity-30')}
    >
      {children}
    </div>
  );
}

export function Board<T>({
  columns,
  getId,
  renderCard,
  onMove,
  onOpen,
  columnWidth = 272,
  emptyText,
}: {
  columns: BoardColumn<T>[];
  getId: (t: T) => string;
  renderCard: (t: T, opts: { dragging: boolean }) => React.ReactNode;
  onMove: (id: string, toColumn: string) => void;
  onOpen: (t: T) => void;
  columnWidth?: number;
  emptyText?: string;
}) {
  const [active, setActive] = useState<T | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const all = columns.flatMap((c) => c.items);
  const onStart = (e: DragStartEvent) => setActive(all.find((t) => getId(t) === e.active.id) ?? null);
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    if (!e.over) return;
    const from = columns.find((c) => c.items.some((t) => getId(t) === e.active.id));
    if (from && from.id !== e.over.id) onMove(String(e.active.id), String(e.over.id));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {columns.map((c) => (
          <Column key={c.id} col={c} getId={getId} renderCard={renderCard} onOpen={onOpen} width={columnWidth} empty={emptyText} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {active ? <div className="rotate-[1.5deg] cursor-grabbing shadow-lift">{renderCard(active, { dragging: true })}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
