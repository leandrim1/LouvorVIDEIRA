import { createContext, useContext } from 'react'

export interface CommandPaletteContextValue {
  open: () => void
  close: () => void
  isOpen: boolean
}

export const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null)

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext)
  if (!ctx) throw new Error('useCommandPalette deve ser usado dentro do AppLayout')
  return ctx
}
