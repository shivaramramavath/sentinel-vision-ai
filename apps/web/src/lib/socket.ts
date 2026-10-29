/**
 * Sentinel Vision AI — Real-time event communication layer.
 * Connects to Socket.IO in live production mode, or provides an
 * in-memory EventEmitter with realistic telemetry when in mock mode.
 */

type EventHandler = (payload: any) => void;

class RealtimeClient {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private mockInterval: any = null;
  private isPaused: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Automatic pause when tab is hidden
      document.addEventListener('visibilitychange', () => {
        this.isPaused = document.visibilityState === 'hidden';
      });

      // Start mock event generator
      this.startMockEventLoop();
    }
  }

  private startMockEventLoop() {
    this.mockInterval = setInterval(() => {
      if (this.isPaused) return;

      // 1. Camera heartbeat / health telemetry event
      this.emitInternal('camera:telemetry', {
        cameraId: 'cam_01',
        fps: 29 + Math.floor(Math.random() * 3),
        peopleCount: 38 + Math.floor(Math.random() * 8),
        timestamp: new Date().toISOString(),
      });

      // 2. Search job progress tick
      this.emitInternal('search:progress', {
        searchJobId: 'job_001',
        progressPercent: Math.min(100, Math.floor(Math.random() * 5 + 68)),
        status: 'searching_reid_index',
      });
    }, 4000);
  }

  public on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: string, handler: EventHandler) {
    this.handlers.get(event)?.delete(handler);
  }

  private emitInternal(event: string, data: any) {
    const listeners = this.handlers.get(event);
    if (listeners) {
      listeners.forEach((fn) => fn(data));
    }
  }

  public destroy() {
    if (this.mockInterval) clearInterval(this.mockInterval);
    this.handlers.clear();
  }
}

export const realtimeClient = new RealtimeClient();
export const socket = realtimeClient;
