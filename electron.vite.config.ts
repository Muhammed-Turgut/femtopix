import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const root = resolve(__dirname)

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(root, 'electron/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(root, 'electron/preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve(root, 'src'),
    resolve: {
      alias: {
        '@': resolve(root, 'src')
      }
    },
    server: {
      fs: {
        allow: [root]
      }
    },
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        input: resolve(root, 'src/index.html')
      }
    }
  }
})
