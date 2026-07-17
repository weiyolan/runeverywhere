// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'run-everywhere-app-design/*', 'supabase/functions/*'],
  },
  {
    // PLAN.md §1: a map-vendor swap must stay a one-module change.
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native-maps',
              message: 'Import from @/components/map/AppMap instead.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/components/map/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
]);
