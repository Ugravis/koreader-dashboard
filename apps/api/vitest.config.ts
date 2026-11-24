import { defineConfig } from 'vitest/config'

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://koreader:koreader@localhost:5432/koreader_dashboard_test'

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: TEST_DATABASE_URL,
      BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-0000',
    },
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
  },
})
