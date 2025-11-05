import path from 'node:path'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import zip from 'vite-plugin-zip-pack'
import manifest from './manifest.config.js'
import { name, version } from './package.json'
import { copyFileSync, mkdirSync } from 'node:fs'

function copyWasmPlugin() {
  const wasmFiles = [
    'ort-wasm-simd-threaded.jsep.wasm',
    'ort-wasm-simd-threaded.jsep.mjs',
  ];

  const copyFiles = (dest: string) => {
    mkdirSync(dest, { recursive: true });

    wasmFiles.forEach(file => {
      const src = path.resolve(__dirname, `node_modules/@huggingface/transformers/dist/${file}`);
      const destFile = path.resolve(__dirname, `${dest}/${file}`);
      try {
        copyFileSync(src, destFile);
        console.log(`Copied ${file} to ${dest}/`);
      } catch (err) {
        console.error(`Failed to copy ${file} to ${dest}:`, err);
      }
    });
  };

  return {
    name: 'copy-wasm',
    buildStart() {
      copyFiles('public');
      copyFiles('dist');
    },
    closeBundle() {
      copyFiles('dist');
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': `${path.resolve(__dirname, 'src')}`,
    },
  },
  plugins: [
    react(),
    crx({ manifest }),
    copyWasmPlugin(),
    zip({ outDir: 'release', outFileName: `crx-${name}-${version}.zip` }),
  ],
  build: {
    rollupOptions: {
      input: {
        offscreen: path.resolve(__dirname, 'src/offscreen/offscreen.html'),
      },
    },
  },
  server: {
    cors: {
      origin: [
        /chrome-extension:\/\//,
      ],
    },
  },
})
