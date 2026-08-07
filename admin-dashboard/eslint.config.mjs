import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

const config = [
  {
    ignores: ['coverage/**', 'playwright-report/**', 'test-results/**']
  },
  ...nextVitals,
  ...nextTypeScript
];

export default config;
