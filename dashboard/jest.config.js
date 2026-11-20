module.exports = {
  roots:           ['<rootDir>/pkg/epinio'],
  testEnvironment: 'jsdom',
  setupFiles:      ['<rootDir>/jest/setup.js'],
  moduleFileExtensions: ['vue', 'js', 'ts', 'json'],
  moduleNameMapper: {
    '^@shell/(.*)$':                  '<rootDir>/node_modules/@rancher/shell/$1',
    '^@tanstack/match-sorter-utils$': '<rootDir>/jest/match-sorter-utils.stub.js'
  },
  transform: {
    '^.+\\.vue$': '@vue/vue3-jest',
    '^.+\\.ts$':  'ts-jest',
    '^.+\\.js$':  'babel-jest'
  },
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/pkg/epinio/tsconfig.json',
      isolatedModules: true
    }
  }
};
