import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'

type Tone = 'primary' | 'secondary' | 'ghost'

const tones: Record<Tone, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'bg-elevated text-ink border border-line hover:bg-hover',
  ghost: 'bg-transparent text-ink hover:bg-hover'
}

export function Button({
  tone = 'secondary',
  className = '',
  children,
  ...props
}: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }>) {
  return (
    <button
      type="button"
      className={`inline-flex h-7 items-center justify-center gap-1 rounded px-2 text-[12px] font-medium disabled:opacity-40 ${tones[tone]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
