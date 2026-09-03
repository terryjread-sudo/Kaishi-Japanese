import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '**/*.js', '**/*.mjs', 'scripts/**', 'tools/**', 'tmp/**', 'media/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-globals': ['error', {
        name: 'localStorage',
        message: 'Use the platform storage repository instead of direct localStorage access.',
      }],
    },
  },
  {
    files: ['src/platform/storage.ts', 'src/**/*.test.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
);
