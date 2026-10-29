# Sentinel Vision AI — Secure Edge Gateway Agent

The **Edge Gateway Agent** is a lightweight, zero-decode streaming multiplexer designed for remote facilities, campus security closets, and isolated camera VLANs.

## Purpose & Security Boundary
- **Never expose cameras directly to the Internet**: The gateway runs inside the local camera LAN (`192.168.1.0/24`), pulls local RTSP streams from NVRs/cameras over TCP, and multiplexes them outbound over a single encrypted **Secure Reliable Transport (SRT)** or **WHIP** tunnel to the central Sentinel MediaMTX platform.
- **NAT & Firewall Traversal**: Outbound-only traffic on port `8890` (SRT UDP) or port `443/8889` (WHIP HTTPS). No inbound router port forwarding required.
- **Zero-Decode Passthrough (`-c copy`)**: Video and audio packets are forwarded without transcoding, keeping CPU usage < 2% even across 16 simultaneous feeds.
- **Resilience**: Integrated exponential backoff with randomized jitter and connection watchdog.

## Usage

```bash
docker run -d \
  --name sentinel-edge-gateway \
  --restart unless-stopped \
  -e SENTINEL_REMOTE_HOST="hub.sentinel.gov" \
  -e SENTINEL_SRT_PORT=8890 \
  -e LOCAL_CAMERAS_JSON='[
    {"id": "cam_gate_01", "localRtspUrl": "rtsp://admin:pass@192.168.1.101:554/live"},
    {"id": "cam_lobby_02", "localRtspUrl": "rtsp://admin:pass@192.168.1.102:554/live"}
  ]' \
  sentinel/edge-gateway:latest
```
