import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ReactNode, CSSProperties } from 'react';

interface SortableItemProps {
  id: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** Render a custom drag handle instead of the default GripVertical */
  renderHandle?: (listeners: Record<string, Function>, attributes: Record<string, any>) => ReactNode;
}

export default function SortableItem({ id, children, className = '', disabled = false, renderHandle }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {renderHandle ? (
        renderHandle(listeners ?? {}, attributes)
      ) : (
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing touch-none p-1 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 rounded"
          aria-label="Arrastrar para reordenar"
          type="button"
        >
          <GripVertical className="h-5 w-5" />
        </button>
      )}
      {children}
    </div>
  );
}
