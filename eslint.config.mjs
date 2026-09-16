/**
 * ESLint flat config (ESLint 9; migrated from .eslintrc.json 2026-09-16).
 *
 * Preserves every rule/override of the legacy config 1:1:
 * - next/core-web-vitals + next/typescript presets
 * - @typescript-eslint/no-unused-vars with _ ignores
 * - scripts/dev-scripts a11y relaxations (require-imports, explicit-any)
 * - app/components/context/hooks no-console (except tests)
 * - no-restricted-imports guard rails (framer-motion, deleted kits)
 * Ignores merge the old .eslintignore + ignorePatterns, minus entries for
 * files that no longer exist (fix_alliance.js, fix_wmd_files.js, nul).
 */
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const restrictedPatterns = [
  {
    group: ['framer-motion', 'framer-motion/*'],
    message:
      'framer-motion was uninstalled by FID-20260908-013. Use CSS token animations (gated nn-fade / nn-spin-icon / nn-pulse in app/neon-noir.css).',
  },
  {
    group: [
      '**/components/transitions',
      '**/components/transitions/*',
      '**/transitions/StaggerChildren',
      '**/transitions/PageTransition',
      '**/transitions/LoadingSpinner',
    ],
    message:
      'components/transitions was deleted by FID-20260908-013. Render plain nodes with gated nn-fade / nn-spin-icon (see ClanChatPanel, AchievementPanel).',
  },
  {
    group: ['@/lib/animations', '@/lib/animations/*'],
    message:
      'lib/animations was deleted by FID-20260908-013 (framer-coupled). Use token primitives in app/neon-noir.css.',
  },
  {
    group: ['@/lib/designTokens', '@/lib/designTokens/*'],
    message:
      'lib/designTokens was deleted by FID-20260908-013. Design tokens live in app/neon-noir.css CSS custom properties.',
  },
  {
    group: ['@/lib/microInteractions', '@/lib/microInteractions/*'],
    message:
      'lib/microInteractions was deleted by FID-20260908-013. Use token primitives in app/neon-noir.css.',
  },
  {
    group: ['@/components/ui', '**/components/ui'],
    importNames: [
      'Button',
      'Card',
      'Panel',
      'Badge',
      'Input',
      'Divider',
      'IconButton',
      'StatCard',
      'ProgressBar',
      'Skeleton',
      'Alert',
    ],
    message:
      'The styling-slab kit was deleted by FID-20260908-013. Use the token primitives (.nn-btn, .nn-panel, .nn-chip, .nn-input, ...) in app/neon-noir.css. Only confirmDialog/ConfirmDialogHost and RichTextEditor remain in @/components/ui.',
  },
  {
    group: [
      '@/components/ui/Button',
      '@/components/ui/Card',
      '@/components/ui/Panel',
      '@/components/ui/Badge',
      '@/components/ui/Input',
      '@/components/ui/Divider',
      '@/components/ui/IconButton',
      '@/components/ui/StatCard',
      '@/components/ui/ProgressBar',
      '@/components/ui/Skeleton',
      '@/components/ui/Alert',
      '**/components/ui/Button',
      '**/components/ui/Card',
      '**/components/ui/Panel',
      '**/components/ui/Badge',
      '**/components/ui/Input',
      '**/components/ui/Divider',
      '**/components/ui/IconButton',
      '**/components/ui/StatCard',
      '**/components/ui/ProgressBar',
      '**/components/ui/Skeleton',
      '**/components/ui/Alert',
    ],
    message:
      'This styling-slab file was deleted by FID-20260908-013. Use the token primitives in app/neon-noir.css.',
  },
];

/**
 * Flat-config array in a named binding: a bare `export default [...]`
 * trips import/no-anonymous-default-export on this file itself.
 */
const config = [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'dev/archives/**'],
  },
  ...nextVitals,
  ...nextTs,
  {
    name: 'darkframe/foundation',
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // React Compiler soundness rules (new in eslint-config-next 16 via
      // react-hooks v6; never enforced by the previous toolchain).
      // Parked OFF 2026-09-16 with triage counts from the upgrade run:
      // set-state-in-effect 86, purity 19, refs 6, static-components 4,
      // immutability 1, preserve-manual-memoization 5 (150 sites total).
      // Re-enabling is a per-site refactor project, not a drive-by.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/static-components': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
  {
    files: [
      'scripts/**/*.js',
      'scripts/**/*.cjs',
      'scripts/**/*.ts',
      'dev/scripts/**/*.js',
      'dev/scripts/**/*.cjs',
      'dev/scripts/**/*.ts',
    ],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: [
      'app/**/*.ts',
      'app/**/*.tsx',
      'components/**/*.ts',
      'components/**/*.tsx',
      'context/**/*.ts',
      'context/**/*.tsx',
      'hooks/**/*.ts',
      'hooks/**/*.tsx',
    ],
    ignores: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', { patterns: restrictedPatterns }],
    },
  },
];

export default config;
