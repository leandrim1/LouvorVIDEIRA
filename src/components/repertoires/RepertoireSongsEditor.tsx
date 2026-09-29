import { useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, ListMusic, Minus, Plus, X } from 'lucide-react'
import { INSTRUMENTATION_OPTIONS } from '@/lib/constants'
import { transposeKey } from '@/lib/music'
import { arrayMove, cn } from '@/lib/utils'
import type { Member, RepertoireSongInput, Song } from '@/types'
import { EmptyState, Input, Select } from '@/components/ui'

interface RepertoireSongsEditorProps {
  items: RepertoireSongInput[]
  onChange: (items: RepertoireSongInput[]) => void
  songs: Song[]
  vocalists: Member[]
}

/** Lista ordenável (arrastar e soltar, setas e teclado) das músicas do repertório */
export function RepertoireSongsEditor({ items, onChange, songs, vocalists }: RepertoireSongsEditorProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = items.findIndex((i) => i.songId === active.id)
    const to = items.findIndex((i) => i.songId === over.id)
    if (from >= 0 && to >= 0) onChange(arrayMove(items, from, to))
  }

  const titleOf = (id: string | number) => songs.find((s) => s.id === id)?.title ?? 'Música'
  const position = (id: string | number) => items.findIndex((i) => i.songId === id) + 1
  const announcements = {
    onDragStart: ({ active }: { active: { id: string | number } }) => `${titleOf(active.id)} selecionada para mover.`,
    onDragOver: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
      over ? `${titleOf(active.id)} sobre a posição ${position(over.id)}.` : 'Fora da lista.',
    onDragEnd: ({ active, over }: { active: { id: string | number }; over: { id: string | number } | null }) =>
      over ? `${titleOf(active.id)} movida para a posição ${position(over.id)}.` : 'Movimento cancelado.',
    onDragCancel: () => 'Movimento cancelado.',
  }

  const update = (index: number, patch: Partial<RepertoireSongInput>) =>
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  if (items.length === 0) {
    return (
      <EmptyState
        compact
        icon={<ListMusic />}
        title="Nenhuma música adicionada"
        description="Pesquise e selecione músicas da biblioteca para montar a ordem do repertório."
      />
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Pressione espaço para pegar a música, use as setas para mover e espaço novamente para soltar. Esc cancela.',
        },
      }}
    >
      <SortableContext items={items.map((i) => i.songId)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {items.map((item, index) => (
            <SortableSongRow
              key={item.songId}
              item={item}
              index={index}
              total={items.length}
              song={songs.find((s) => s.id === item.songId)}
              vocalists={vocalists}
              onUpdate={(patch) => update(index, patch)}
              onMove={(to) => onChange(arrayMove(items, index, to))}
              onRemove={() => onChange(items.filter((_, i) => i !== index))}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  )
}

interface RowProps {
  item: RepertoireSongInput
  index: number
  total: number
  song: Song | undefined
  vocalists: Member[]
  onUpdate: (patch: Partial<RepertoireSongInput>) => void
  onMove: (to: number) => void
  onRemove: () => void
}

function SortableSongRow({ item, index, total, song, vocalists, onUpdate, onMove, onRemove }: RowProps) {
  const [open, setOpen] = useState(false)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.songId })
  const title = song?.title ?? 'Música removida'
  const smallBtn =
    'flex size-8 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent [&_svg]:size-4'

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-xs',
        isDragging && 'relative z-10 border-brand-400 shadow-xl ring-2 ring-brand-500/30',
      )}
    >
      <div className="flex items-center gap-1.5 p-2 sm:gap-2 sm:p-2.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          className="flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
          aria-label={`Arrastar ${title}`}
        >
          <GripVertical className="size-5" />
        </button>
        <span className="tabular w-7 shrink-0 font-mono text-base font-bold text-ink-2">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{title}</p>
          <p className="truncate text-xs text-ink-3">{song?.artist}</p>
        </div>

        <div className="flex items-center rounded-lg ring-1 ring-line ring-inset" role="group" aria-label={`Tom de ${title}`}>
          <button type="button" className={smallBtn} onClick={() => onUpdate({ key: transposeKey(item.key, -1) })} aria-label="Baixar meio tom">
            <Minus />
          </button>
          <span className="w-9 text-center font-mono text-sm font-bold text-brand-700 dark:text-leaf-300" aria-live="polite">
            {item.key}
          </span>
          <button type="button" className={smallBtn} onClick={() => onUpdate({ key: transposeKey(item.key, 1) })} aria-label="Subir meio tom">
            <Plus />
          </button>
        </div>

        <div className="hidden items-center sm:flex">
          <button type="button" className={smallBtn} onClick={() => onMove(index - 1)} disabled={index === 0} aria-label="Mover para cima">
            <ArrowUp />
          </button>
          <button type="button" className={smallBtn} onClick={() => onMove(index + 1)} disabled={index === total - 1} aria-label="Mover para baixo">
            <ArrowDown />
          </button>
        </div>
        <button type="button" className={smallBtn} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Detalhes de ${title}`}>
          <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
        </button>
        <button
          type="button"
          className={cn(smallBtn, 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400')}
          onClick={onRemove}
          aria-label={`Remover ${title}`}
        >
          <X />
        </button>
      </div>

      {open && (
        <div className="grid animate-fade-in gap-3 border-t border-line p-3 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-ink-2">Vocal principal</span>
            <Select
              value={item.leadVocalId ?? ''}
              onChange={(e) => onUpdate({ leadVocalId: e.target.value || null })}
              placeholder="Não definido"
              options={vocalists.map((m) => ({ value: m.id, label: m.name }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-ink-2">Instrumentação</span>
            <Select
              value={item.instrumentation}
              onChange={(e) => onUpdate({ instrumentation: e.target.value })}
              placeholder="Não definida"
              options={INSTRUMENTATION_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold text-ink-2">Observação</span>
            <Input value={item.notes} onChange={(e) => onUpdate({ notes: e.target.value })} placeholder="Ex.: começar só com teclado" />
          </label>
          <div className="flex gap-2 sm:hidden">
            <button type="button" className={cn(smallBtn, 'flex-1 ring-1 ring-line')} onClick={() => onMove(index - 1)} disabled={index === 0}>
              <ArrowUp /> <span className="ml-1 text-xs font-semibold">Subir</span>
            </button>
            <button type="button" className={cn(smallBtn, 'flex-1 ring-1 ring-line')} onClick={() => onMove(index + 1)} disabled={index === total - 1}>
              <ArrowDown /> <span className="ml-1 text-xs font-semibold">Descer</span>
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
