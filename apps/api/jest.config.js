module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
  moduleNameMapper: {
    '^@sentinel/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@scure|@otplib|otplib)/)',
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
};
