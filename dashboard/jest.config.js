module.exports = {
  roots:           ['<rootDir>/pkg/epinio'],
  testEnvironment: 'jsdom',
  moduleFileExtensions: ['vue', 'js', 'ts', 'json'],
  moduleNameMapper: {
    '^@shell/(.*)$': '<rootDir>/node_modules/@rancher/shell/$1'
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
