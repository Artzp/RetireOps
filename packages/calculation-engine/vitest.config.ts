import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Solver + funded-status tests run numerical convergence loops that
    // exceed the vitest default 5s on slower CI runners (TC-PROJ-039/041,
    // TC-SOLVER-002/005). Locally these complete in 2-3s.
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
  },
});
