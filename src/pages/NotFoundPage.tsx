import { Compass, Home } from 'lucide-react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { ButtonLink, EmptyState } from '@/components/ui'

export default function NotFoundPage() {
  useDocumentTitle('Página não encontrada')
  return (
    <EmptyState
      as="h1"
      className="mt-10"
      icon={<Compass />}
      title="Página não encontrada"
      description="O endereço acessado não existe ou foi removido."
      action={
        <ButtonLink to="/" leftIcon={<Home />}>
          Voltar ao início
        </ButtonLink>
      }
    />
  )
}
