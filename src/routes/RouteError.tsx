import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { buttonClasses } from '@/components/ui/styles'

/** Tela de erro inesperado (quebra de renderização ou falha ao carregar a rota) */
export function RouteError({ inline }: { inline?: boolean }) {
  const error = useRouteError()
  const chunkError = error instanceof Error && /dynamically imported module|Failed to fetch/i.test(error.message)
  const message = isRouteErrorResponse(error)
    ? `${error.status} — ${error.statusText}`
    : chunkError
      ? 'Uma nova versão do aplicativo está disponível. Recarregue a página.'
      : error instanceof Error
        ? error.message
        : 'Erro desconhecido.'

  return (
    <div className={inline ? 'py-16' : 'flex min-h-dvh items-center justify-center bg-canvas p-6'}>
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-500/10">
          <AlertTriangle className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-extrabold tracking-tight text-ink">Algo deu errado</h1>
        <p className="mt-2 text-sm text-ink-2">{message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" onClick={() => window.location.reload()} className={buttonClasses('secondary')}>
            <RefreshCw /> Recarregar
          </button>
          <Link to="/" className={buttonClasses('primary')}>
            <Home /> Ir para o início
          </Link>
        </div>
      </div>
    </div>
  )
}
