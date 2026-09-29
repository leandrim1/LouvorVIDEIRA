import type { ReactNode } from 'react'
import { LogoMark } from '@/components/layout/Logo'

/** Moldura das telas de acesso: marca à esquerda (desktop) e formulário */
export function AuthLayout({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-leaf-700 via-brand-700 to-grape-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-32 -right-24 size-96 rounded-full bg-white/10 blur-3xl" aria-hidden />
        <div className="relative flex items-center gap-3">
          <LogoMark className="size-12 ring-2 ring-white/30" />
          <span className="text-xl font-extrabold tracking-tight">Louvor Videira</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-3xl leading-tight font-extrabold tracking-tight text-balance">O que vamos tocar hoje? Qual o tom? Quem está escalado?</p>
          <p className="mt-4 text-white/80">Repertórios, cifras, vídeos, escalas e ensaios da equipe de louvor em um só lugar.</p>
        </div>
        <p className="relative text-sm text-white/60">Igreja Videira · Ministério de Louvor</p>
      </aside>

      <main className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <LogoMark className="mb-5 size-16 lg:hidden" />
            <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
            {description && <p className="mt-1.5 text-sm text-ink-3">{description}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}
