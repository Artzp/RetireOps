import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    setupFiles: ['./src/test/integration-setup.ts'],
    testTimeout: 30000, // 30 seconds - calculations may take longer
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/services/projection.service.ts',
        'src/services/projection-transformer.ts',
        'src/routes/projections.routes.ts',
        'src/services/profile.service.ts',
        'src/services/profile-assembler.ts',
        'src/routes/profile.routes.ts',
        'src/services/solver.service.ts',
        'src/routes/solver.routes.ts',
      ],
    },
  },
});
