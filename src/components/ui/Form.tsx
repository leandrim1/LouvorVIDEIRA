import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClasses } from './styles'

interface FieldProps {
  label: string
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  className?: string
  children: ReactNode
  labelAction?: ReactNode
}

/** Rótulo + controle + ajuda/erro, com ids acessíveis */
export function Field({ label, htmlFor, hint, error, required, className, children, labelAction }: FieldProps) {
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink">
          {label}
          {required && (
            <span className="ml-0.5 text-red-500" aria-hidden>
              *
            </span>
          )}
        </label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  leftIcon?: ReactNode
  rightSlot?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, leftIcon, rightSlot, id, ...props },
  ref,
) {
  const input = (
    <input
      ref={ref}
      id={id}
      aria-invalid={invalid || undefined}
      aria-describedby={id ? (invalid ? `${id}-error` : `${id}-hint`) : undefined}
      className={cn(inputClasses, 'h-11 sm:h-10', leftIcon && 'pl-10', rightSlot && 'pr-10', className)}
      {...props}
    />
  )
  if (!leftIcon && !rightSlot) return input
  return (
    <div className="relative">
      {leftIcon && (
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-3 [&_svg]:size-4">{leftIcon}</span>
      )}
      {input}
      {rightSlot && <span className="absolute inset-y-0 right-1.5 flex items-center">{rightSlot}</span>}
    </div>
  )
})

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, id, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      id={id}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={id ? (invalid ? `${id}-error` : `${id}-hint`) : undefined}
      className={cn(inputClasses, 'resize-y py-2.5 leading-relaxed', className)}
      {...props}
    />
  )
})

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  options?: Array<{ value: string; label: string; disabled?: boolean }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, options, placeholder, children, id, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        id={id}
        aria-invalid={invalid || undefined}
        className={cn(inputClasses, 'h-11 appearance-none pr-9 sm:h-10', className)}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  )
})

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  description?: ReactNode
}

export function Checkbox({ label, description, className, id, checked, ...props }: CheckboxProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <label htmlFor={inputId} className={cn('group flex cursor-pointer items-start gap-3 select-none', className)}>
      <span className="relative mt-0.5 flex size-5 shrink-0 items-center justify-center">
        <input id={inputId} type="checkbox" checked={checked} className="peer sr-only" {...props} />
        <span className="absolute inset-0 rounded-md bg-surface ring-1 ring-line-strong ring-inset transition-colors peer-checked:bg-brand-600 peer-checked:ring-brand-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500 dark:peer-checked:bg-brand-500 dark:peer-checked:ring-brand-500" />
        <Check className="relative size-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" strokeWidth={3} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="block text-xs text-ink-3">{description}</span>}
      </span>
    </label>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId()
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-xs text-ink-3">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-brand-600 dark:bg-brand-500' : 'bg-surface-3',
        )}
      >
        <span
          className={cn(
            'inline-block size-5 rounded-full bg-white shadow-sm transition-transform',
            checked ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode }>
  label: string
  size?: 'sm' | 'md'
  className?: string
  fullWidth?: boolean
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
  fullWidth,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex rounded-xl bg-surface-2 p-1 ring-1 ring-line ring-inset', fullWidth && 'flex w-full', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold whitespace-nowrap transition-all [&_svg]:size-4',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              fullWidth && 'flex-1',
              active ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-3 hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
