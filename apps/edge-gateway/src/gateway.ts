import { spawn, ChildProcess } from 'child_process';

interface LocalCameraConfig {
  id: string;
  name?: string;
  localRtspUrl: string;
  targetProtocol?: 'srt' | 'rtsp';
}

interface GatewayConfig {
  remotePlatformHost: string;
  srtPort: number;
  rtspPort: number;
  streamKeySecret: string;
  cameras: LocalCameraConfig[];
}

// Default configuration with environment fallbacks
const config: GatewayConfig = {
  remotePlatformHost: process.env.SENTINEL_REMOTE_HOST || 'localhost',
  srtPort: parseInt(process.env.SENTINEL_SRT_PORT || '8890', 10),
  rtspPort: parseInt(process.env.SENTINEL_RTSP_PORT || '8554', 10),
  streamKeySecret: process.env.SENTINEL_STREAM_KEY || 'sentinel-stream-key-2026',
  cameras: process.env.LOCAL_CAMERAS_JSON
    ? JSON.parse(process.env.LOCAL_CAMERAS_JSON)
    : [
        {
          id: 'cam_gate_01',
          name: 'LAN North Gate',
          localRtspUrl: 'rtsp://192.168.1.101:554/live/ch0',
          targetProtocol: 'srt',
        },
        {
          id: 'cam_lobby_02',
          name: 'LAN Lobby Interior',
          localRtspUrl: 'rtsp://192.168.1.102:554/live/ch0',
          targetProtocol: 'srt',
        },
      ],
};

class StreamForwarder {
  private camera: LocalCameraConfig;
  private process: ChildProcess | null = null;
  private retryCount = 0;
  private isRunning = true;

  constructor(camera: LocalCameraConfig) {
    this.camera = camera;
  }

  public start() {
    this.isRunning = true;
    this.spawnForwarder();
  }

  public stop() {
    this.isRunning = false;
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }

  private spawnForwarder() {
    if (!this.isRunning) return;

    const protocol = this.camera.targetProtocol || 'srt';
    let outputUrl = '';

    if (protocol === 'srt') {
      // Secure SRT output with streamid publish header
      outputUrl = `srt://${config.remotePlatformHost}:${config.srtPort}?streamid=publish:cam/${this.camera.id}&latency=200000`;
    } else {
      // RTSP over TCP output
      outputUrl = `rtsp://${config.remotePlatformHost}:${config.rtspPort}/cam/${this.camera.id}`;
    }

    console.log(
      `[EdgeGateway] Bridging [${this.camera.id}] ${this.camera.localRtspUrl} -> ${outputUrl} (Zero-decode passthrough)...`,
    );

    // FFmpeg arguments: TCP transport input, passthrough video/audio copy, zero transcoding overhead
    const args = [
      '-rtsp_transport',
      'tcp',
      '-i',
      this.camera.localRtspUrl,
      '-c',
      'copy',
      '-f',
      protocol === 'srt' ? 'mpegts' : 'rtsp',
      outputUrl,
    ];

    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.process = child;

    child.stderr?.on('data', (chunk) => {
      const log = chunk.toString();
      if (log.includes('error') || log.includes('failed')) {
        console.warn(`[EdgeGateway][${this.camera.id}] ${log.trim()}`);
      }
    });

    child.on('exit', (code) => {
      this.process = null;
      if (!this.isRunning) return;

      // Exponential backoff with randomized jitter (1s - 30s)
      this.retryCount++;
      const baseDelay = Math.min(30000, Math.pow(1.8, this.retryCount) * 1000);
      const jitter = Math.random() * 1000;
      const delayMs = Math.round(baseDelay + jitter);

      console.warn(
        `[EdgeGateway][${this.camera.id}] Process exited with code ${code}. Reconnecting in ${(delayMs / 1000).toFixed(1)}s (Attempt ${this.retryCount})...`,
      );

      setTimeout(() => {
        this.spawnForwarder();
      }, delayMs);
    });
  }
}

// Bootstrap all configured LAN forwarders
console.log('=================================================================');
console.log('  SENTINEL VISION AI — SECURE EDGE CAMERA GATEWAY AGENT');
console.log(`  Target Platform: ${config.remotePlatformHost}`);
console.log(`  SRT Port: ${config.srtPort} | RTSP Port: ${config.rtspPort}`);
console.log(`  Forwarding ${config.cameras.length} Local RTSP Cameras`);
console.log('=================================================================');

const forwarders = config.cameras.map((c) => {
  const f = new StreamForwarder(c);
  f.start();
  return f;
});

process.on('SIGINT', () => {
  console.log('\n[EdgeGateway] Gracefully shutting down forwarders...');
  forwarders.forEach((f) => f.stop());
  process.exit(0);
});
