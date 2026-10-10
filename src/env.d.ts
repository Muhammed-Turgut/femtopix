/// <reference types="vite/client" />

declare module '*.png' {
  const src: string
  export default src
}

import type { IvecDesktopApi } from './shared/api'

declare global {
  interface Window {
    ivec?: IvecDesktopApi
  }
}

export {}
