import { z } from 'zod';

const WebEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_WS_URL: z.string().default('ws://localhost:3001'),
  NEXT_PUBLIC_APP_NAME: z.string().default('Sentinel Vision AI'),
  NEXT_PUBLIC_MAP_STYLE_LIGHT: z.string().optional(),
  NEXT_PUBLIC_MAP_STYLE_DARK: z.string().optional(),
  NEXT_PUBLIC_MAP_DEFAULT_CENTER: z.string().default('-74.006,40.7128'),
  NEXT_PUBLIC_MAP_DEFAULT_ZOOM: z.coerce.number().default(14),
});

const parsed = WebEnvSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_MAP_STYLE_LIGHT: process.env.NEXT_PUBLIC_MAP_STYLE_LIGHT || undefined,
  NEXT_PUBLIC_MAP_STYLE_DARK: process.env.NEXT_PUBLIC_MAP_STYLE_DARK || undefined,
  NEXT_PUBLIC_MAP_DEFAULT_CENTER: process.env.NEXT_PUBLIC_MAP_DEFAULT_CENTER || undefined,
  NEXT_PUBLIC_MAP_DEFAULT_ZOOM: process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM || undefined,
});

if (!parsed.success) {
  console.error('❌ FATAL: apps/web environment validation failed on boot:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  throw new Error('Web environment configuration invalid');
}

export const env = parsed.data;
