import { describe, expect, it } from 'vitest'
import { detectLinkType, getVimeoId, getYouTubeId, parseVideoUrl } from '../video'

describe('YouTube', () => {
  it.each([
    ['https://www.youtube.com/watch?v=2SveruIMFBM', '2SveruIMFBM'],
    ['https://youtu.be/2SveruIMFBM?t=30', '2SveruIMFBM'],
    ['https://m.youtube.com/watch?v=2SveruIMFBM&pp=x', '2SveruIMFBM'],
    ['https://www.youtube.com/shorts/2SveruIMFBM', '2SveruIMFBM'],
    ['https://www.youtube.com/embed/2SveruIMFBM', '2SveruIMFBM'],
    ['https://music.youtube.com/watch?v=2SveruIMFBM', '2SveruIMFBM'],
  ])('extrai o id de %s', (url, id) => {
    expect(getYouTubeId(url)).toBe(id)
  })

  it('gera player incorporado com início', () => {
    const parsed = parseVideoUrl('https://youtu.be/2SveruIMFBM?t=1m30s')
    expect(parsed.provider).toBe('youtube')
    expect(parsed.embedUrl).toContain('youtube-nocookie.com/embed/2SveruIMFBM')
    expect(parsed.embedUrl).toContain('start=90')
  })

  it('ignora links inválidos', () => {
    expect(getYouTubeId('https://www.youtube.com/results?search_query=x')).toBeNull()
    expect(getYouTubeId('não é url')).toBeNull()
  })
})

describe('Vimeo e links externos', () => {
  it('detecta Vimeo', () => {
    expect(getVimeoId('https://vimeo.com/123456789')).toBe('123456789')
    expect(parseVideoUrl('https://player.vimeo.com/video/123456789').provider).toBe('vimeo')
  })
  it('trata outros links como externos', () => {
    expect(parseVideoUrl('https://drive.google.com/file/abc').provider).toBe('other')
  })
  it('detecta o tipo de link', () => {
    expect(detectLinkType('https://open.spotify.com/track/1')).toBe('spotify')
    expect(detectLinkType('https://music.apple.com/br/album/x')).toBe('apple_music')
    expect(detectLinkType('https://www.cifraclub.com.br/x/y/')).toBe('cifraclub')
    expect(detectLinkType('https://exemplo.com')).toBe('other')
  })
})
