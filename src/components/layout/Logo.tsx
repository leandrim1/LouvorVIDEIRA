import { useId } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  const gradientId = useId()
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9 shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradientId})`} />
      <g fill="#fff">
        <circle cx="26" cy="44" r="7" />
        <rect x="31" y="14" width="4" height="31" rx="2" />
        <path d="M33 14c6 0 12 3 14 10-4-3-8-4-14-4z" />
      </g>
    </svg>
  )
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-xl" aria-label="Louvor Videira — início">
      <LogoMark />
      {!compact && (
        <span className="leading-tight">
          <span className="block text-[15px] font-extrabold tracking-tight text-ink">Louvor Videira</span>
          <span className="block text-[11px] font-medium text-ink-3">Equipe de louvor</span>
        </span>
      )}
    </Link>
  )
}
