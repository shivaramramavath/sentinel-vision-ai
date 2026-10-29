'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface CoalescedConfig<T> {
  coalesceWindowMs?: number; // default: 250 ms
  onBatchFlush?: (batch: T[]) => void;
}

/**
 * Custom React Hook to coalesce high-frequency incoming WebSocket events
 * into a single batch dispatched every 250 ms to prevent UI re-render thrashing.
 */
export function useCoalescedWebSocket<T>(config: CoalescedConfig<T> = {}) {
  const { coalesceWindowMs = 250, onBatchFlush } = config;
  const [items, setItems] = useState<T[]>([]);
  const bufferRef = useRef<T[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const flush = useCallback(() => {
    if (bufferRef.current.length > 0) {
      const batch = [...bufferRef.current];
      bufferRef.current = [];
      setItems((prev) => [...batch, ...prev].slice(0, 500)); // Keep latest 500
      if (onBatchFlush) {
        onBatchFlush(batch);
      }
    }
    timerRef.current = null;
  }, [onBatchFlush]);

  const enqueue = useCallback(
    (item: T) => {
      bufferRef.current.push(item);
      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, coalesceWindowMs);
      }
    },
    [flush, coalesceWindowMs],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    items,
    enqueue,
    flush,
  };
}
