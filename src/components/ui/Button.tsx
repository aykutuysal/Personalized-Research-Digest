// src/components/ui/Button.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'ghost'
type Size = 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,color,transform] duration-[var(--dur-sm)] focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-ring active:scale-[0.97] disabled:opacity-60 disabled:pointer-events-none'

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
  ghost: 'bg-transparent text-ink-soft hover:bg-accent-soft hover:text-ink',
}

const sizes: Record<Size, string> = {
  md: 'h-10 px-4 text-[15px]',
  lg: 'h-12 px-6 text-[16px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', ...rest }, ref) => {
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`.trim()}
        {...rest}
      />
    )
  },
)

Button.displayName = 'Button'
