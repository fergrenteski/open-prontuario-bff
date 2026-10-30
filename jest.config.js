/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testRegex: '\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/bootstrap/main.ts'],
  coverageReporters: ['text-summary', 'text', 'lcov'],
  coverageThreshold: {
    './src/domain/': { lines: 80, branches: 80, functions: 80, statements: 80 },
  },
};
