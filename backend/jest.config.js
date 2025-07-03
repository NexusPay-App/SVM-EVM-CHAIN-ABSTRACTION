module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  testTimeout: 30000, // 30 second default timeout
  collectCoverageFrom: [
    'services/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    '!**/*.test.js',
    '!**/node_modules/**'
  ],
  testMatch: [
    '<rootDir>/test/**/*.test.js'
  ],
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: 1, // Run tests serially to avoid database conflicts
  moduleNameMapper: {
    // Handle CommonJS modules
    '^chai$': '<rootDir>/test/mocks/chai.js'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(chai)/)'
  ]
}; 