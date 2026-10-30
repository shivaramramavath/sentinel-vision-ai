import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const turnSecret = process.env.TURN_SECRET || 'sentinel_turn_secret_2026';
const apiUrl = process.env.API_URL || 'http://localhost:3001';
const globalPrefix = process.env.API_GLOBAL_PREFIX || 'api/v1';
const authHttpUrl = `${apiUrl}/${globalPrefix}/media/auth`.replace('localhost', 'host.docker.internal');

// 1. Generate infra/coturn/turnserver.conf
const coturnDir = path.resolve(process.cwd(), 'infra/coturn');
if (!fs.existsSync(coturnDir)) {
  fs.mkdirSync(coturnDir, { recursive: true });
}

const turnConf = `# Auto-generated from environment - DO NOT COMMIT SECRETS
listening-port=3478
tls-listening-port=5349
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=${turnSecret}
realm=sentinel.local
min-port=49160
max-port=49200
log-file=stdout
no-cli
`;

fs.writeFileSync(path.join(coturnDir, 'turnserver.conf'), turnConf, 'utf8');
console.log('Generated infra/coturn/turnserver.conf');

// 2. Generate infra/mediamtx/mediamtx.yml and infra/mediamtx.yml
const mediamtxDir = path.resolve(process.cwd(), 'infra/mediamtx');
if (!fs.existsSync(mediamtxDir)) {
  fs.mkdirSync(mediamtxDir, { recursive: true });
}

const mediamtxContent = `###############################################################################
# Sentinel Vision AI — MediaMTX Edge Video Ingestion & Streaming Proxy
# Auto-generated from environment configuration
###############################################################################

logLevel: info
logDestinations: [stdout]
logStructured: false

readTimeout: 10s
writeTimeout: 10s
writeQueueSize: 1024

###############################################################################
# External HTTP Authentication (Delegated to Sentinel NestJS API)
###############################################################################
authMethod: http
authHTTPAddress: ${authHttpUrl}
authHTTPExclude:
  - action: api
  - action: metrics
  - action: pprof

###############################################################################
# Control API (Internal network only for camera discovery & health probes)
###############################################################################
api: yes
apiAddress: :9997

###############################################################################
# Metrics & Health
###############################################################################
metrics: no
metricsAddress: :9998
pprof: no
pprofAddress: :9999

###############################################################################
# RTSP Server (Port: 8554)
###############################################################################
rtsp: yes
rtspAddress: :8554
rtspsAddress: :8322
rtpAddress: :8000
rtcpAddress: :8001
rtspTransports: [tcp, udp]
rtspEncryption: "no"

###############################################################################
# RTMP Server (Port: 1935)
###############################################################################
rtmp: yes
rtmpAddress: :1935
rtmpsAddress: :1936
rtmpEncryption: "no"

###############################################################################
# HLS Low-Latency Streaming (Port: 8888)
###############################################################################
hls: yes
hlsAddress: :8888
hlsAlwaysRemux: yes
hlsVariant: lowLatency
hlsSegmentDuration: 1s
hlsPartDuration: 200ms
hlsSegmentCount: 7
hlsAllowOrigins: ["*"]

###############################################################################
# WebRTC / WHIP / WHEP Server (Port: 8889, ICE UDP: 8189)
###############################################################################
webrtc: yes
webrtcAddress: :8889
webrtcLocalUDPAddress: :8189
webrtcAllowOrigins: ["*"]
webrtcHandshakeTimeout: 10s

webrtcICEServers2:
  - url: turn:coturn:3478?transport=udp
    username: "AUTH_SECRET"
    password: "${turnSecret}"
    clientOnly: false
  - url: turn:coturn:3478?transport=tcp
    username: "AUTH_SECRET"
    password: "${turnSecret}"
    clientOnly: false
  - url: stun:coturn:3478

###############################################################################
# SRT Server (Port: 8890)
###############################################################################
srt: yes
srtAddress: :8890

###############################################################################
# Stream Paths Pattern: cam/{cameraId}
###############################################################################
paths:
  '~^cam/([^/]+)/preview':
    source: publisher
    runOnDemand: ffmpeg -i rtsp://localhost:8554/cam/$G1 -c:v libx264 -preset ultrafast -tune zerolatency -b:v 1500k -maxrate 2000k -bufsize 3000k -c:a copy -f rtsp rtsp://localhost:8554/cam/$G1/preview
    runOnDemandRestart: yes
    runOnDemandCloseAfter: 10s

  '~^cam/([^/]+)/sub':
    source: publisher
    runOnDemand: ffmpeg -i rtsp://localhost:8554/cam/$G1 -vf scale=640:360 -r 10 -c:v libx264 -preset ultrafast -tune zerolatency -b:v 400k -maxrate 500k -bufsize 800k -c:a copy -f rtsp rtsp://localhost:8554/cam/$G1/sub
    runOnDemandRestart: yes
    runOnDemandCloseAfter: 10s

  '~^cam/([^/]+)$':
    source: publisher
    runOnAvailable: >
      sh -c 'wget -q -O - --header="Content-Type: application/json" --post-data="{\\"path\\":\\"$MTX_PATH\\",\\"cameraId\\":\\"$G1\\",\\"status\\":\\"READY\\",\\"sourceType\\":\\"$MTX_SOURCE_TYPE\\",\\"sourceId\\":\\"$MTX_SOURCE_ID\\"}" ${authHttpUrl.replace('/media/auth', '/media/hook/stream-status')} || curl -s -X POST ${authHttpUrl.replace('/media/auth', '/media/hook/stream-status')} -H "Content-Type: application/json" -d "{\\"path\\":\\"$MTX_PATH\\",\\"cameraId\\":\\"$G1\\",\\"status\\":\\"READY\\",\\"sourceType\\":\\"$MTX_SOURCE_TYPE\\",\\"sourceId\\":\\"$MTX_SOURCE_ID\\"}" || true'
    runOnAvailableRestart: no
    runOnUnavailable: >
      sh -c 'wget -q -O - --header="Content-Type: application/json" --post-data="{\\"path\\":\\"$MTX_PATH\\",\\"cameraId\\":\\"$G1\\",\\"status\\":\\"NOT_READY\\"}" ${authHttpUrl.replace('/media/auth', '/media/hook/stream-status')} || curl -s -X POST ${authHttpUrl.replace('/media/auth', '/media/hook/stream-status')} -H "Content-Type: application/json" -d "{\\"path\\":\\"$MTX_PATH\\",\\"cameraId\\":\\"$G1\\",\\"status\\":\\"NOT_READY\\"}" || true'
`;

fs.writeFileSync(path.join(mediamtxDir, 'mediamtx.yml'), mediamtxContent, 'utf8');
fs.writeFileSync(path.resolve(process.cwd(), 'infra/mediamtx.yml'), mediamtxContent, 'utf8');
console.log('Generated infra/mediamtx/mediamtx.yml and infra/mediamtx.yml');
