'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import { Map, MapControls, MapProps, MapViewport } from '@/components/ui/map';
import { getDefaultMapConfig } from '@/lib/map-config';
import { cn } from '@/lib/utils';

export interface SentinelMapProps extends Omit<MapProps, 'children'> {
  showControls?: boolean;
  showZoom?: boolean;
  showCompass?: boolean;
  showFullscreen?: boolean;
  showLocate?: boolean;
  controlsPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
  children?: React.ReactNode;
}

/**
 * Base Sentinel Vision AI Map Wrapper.
 * Wraps mapcn / MapLibre GL with unified light/dark theme resolution,
 * configurable security controls (zoom, compass, fullscreen, locate),
 * and indoor blank mode support.
 */
export function SentinelMap({
  center,
  zoom,
  minZoom = 1,
  maxZoom = 20,
  pitch = 0,
  bearing = 0,
  styles,
  blank = false,
  interactive = true,
  showControls = true,
  showZoom = true,
  showCompass = true,
  showFullscreen = true,
  showLocate = true,
  controlsPosition = 'bottom-right',
  className,
  children,
  ...rest
}: SentinelMapProps) {
  const { resolvedTheme } = useTheme();
  const defaultConfig = getDefaultMapConfig();

  const finalCenter = center ?? defaultConfig.center;
  const finalZoom = zoom ?? defaultConfig.zoom;
  const finalStyles = styles ?? defaultConfig.styles;

  const mapTheme = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-background', className)}>
      <Map
        center={finalCenter}
        zoom={finalZoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        pitch={pitch}
        bearing={bearing}
        blank={blank}
        theme={mapTheme}
        styles={blank ? undefined : finalStyles}
        interactive={interactive}
        className="h-full w-full"
        {...rest}
      >
        {children}
        {showControls && (
          <MapControls
            position={controlsPosition}
            showZoom={showZoom}
            showCompass={showCompass}
            showFullscreen={showFullscreen}
            showLocate={showLocate}
          />
        )}
      </Map>
    </div>
  );
}
