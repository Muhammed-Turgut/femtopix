import type { InputHTMLAttributes } from 'react'

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-6 w-full select-text rounded border border-transparent bg-input px-2 text-[12px] text-ink placeholder:text-muted outline-none hover:border-line focus:border-accent ${className}`}
      {...props}
    />
  )
}
