/** Formatação dos dispositivos confiáveis */
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export const isMobileOs = (os: string) => os === 'Android' || os === 'iOS'
