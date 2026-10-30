import { EnvSchema, Env } from './env.schema';

export type ApiEnv = Env;
export { EnvSchema };

export function validateApiEnv(config: Record<string, unknown>): ApiEnv {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    const errorDetails = result.error.format();
    console.error('❌ FATAL: apps/api environment variable validation failed on boot:');
    console.error(JSON.stringify(errorDetails, null, 2));
    throw new Error('Config validation failed on boot');
  }
  return result.data;
}
