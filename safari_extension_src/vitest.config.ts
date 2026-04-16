import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/types/**', 'src/content/ui/GesturePreview.ts', 'src/content/ui/QuickActionHUD.ts', 'src/content/index.ts', 'src/content/ui/FeedbackOverlay.ts'],
    },
  },
});
