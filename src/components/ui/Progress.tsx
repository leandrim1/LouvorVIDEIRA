import { cn } from '@/lib/utils'

function toneFor(value: number) {
  if (value >= 100) return 'bg-emerald-500'
  if (value >= 50) return 'bg-brand-500'
  if (value > 0) return 'bg-amber-500'
  return 'bg-ink-3'
}

interface ProgressBarProps {
  value: number
  label?: string
  showValue?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export function ProgressBar({ value, label, showValue, className, size = 'md' }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="font-medium text-ink-2">{label}</span>}
          {showValue && <span className="tabular font-bold text-ink">{clamped}%</span>}
        </div>
      )}
      <div
        className={cn('overflow-hidden rounded-full bg-surface-3', size === 'sm' ? 'h-1.5' : 'h-2')}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progresso'}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out', toneFor(clamped))} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  )
}

interface ProgressRingProps {
  value: number
  size?: number
  stroke?: number
  className?: string
  label?: string
}

export function ProgressRing({ value, size = 56, stroke = 5, className, label = 'Preparação' }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference
  const color = clamped >= 100 ? 'text-emerald-500' : clamped >= 50 ? 'text-brand-500' : clamped > 0 ? 'text-amber-500' : 'text-ink-3'
  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} className="fill-none stroke-surface-3" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn('fill-none stroke-current transition-[stroke-dashoffset] duration-700 ease-out', color)}
        />
      </svg>
      <span className="tabular absolute text-[13px] font-bold text-ink">{clamped}%</span>
    </div>
  )
}
