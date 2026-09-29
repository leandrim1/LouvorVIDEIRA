import { forwardRef, type InputHTMLAttributes } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClasses } from './styles'

interface SearchBarProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'size'> {
  value: string
  onChange: (value: string) => void
  label?: string
  size?: 'md' | 'lg'
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  { value, onChange, label = 'Pesquisar', placeholder = 'Pesquisar…', className, size = 'md', ...props },
  ref,
) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(inputClasses, 'pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden', size === 'lg' ? 'h-12 text-base' : 'h-11 sm:h-10')}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
          aria-label="Limpar busca"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  )
})
