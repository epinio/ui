module.exports = {
  extends: [
    '.eslintrc.default.js'
  ],
  rules: {
    'dot-notation':                           'off',
    'generator-star-spacing':                 'off',
    'guard-for-in':                           'off',
    'linebreak-style':                        'off',
    'new-cap':                                'off',
    'no-empty':                               'off',
    'no-extra-boolean-cast':                  'off',
    'no-new':                                 'off',
    'no-plusplus':                            'off',
    'no-useless-escape':                      'off',
    'nuxt/no-cjs-in-config':                  'off',
    'semi-spacing':                           'off',
    'space-in-parens':                        'off',
    strict:                                   'off',
    'unicorn/no-new-buffer':                  'off',
    'vue/html-self-closing':                  'off',
    'vue/multi-word-component-names':         'off',
    'vue/no-reserved-component-names':        'off',
    'vue/no-deprecated-v-on-native-modifier': 'off',
    'vue/no-useless-template-attributes':     'off',
    'vue/no-unused-components':               'warn',
    'vue/no-v-html':                          'error',
    'wrap-iife':                              'off',
    'array-bracket-spacing':                  'warn',
    'arrow-parens':                           'warn',
    'arrow-spacing':                          [
      'warn',
      {
        before: true,
        after:  true
      }
    ],
    'block-spacing': [
      'warn',
      'always'
    ],
    'brace-style': [
      'warn',
      '1tbs'
    ],
    'comma-dangle': [
      'warn',
      'only-multiline'
    ],
    'comma-spacing':     'warn',
    curly:               'warn',
    eqeqeq:              'warn',
    'func-call-spacing': [
      'warn',
      'never'
    ],
    'implicit-arrow-linebreak': 'warn',
    indent:                     [
      'warn',
      2
    ],
    'keyword-spacing':             'warn',
    'lines-between-class-members': [
      'warn',
      'always',
      { exceptAfterSingleLine: true }
    ],
    'multiline-ternary': [
      'warn',
      'never'
    ],
    'newline-per-chained-call': [
      'warn',
      { ignoreChainWithDepth: 4 }
    ],
    'no-caller':      'warn',
    'no-cond-assign': [
      'warn',
      'except-parens'
    ],
    'no-console':                    'warn',
    'no-debugger':                   'warn',
    'no-eq-null':                    'warn',
    'no-eval':                       'warn',
    'no-trailing-spaces':            'warn',
    'no-undef':                      'warn',
    'no-unused-vars':                'warn',
    'no-whitespace-before-property': 'warn',
    'object-curly-spacing':          [
      'warn',
      'always'
    ],
    'object-property-newline': 'warn',
    'object-shorthand':        'warn',
    'padded-blocks':           [
      'warn',
      'never'
    ],
    'prefer-arrow-callback': 'warn',
    'prefer-template':       'warn',
    'quote-props':           'warn',
    'rest-spread-spacing':   'warn',
    semi:                    [
      'warn',
      'always'
    ],
    'space-before-function-paren': [
      'warn',
      'never'
    ],
    'space-infix-ops':        'warn',
    'spaced-comment':         'warn',
    'switch-colon-spacing':   'warn',
    'template-curly-spacing': [
      'warn',
      'always'
    ],
    'yield-star-spacing': [
      'warn',
      'both'
    ],
    'key-spacing': [
      'warn',
      {
        align: {
          beforeColon: false,
          afterColon:  true,
          on:          'value',
          mode:        'minimum'
        },
        multiLine: {
          beforeColon: false,
          afterColon:  true
        }
      }
    ],
    'object-curly-newline': [
      'warn',
      {
        ObjectExpression: {
          multiline:     true,
          minProperties: 3
        },
        ObjectPattern: {
          multiline:     true,
          minProperties: 4
        },
        ImportDeclaration: {
          multiline:     true,
          minProperties: 5
        },
        ExportDeclaration: {
          multiline:     true,
          minProperties: 3
        }
      }
    ],
    'padding-line-between-statements': [
      'warn',
      {
        blankLine: 'always',
        prev:      '*',
        next:      'return'
      },
      {
        blankLine: 'always',
        prev:      'function',
        next:      'function'
      },
      {
        blankLine: 'always',
        prev:      [
          'const',
          'let',
          'var'
        ],
        next: '*'
      },
      {
        blankLine: 'any',
        prev:      [
          'const',
          'let',
          'var'
        ],
        next: [
          'const',
          'let',
          'var'
        ]
      }
    ],
    quotes: [
      'warn',
      'single',
      {
        avoidEscape:           true,
        allowTemplateLiterals: true
      }
    ],
    'space-unary-ops': [
      'warn',
      {
        words:    true,
        nonwords: false
      }
    ],
    'vue/order-in-components':            'off',
    'vue/no-lone-template':               'off',
    'vue/v-slot-style':                   'off',
    'vue/component-tags-order':           'off',
    'vue/no-mutating-props':              'off',
    '@typescript-eslint/no-unused-vars':  'off',
    '@typescript-eslint/no-var-requires': 'off',
    '@typescript-eslint/no-this-alias':   'off',
    'array-callback-return':              'off',
    'vue/one-component-per-file':         'off',
    'vue/no-deprecated-slot-attribute':   'off',
    'vue/require-explicit-emits':         'off',
    'vue/v-on-event-hyphenation':         'off'
  },
  


  overrides: [
    {
      files: [
        '*.js'
      ],
      rules: {
        'prefer-regex-literals':                'off',
        'vue/component-definition-name-casing': 'off',
        'no-unreachable-loop':                  'off',
        'computed-property-spacing':            'off'
      }
    },
    {
      files: [
        'docusaurus/**/*.{js,ts}'
      ],
      rules: { 'no-use-before-define': 'off' }
    },
    {
      files: [
        '**/*.vue'
      ],
      excludedFiles: [
        'pkg/harvester/**/*.vue'
      ],
      rules: {
        'vue/no-v-html':   'error',
        'vue/html-indent': [
          'error',
          2
        ],
        'vue/html-closing-bracket-newline': [
          'error',
          {
            singleline: 'never',
            multiline:  'always'
          }
        ],
        'vue/html-closing-bracket-spacing': 2,
        'vue/html-end-tags':                2,
        'vue/html-quotes':                  2,
        'vue/html-self-closing':            [
          'error',
          {
            html: {
              void:      'never',
              normal:    'always',
              component: 'always'
            },
            svg:  'always',
            math: 'always'
          }
        ],
        'vue/max-attributes-per-line': [
          'error',
          {
            singleline: { max: 1 },
            multiline:  { max: 1 }
          }
        ]
      }
    },
    {
      files: [
        '**/shell/utils/**/*.{js,ts}',
        '**/shell/scripts/**/*.{js,ts}'
      ],
      rules: {
        '@typescript-eslint/no-empty-function': 'off',
        '@typescript-eslint/no-var-requires':   'off'
      }
    },
    {
      files: [
        '**/*.{js,ts,vue}'
      ],
      rules: {
        '@typescript-eslint/no-this-alias':   'off',
        '@typescript-eslint/no-explicit-any': 'off'
      }
    },
    {
      files: [
        '**/epinio/**/*.{js,ts,vue}'
      ],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        '@typescript-eslint/no-empty-interface':             'off'
      }
    },
    {
      files: [
        '**/{harvester,harvester-manager}/**/*.{js,ts,vue}'
      ],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off',
        'vue/html-self-closing':                             'off',
        'vue/no-v-html':                                     'error'
      }
    },
    {
      files: [
        '**/po/**/*.{js,ts,vue}'
      ],
      rules: { '@typescript-eslint/explicit-module-boundary-types': 'off' }
    }
  ]
};
