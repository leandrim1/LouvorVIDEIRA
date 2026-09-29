import logoUrl from '@/assets/logo.png'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return <img src={logoUrl} alt="" width={36} height={36} className={cn('size-9 shrink-0 rounded-full', className)} aria-hidden />
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
