import { cn } from '@/lib/utils'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'soft' | 'danger' | 'danger-ghost'
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'

const base =
  'inline-flex shrink-0 items-center justify-center gap-2 font-semibold whitespace-nowrap select-none transition-[background-color,color,box-shadow,transform,opacity] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 [&_svg]:shrink-0'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-600 text-white shadow-sm shadow-brand-900/15 hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400',
  secondary: 'bg-surface text-ink shadow-xs ring-1 ring-inset ring-line hover:bg-surface-2 hover:ring-line-strong',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  subtle: 'bg-surface-2 text-ink hover:bg-surface-3',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/12 dark:text-brand-300 dark:hover:bg-brand-500/20',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600',
  'danger-ghost': 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10',
}

const sizes: Record<ButtonSize, string> = {
  xs: 'h-7 rounded-lg px-2.5 text-xs [&_svg]:size-3.5',
  sm: 'h-9 rounded-lg px-3 text-[13px] [&_svg]:size-4',
  md: 'h-10 rounded-xl px-4 text-sm [&_svg]:size-4',
  lg: 'h-12 rounded-xl px-5 text-[15px] [&_svg]:size-5',
  icon: 'size-10 rounded-xl [&_svg]:size-[18px]',
  'icon-sm': 'size-8 rounded-lg [&_svg]:size-4',
  'icon-lg': 'size-12 rounded-xl [&_svg]:size-5',
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className)
}

export const inputClasses =
  'block w-full rounded-xl border-0 bg-surface px-3.5 text-[15px] text-ink shadow-xs ring-1 ring-inset ring-line placeholder:text-ink-3 transition-shadow hover:ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm aria-[invalid=true]:ring-red-500/70 dark:aria-[invalid=true]:ring-red-400/70'

export const cardClasses = 'rounded-2xl border border-line bg-surface shadow-xs'
