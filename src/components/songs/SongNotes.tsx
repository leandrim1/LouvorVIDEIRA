import { useState, type FormEvent } from 'react'
import { MessageSquarePlus, StickyNote, Trash2 } from 'lucide-react'
import { useConfirm } from '@/contexts/confirm'
import { useSession } from '@/contexts/session'
import { useSongNotes } from '@/hooks/useData'
import { useMutation } from '@/hooks/useMutation'
import { timeAgo } from '@/lib/dates'
import { noteService } from '@/services'
import { Avatar, Button, IconButton, Skeleton, Textarea } from '@/components/ui'

interface SongNotesProps {
  songId: string
  generalNotes: string
}

/** Observações gerais da música + comentários da equipe */
export function SongNotes({ songId, generalNotes }: SongNotesProps) {
  const { member, can } = useSession()
  const confirm = useConfirm()
  const { data: notes, isLoading } = useSongNotes(songId)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const add = useMutation((content: string) => noteService.add(songId, member?.id ?? null, content), {
    success: 'Observação adicionada',
    onSuccess: () => setText(''),
  })
  const remove = useMutation((id: string) => noteService.remove(id), { success: 'Observação removida' })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (text.trim().length < 3) {
      setError('Escreva ao menos 3 caracteres.')
      return
    }
    setError(null)
    void add.mutate(text)
  }

  return (
    <div className="space-y-5">
      {generalNotes && (
        <div className="rounded-2xl bg-amber-50 p-4 dark:bg-amber-500/10">
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-amber-800 uppercase dark:text-amber-300">
            <StickyNote className="size-3.5" aria-hidden /> Observações da música
          </p>
          <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line text-amber-950 dark:text-amber-100">{generalNotes}</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-2" noValidate>
        <label htmlFor="new-note" className="text-[13px] font-semibold text-ink">
          Observações da equipe
        </label>
        <Textarea
          id="new-note"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (error) setError(null)
          }}
          invalid={!!error}
          rows={2}
          placeholder="Ex.: virada de bateria antes do refrão, entrada do teclado…"
        />
        {error && (
          <p id="new-note-error" role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" size="sm" leftIcon={<MessageSquarePlus />} loading={add.isPending}>
            Adicionar observação
          </Button>
        </div>
      </form>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : !notes || notes.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-3">Nenhuma observação da equipe ainda.</p>
      ) : (
        <ul className="space-y-2.5">
          {notes.map((note) => {
            const canDelete = can('songs:write') || (member && note.authorId === member.id)
            return (
              <li key={note.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3.5">
                <Avatar name={note.author?.name ?? 'Equipe'} src={note.author?.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-3">
                    <span className="font-semibold text-ink">{note.author?.name ?? 'Equipe'}</span> · {timeAgo(note.createdAt)}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-ink-2">{note.content}</p>
                </div>
                {canDelete && (
                  <IconButton
                    label="Excluir observação"
                    size="icon-sm"
                    variant="danger-ghost"
                    onClick={async () => {
                      if (await confirm({ title: 'Excluir observação?', confirmLabel: 'Excluir', danger: true })) void remove.mutate(note.id)
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
