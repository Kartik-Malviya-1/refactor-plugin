import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'path'
import { readFileSync } from 'fs'

export default defineConfig(({ mode }) => {
  if (mode === 'plugin') {
    let html = ''
    try {
      html = readFileSync(resolve(__dirname, 'dist/ui.html'), 'utf-8')
    } catch {
      // ui.html not built yet; build:ui must run first
    }

    return {
      define: {
        __html__: JSON.stringify(html),
      },
      build: {
        lib: {
          entry: resolve(__dirname, 'src/plugin/main.ts'),
          formats: ['iife'],
          name: 'RefactorPlugin',
          fileName: () => 'main.js',
        },
        outDir: 'dist',
        emptyOutDir: false,
        minify: false,
        rollupOptions: {
          output: {
            inlineDynamicImports: true,
          },
        },
      },
    }
  }

  return {
    plugins: [
      react(),
      viteSingleFile(),
      {
        name: 'rename-html',
        closeBundle() {
          const { renameSync, existsSync } = require('fs')
          const src = resolve(__dirname, 'dist/index.html')
          const dst = resolve(__dirname, 'dist/ui.html')
          if (existsSync(src)) renameSync(src, dst)
        },
      },
    ],
    build: {
      target: 'esnext',
      outDir: 'dist',
      emptyOutDir: false,
      cssCodeSplit: false,
      rollupOptions: {
        input: resolve(__dirname, 'index.html'),
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  }
})
