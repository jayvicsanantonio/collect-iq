// Flat ESLint config for ESLint v9+
// Uses @eslint/js base, TypeScript-ESLint recommended, and Prettier formatting enforcement

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier';
import eslintConfigPrettier from 'eslint-config-prettier';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  {
    ignores: [
      'node_modules/**',
      '.pnpm-store/**',
      'dist/**',
      'build/**',
      'lib/**',
      'coverage/**',
      '.next/**',
      '**/.next/**',
      'apps/*/.next/**',
      'out/**',
      '.turbo/**',
      '.eslintcache',
      '**/*.tsbuildinfo',
    ],
  },
  js.configs.recommended,
  // TypeScript ESLint recommended rules (no type-aware rules to keep it fast)
  ...tseslint.configs.recommended,
  // Disable rules that conflict with Prettier
  eslintConfigPrettier,
  // Enforce Prettier formatting via ESLint
  {
    plugins: { prettier },
    rules: {
      'prettier/prettier': 'error',
    },
  },
  // Next.js rules for the web app
  {
    files: ['apps/web/**/*.{js,jsx,ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    settings: {
      next: {
        rootDir: ['apps/web'],
      },
    },
    rules: {
      // Apply Next's core web vitals ruleset
      ...nextPlugin.configs['core-web-vitals']?.rules,
    },
  },
];
