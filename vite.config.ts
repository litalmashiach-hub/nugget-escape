/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import type { Plugin } from 'vite';

/** The single-file build has no other files next to it, so drop the app manifest and icon links. */
const dropAppLinks: Plugin = {
  name: 'drop-app-links',
  transformIndexHtml: (html) => html.replace(/\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>/g, ''),
};

// `npm run build` makes a normal site in dist/ (for GitHub Pages).
// `npm run build:single` makes one self-contained HTML file in dist-single/.
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'single' ? [viteSingleFile(), dropAppLinks] : [],
  publicDir: mode === 'single' ? false : 'public',
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
}));
