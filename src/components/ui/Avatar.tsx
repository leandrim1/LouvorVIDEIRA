import { useState } from 'react'
import { cn, hashString, initials } from '@/lib/utils'

const PALETTE = [
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-500/15 dark:text-fuchsia-300',
]

const SIZES = {
  xs: 'size-6 text-[10px]',
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-14 text-lg',
  xl: 'size-20 text-2xl',
}

interface AvatarProps {
  name: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const color = PALETTE[hashString(name) % PALETTE.length]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ring-2 ring-surface',
        SIZES[size],
        (!src || failed) && color,
        className,
      )}
      role="img"
      aria-label={name}
    >
      {src && !failed ? (
        <img src={src} alt="" className="size-full object-cover" onError={() => setFailed(true)} loading="lazy" />
      ) : (
        initials(name)
      )}
    </span>
  )
}

interface AvatarGroupProps {
  people: Array<{ id: string; name: string; photoUrl?: string | null }>
  max?: number
  size?: keyof typeof SIZES
}

export function AvatarGroup({ people, max = 5, size = 'sm' }: AvatarGroupProps) {
  const visible = people.slice(0, max)
  const rest = people.length - visible.length
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((p) => (
        <Avatar key={p.id} name={p.name} src={p.photoUrl} size={size} />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            'inline-flex items-center justify-center rounded-full bg-surface-3 font-semibold text-ink-2 ring-2 ring-surface',
            SIZES[size],
          )}
          aria-label={`e mais ${rest}`}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}
