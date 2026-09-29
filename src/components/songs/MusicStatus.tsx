import { CheckCircle2, CircleDashed, Clock3 } from 'lucide-react'
import type { ReactNode } from 'react'
import { PREPARATION_CHECKLIST_LABELS, PREPARATION_STATUS_LABELS } from '@/lib/constants'
import { CHECKLIST_KEYS, EMPTY_CHECKLIST, checklistProgress } from '@/lib/preparation'
import { cn } from '@/lib/utils'
import type { PreparationChecklist, PreparationStatus, SongPreparation } from '@/types'
import { Badge, Checkbox, ProgressBar, type BadgeTone } from '@/components/ui'
import type { PreparationPatch } from '@/services/preparationService'

const STATUS_META: Record<PreparationStatus, { tone: BadgeTone; icon: ReactNode }> = {
  not_studied: { tone: 'danger', icon: <CircleDashed /> },
  studying: { tone: 'warning', icon: <Clock3 /> },
  ready: { tone: 'success', icon: <CheckCircle2 /> },
}

export function MusicStatusBadge({ preparation, showProgress }: { preparation: SongPreparation | null; showProgress?: boolean }) {
  const status = preparation?.status ?? 'not_studied'
  const meta = STATUS_META[status]
  return (
    <Badge tone={meta.tone}>
      {meta.icon}
      {PREPARATION_STATUS_LABELS[status]}
      {showProgress && <span className="tabular opacity-70">· {checklistProgress(preparation)}%</span>}
    </Badge>
  )
}

interface MusicStatusProps {
  preparation: SongPreparation | null
  onChange: (patch: PreparationPatch) => void
  disabled?: boolean
  className?: string
}

/** Status de preparação + checklist (vídeo, cifra, tom, ensaio) com percentual */
export function MusicStatus({ preparation, onChange, disabled, className }: MusicStatusProps) {
  const status = preparation?.status ?? 'not_studied'
  const checklist: PreparationChecklist = preparation ?? EMPTY_CHECKLIST
  const statuses: PreparationStatus[] = ['not_studied', 'studying', 'ready']

  return (
    <div className={cn('space-y-4', className)}>
      <div role="radiogroup" aria-label="Status de preparação" className="grid grid-cols-3 gap-1.5 rounded-xl bg-surface-2 p-1 ring-1 ring-line ring-inset">
        {statuses.map((s) => {
          const active = s === status
          const tone = s === 'ready' ? 'text-emerald-600 dark:text-emerald-400' : s === 'studying' ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
          return (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange({ status: s })}
              className={cn(
                'flex h-9 items-center justify-center gap-1.5 rounded-lg px-1 text-xs font-semibold transition-all sm:text-[13px] [&_svg]:size-4',
                active ? cn('bg-surface shadow-sm ring-1 ring-line', tone) : 'text-ink-3 hover:text-ink',
              )}
            >
              <span className="hidden sm:inline-flex">{STATUS_META[s].icon}</span>
              {PREPARATION_STATUS_LABELS[s]}
            </button>
          )
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {CHECKLIST_KEYS.map((key) => (
          <Checkbox
            key={key}
            label={PREPARATION_CHECKLIST_LABELS[key]}
            checked={checklist[key]}
            disabled={disabled}
            onChange={(e) => onChange({ [key]: e.target.checked })}
          />
        ))}
      </div>
      <ProgressBar value={checklistProgress(preparation)} label="Preparação" showValue size="sm" />
    </div>
  )
}
