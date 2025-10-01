import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // Keep the useful Next/TS/import configs
  ...compat.extends(
    'next/core-web-vitals',
    'next/typescript',
    'plugin:import/recommended'
    // intentionally NOT extending 'prettier' or 'plugin:prettier/recommended'
  ),

  // Final override layer: explicitly disable Prettier-as-ESLint errors
  {
    rules: {
      'prettier/prettier': 'off',
    },
  },
];

export default eslintConfig;
