module.exports = {
  plugins:["react-compiler"],
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    '@electron-toolkit/eslint-config-ts/recommended',
    '@electron-toolkit/eslint-config-prettier'
  ],
  overrides: [
    {
      files: ['**/*.{js,jsx,ts,tsx}'],
      rules: {
        'padding-line-between-statements': [
          'error',
          {
            blankLine: 'always',
            prev: '*',
            next: 'return'
          }
        ],
        '@typescript-eslint/consistent-type-definitions': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/explicit-module-boundary-types': ['error'],
        '@typescript-eslint/no-unused-vars': [
          'error',
          {
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_'
          }
        ],

        '@typescript-eslint/triple-slash-reference': [
          'error',
          {
            types: 'always'
          }
        ],
        'react/display-name': 'off',
        'react/prop-types': 'off'
      }
    }
  ],
  ignorePatterns: ['.eslintrc.*', 'electron-vite.config.*']
}
