import preact from '@preact/preset-vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [preact()],
  build: {
    // ⛔ Un seul fichier, servi par le serveur Feedys sous /widget.js.
    //    Pas de paquet npm empaquetable par l’hôte : 04-Architecture/licences.md.
    lib: {
      entry: 'src/index.ts',
      name: 'feedys',
      formats: ['iife'],
      fileName: () => 'widget.js',
    },
    target: 'es2022',
    emptyOutDir: true,
  },
})
