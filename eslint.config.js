import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `.claude/worktrees/` holds agent scratch checkouts — whole copies of this
  // repo. eslint's flat config doesn't read .gitignore, so without this it
  // lints the copies too and reports the same file twice (or fails on a stale
  // one). Never source we own; always ignore.
  { ignores: ['dist', '**/dist/**', 'server/dist', '.claude/**'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          allowExportNames: [
            'useToast',
            'useAuth',
            'useCart',
            'useI18n',
            'useBranding',
            'useNotifications',
            'useTheme',
            'useTableFlow',
            'LOCALE_NAMES',
          ],
        },
      ],
    },
  },
  {
    files: ['src/main.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Playwright specs are not React. The fixture API takes a callback named
    // `use`, which the rules-of-hooks heuristic mistakes for a React hook.
    files: ['e2e/**/*.ts'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  }
);
