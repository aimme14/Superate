// Habilita bulk suppressions (.eslint-bulk-suppressions.json) para congelar
// deuda legacy de reglas específicas sin debilitar la regla para código nuevo.
require('@rushstack/eslint-patch/eslint-bulk-suppressions')

module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  // `functions/` es un paquete aparte (su propio ESLint/tsconfig). No lintarlo
  // desde la raíz evita parsing errors por project mismatch.
  ignorePatterns: ['dist', 'functions', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    // Fast Refresh: muchos módulos exportan hooks + componentes a propósito
    // (contexts, barrels). Mantenerlo como warn no aporta con --max-warnings 0.
    'react-refresh/only-export-components': 'off',
  },
}
