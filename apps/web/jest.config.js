const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.tsx', '**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@sentinel/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    '^lucide-react$': require.resolve('lucide-react', { paths: [__dirname] }),
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
  },
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  passWithNoTests: true,
};
