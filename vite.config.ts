/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // .tsx-tester (komponenttester) väljer jsdom per fil via
    // "@vitest-environment jsdom" — node förblir default för rena moduler.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
