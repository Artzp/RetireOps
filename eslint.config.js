import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.base.json', './packages/*/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // TypeScript specific
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],

      // typescript-eslint v8 strict-type-checked additions / tightenings.
      // Downgraded to `warn` to preserve the v7 baseline of 0 lint errors
      // without touching production source. These remain visible so they
      // can be cleaned up incrementally in a dedicated migration phase.
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/no-unnecessary-type-conversion': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-misused-spread': 'warn',
      '@typescript-eslint/no-unnecessary-type-parameters': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/return-await': 'warn',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Web package: needs its own parserOptions with packages/web/tsconfig.json
    // so the `@/*` path alias resolves correctly. Without this override, eslint
    // picks up tsconfig.base.json (no aliases) and types `formatCurrency` etc.
    // as `error`, triggering spurious `no-unsafe-call` / `no-unsafe-assignment`.
    //
    // Strict-type-checked rules are downgraded to `warn` for web sources — the
    // package predates typescript-eslint strict mode and has accumulated a lot
    // of `as any` casts in JSX / API-response handling that are legitimate but
    // noisy. Warnings keep them visible without gating CI; they can be cleaned
    // up incrementally.
    files: ['packages/web/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./packages/web/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
  {
    // Test files: `!` non-null assertions are ergonomic for known-good fixtures,
    // and `any` / unsafe access often appear when poking at mocked shapes.
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      '**/*.integration.test.ts',
    ],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      'no-console': 'off',
    },
  },
  {
    // One-off scripts (seed / debug helpers): console output is the point.
    files: ['packages/*/scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    ignores: [
      'node_modules/**',
      '**/dist/**',
      '**/build/**',
      '.next/**',
      '**/.next/**',
      'out/**',
      'coverage/**',
      '**/coverage/**',
      '.claude/**',
      '**/playwright-report/**',
      '**/test-results/**',
      // Transient Playwright scratch dirs (gitignored via **/e2e/; kept locally for bug hunts)
      'packages/web/e2e/bug-hunt/**',
      'packages/web/e2e/profile/**',
      '*.config.js',
      '*.config.mjs',
      '**/*.config.js',
      '**/*.config.mjs',
      '**/*.config.cjs',
    ],
  }
);
