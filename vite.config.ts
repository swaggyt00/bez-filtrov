import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative assets make the build work both at a custom domain and at
  // https://<user>.github.io/<repository>/ without hard-coding a repo name.
  base: './',
  plugins: [react()],
})
