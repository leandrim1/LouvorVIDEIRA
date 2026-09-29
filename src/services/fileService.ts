import { readImageAsBlob, readImageAsDataUrl } from '@/lib/utils'
import type { FileKind, StoredFile } from '@/types'
import { apiFetch } from './apiClient'
import { isServerMode } from './config'

export interface UploadOptions {
  kind: Extract<FileKind, 'cover' | 'photo'>
  /** Lado maior da imagem, em pixels */
  maxSize: number
  songId?: string
  memberId?: string
}

/**
 * Arquivos enviados pelo usuário.
 * - Com o banco real: a imagem vai para o Vercel Blob e o banco guarda apenas a URL e os metadados.
 * - Na demonstração: a imagem fica no próprio navegador (data URL).
 */
export const fileService = {
  async uploadImage(file: File, { kind, maxSize, songId, memberId }: UploadOptions): Promise<string> {
    if (!isServerMode) return readImageAsDataUrl(file, maxSize)
    // Resolução maior que a da demonstração: nítida em telas de alta densidade
    const image = await readImageAsBlob(file, maxSize * 2)
    const form = new FormData()
    form.append('file', image, `${kind}.jpg`)
    form.append('kind', kind)
    if (songId) form.append('songId', songId)
    if (memberId) form.append('memberId', memberId)
    const saved = await apiFetch<StoredFile>('files', { method: 'POST', body: form })
    return saved.url
  },
}
