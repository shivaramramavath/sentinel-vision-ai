module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
  moduleNameMapper: {
    '^@sentinel/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      'ts-jest',
      {
        isolatedModules: true,
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!.*(@scure|@noble|@otplib|otplib))',
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts'],
};
