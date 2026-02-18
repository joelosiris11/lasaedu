import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useState, type ReactNode } from 'react';

interface SortableListProps {
  items: string[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  children: ReactNode;
  /** Render the drag overlay content given the active item id */
  renderOverlay?: (activeId: string) => ReactNode;
  /** Minimum distance in px before drag activates (prevents conflicts with clicks) */
  activationDistance?: number;
}

export { arrayMove };

export default function SortableList({
  items,
  onReorder,
  children,
  renderOverlay,
  activationDistance = 8,
}: SortableListProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: activationDistance },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.indexOf(String(active.id));
    const newIndex = items.indexOf(String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) {
      onReorder(oldIndex, newIndex);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay>
        {activeId && renderOverlay ? renderOverlay(activeId) : null}
      </DragOverlay>
    </DndContext>
  );
}
