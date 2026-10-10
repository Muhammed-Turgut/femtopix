import type { ButtonHTMLAttributes } from 'react'

export function IconButton({
  active,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex size-7 items-center justify-center rounded disabled:opacity-40 ${
        active ? 'bg-accent text-on-accent' : 'text-muted hover:bg-hover hover:text-ink'
      } ${className}`}
      {...props}
    />
  )
}
