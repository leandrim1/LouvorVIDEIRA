import { DISPLAY_STATUS_LABELS, repertoireDisplayStatus } from '@/lib/repertoire'
import type { ChurchEvent, RepertoireStatus } from '@/types'
import { Badge } from '@/components/ui'

export function RepertoireStatusBadge({ status, event }: { status: RepertoireStatus; event: ChurchEvent }) {
  const display = repertoireDisplayStatus(status, event)
  const tone = display === 'draft' ? 'warning' : display === 'published' ? 'success' : 'neutral'
  return (
    <Badge tone={tone} dot>
      {DISPLAY_STATUS_LABELS[display]}
    </Badge>
  )
}
