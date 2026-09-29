import { useState } from 'react'
import { Music2 } from 'lucide-react'
import { cn, hashString } from '@/lib/utils'

const GRADIENTS = [
  'from-leaf-500 to-brand-600',
  'from-brand-400 to-grape-600',
  'from-leaf-400 to-leaf-700',
  'from-brand-500 to-brand-800',
  'from-teal-400 to-brand-600',
  'from-grape-400 to-grape-700',
  'from-sky-400 to-brand-600',
  'from-leaf-600 to-grape-600',
  'from-amber-400 to-rose-500',
]

const SIZES = {
  xs: 'size-9 rounded-lg text-[11px]',
  sm: 'size-11 rounded-xl text-xs',
  md: 'size-14 rounded-xl text-sm',
  lg: 'size-24 rounded-2xl text-xl sm:size-28',
  xl: 'size-32 rounded-2xl text-2xl sm:size-40',
  fill: 'aspect-square w-full rounded-xl text-2xl',
}

interface SongCoverProps {
  title: string
  src?: string | null
  size?: keyof typeof SIZES
  className?: string
}

/** Capa da música (imagem enviada ou gradiente gerado a partir do título) */
export function SongCover({ title, src, size = 'md', className }: SongCoverProps) {
  const [failed, setFailed] = useState(false)
  const gradient = GRADIENTS[hashString(title) % GRADIENTS.length]
  const letters = title
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÀ-Ú]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={`Capa de ${title}`}
        onError={() => setFailed(true)}
        loading="lazy"
        className={cn('shrink-0 bg-surface-2 object-cover ring-1 ring-black/5', SIZES[size], className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br font-extrabold tracking-tight text-white/95 shadow-inner',
        gradient,
        SIZES[size],
        className,
      )}
    >
      <Music2 className="absolute -right-1 -bottom-1 size-[55%] text-white/15" strokeWidth={1.5} />
      <span className="relative">{letters || '♪'}</span>
    </span>
  )
}
