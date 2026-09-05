import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatDuration } from '../fit'
import type { MediaItem } from '../types'

type Props = {
  items: MediaItem[]
  thumbUrls: Record<string, string>
  onReorder: (fromId: string, toId: string) => void
  onRemove: (id: string) => void
}

export function MediaGrid({ items, thumbUrls, onReorder, onRemove }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((m) => m.id)} strategy={rectSortingStrategy}>
        <ul
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
          data-testid="media-grid"
        >
          {items.map((item, i) => (
            <Tile
              key={item.id}
              item={item}
              index={i}
              thumbUrl={thumbUrls[item.id]}
              onRemove={() => onRemove(item.id)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function Tile({
  item,
  index,
  thumbUrl,
  onRemove,
}: {
  item: MediaItem
  index: number
  thumbUrl?: string
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative aspect-square overflow-hidden rounded-lg bg-neutral-800 ${
        isDragging ? 'z-10 ring-2 ring-amber-300' : ''
      }`}
      data-testid="media-tile"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
        aria-label={`${index + 1}번 ${item.name} 순서 바꾸기`}
        {...attributes}
        {...listeners}
      >
        {thumbUrl ? (
          <img src={thumbUrl} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-xs text-neutral-500">
            미리보기 없음
          </span>
        )}
      </button>
      <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] tabular-nums">
        {index + 1}
      </span>
      {item.kind === 'video' && (
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] tabular-nums">
          ▶ {item.duration !== undefined ? formatDuration(item.duration) : '영상'}
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${item.name} 삭제`}
        className="absolute top-1 right-1 rounded-full bg-black/60 px-1.5 text-sm leading-6 text-neutral-200 opacity-0 transition group-hover:opacity-100 hover:bg-red-600 focus:opacity-100"
      >
        ×
      </button>
    </li>
  )
}
