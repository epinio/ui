//@ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from "globals";
  
export default tseslint.config(
{
  ignores: [
    '**/dist/**',
    '**/dist-pkg/**',
    '**/.yarn/**',
    '**/babel.config.js',
    '**/vue.config.js'
  ],
},
eslint.configs.recommended,
...tseslint.configs.recommended,
...pluginVue.configs['flat/recommended'],
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-useless-template-attributes': 'off',
    'vue/no-mutating-props': 'off',
    'vue/v-on-event-hyphenation': 'off',
    'vue/attribute-hyphenation': 'off'
  },
  plugins: {
    'typescript-eslint': tseslint.plugin,
  },
  languageOptions: {
    globals: {
      ...globals.browser
    },
    parserOptions: {
      parser: tseslint.parser,
      project: './tsconfig.json',
      extraFileExtensions: ['.vue'],
      sourceType: 'module',
    },
  },
},
eslintConfigPrettier
);
