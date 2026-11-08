import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = [
  {
    ignores: ['**/.next/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  ...nextVitals,
  ...nextTs,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      'react/no-unescaped-entities': 'warn',
      'react-hooks/exhaustive-deps': 'warn',
      // Regras do React Compiler (eslint-plugin-react-hooks 7), que o projeto não usa.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
      '@next/next/no-img-element': 'warn',
      'import/no-anonymous-default-export': 'off',
    },
  },
];

export default eslintConfig;
