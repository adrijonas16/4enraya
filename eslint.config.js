import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['js/vendor/**', 'node_modules/**', 'dist-artifact/**', 'playwright-report/**', 'test-results/**'] },
    js.configs.recommended,
    {
        // Código del navegador: scripts clásicos que comparten globales
        files: ['js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                api: 'writable', API: 'readonly',
                Engine: 'readonly', Sound: 'readonly', Particles: 'readonly',
                Scene: 'readonly', RoomNet: 'readonly', NetCodec: 'readonly', Social: 'readonly',
                SITE: 'readonly', Analytics: 'readonly', Validate: 'readonly',
            },
        },
        rules: {
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
            'no-empty': ['error', { allowEmptyCatch: true }],
            eqeqeq: ['error', 'smart'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-implicit-globals': 'off',
        },
    },
    {
        // api.js es quien declara API y api
        files: ['js/utils/api.js'],
        rules: { 'no-redeclare': ['error', { builtinGlobals: false }] },
    },
    {
        files: ['scripts/**/*.mjs', 'tests/**/*.js', 'tests/**/*.mjs', 'playwright.config.js', 'eslint.config.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: { ...globals.node } },
    },
    {
        // las pruebas E2E pasan funciones que se ejecutan dentro de la página
        files: ['tests/e2e/**/*.js'],
        languageOptions: { globals: { ...globals.browser, app: 'readonly', Social: 'readonly', Engine: 'readonly' } },
    },
    {
        // dobles de Supabase y de la sala que se inyectan en el navegador
        files: ['tests/fakes/**/*.js'],
        languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
    },
];
