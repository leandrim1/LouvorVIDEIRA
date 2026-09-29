import { Mail, MessageCircle, Mic, Phone } from 'lucide-react'
import { MEMBER_ROLE_LABELS, VOICE_LABELS } from '@/lib/constants'
import { cn, whatsappLink } from '@/lib/utils'
import type { Member } from '@/types'
import { Avatar, Badge } from '@/components/ui'

interface MemberCardProps {
  member: Member
  onOpen?: (member: Member) => void
  className?: string
}

export function MemberCard({ member, onOpen, className }: MemberCardProps) {
  const whatsapp = whatsappLink(member.phone)
  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-xs transition-all hover:border-line-strong hover:shadow-md',
        !member.active && 'opacity-60',
        className,
      )}
    >
      <div className="flex items-start gap-3.5">
        <Avatar name={member.name} src={member.photoUrl} size="lg" />
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate text-base font-bold text-ink">
            {onOpen ? (
              <button
                type="button"
                onClick={() => onOpen(member)}
                className="text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-brand-500"
              >
                {member.name}
              </button>
            ) : (
              member.name
            )}
          </h3>
          <p className="truncate text-[13px] text-ink-3">
            {[member.instrument, member.voice !== 'none' ? VOICE_LABELS[member.voice] : null].filter(Boolean).join(' · ') || '—'}
          </p>
          {!member.active && <Badge className="mt-1.5">Inativo</Badge>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {member.roles.map((role) => (
          <Badge key={role} tone={role === 'leader' ? 'brand' : 'neutral'}>
            {role === 'vocal' || role === 'backing_vocal' ? <Mic /> : null}
            {MEMBER_ROLE_LABELS[role]}
          </Badge>
        ))}
      </div>
      <div className="relative z-10 mt-auto flex gap-1.5 pt-4">
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20"
            aria-label={`WhatsApp de ${member.name}`}
          >
            <MessageCircle className="size-4" /> WhatsApp
          </a>
        )}
        {member.phone && (
          <a
            href={`tel:${member.phone.replace(/[^\d+]/g, '')}`}
            className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
            aria-label={`Ligar para ${member.name}`}
            title={member.phone}
          >
            <Phone className="size-4" />
          </a>
        )}
        {member.email && (
          <a
            href={`mailto:${member.email}`}
            className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-ink-2 transition-colors hover:bg-surface-3 hover:text-ink"
            aria-label={`Enviar e-mail para ${member.name}`}
            title={member.email}
          >
            <Mail className="size-4" />
          </a>
        )}
      </div>
    </article>
  )
}
