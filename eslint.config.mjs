import nextVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  ...nextVitals,
  {
    ignores: ['.next/**', 'db/migrations/**', 'node_modules/**', 'public/sw.js'],
  },
];

export default eslintConfig;
