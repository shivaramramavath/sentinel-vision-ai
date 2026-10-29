import { env } from '@/env';

export interface MapConfig {
  center: [number, number];
  zoom: number;
  styles?: {
    light?: string;
    dark?: string;
  };
}

/**
 * Parses application map environment variables with safe defaults.
 * Coordinates are strictly [longitude, latitude].
 */
export function getDefaultMapConfig(): MapConfig {
  let center: [number, number] = [-74.006, 40.7128];

  if (env.NEXT_PUBLIC_MAP_DEFAULT_CENTER) {
    const parts = env.NEXT_PUBLIC_MAP_DEFAULT_CENTER.split(',').map((p) => parseFloat(p.trim()));
    if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      center = [parts[0], parts[1]];
    }
  }

  const zoom = Number.isFinite(env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM)
    ? env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM
    : 14;

  const styles =
    env.NEXT_PUBLIC_MAP_STYLE_LIGHT || env.NEXT_PUBLIC_MAP_STYLE_DARK
      ? {
          light: env.NEXT_PUBLIC_MAP_STYLE_LIGHT || undefined,
          dark: env.NEXT_PUBLIC_MAP_STYLE_DARK || undefined,
        }
      : undefined;

  return {
    center,
    zoom,
    styles,
  };
}
