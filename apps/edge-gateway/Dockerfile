FROM jrottenberg/ffmpeg:4.4-alpine AS ffmpeg-base

FROM node:20-alpine
WORKDIR /app

# Copy FFmpeg binaries from ffmpeg-base
COPY --from=ffmpeg-base / /

COPY package.json tsconfig.json ./
RUN npm install

COPY src/ ./src/
RUN npm run build

ENV NODE_ENV=production
ENV SENTINEL_REMOTE_HOST=platform.sentinel.internal
ENV SENTINEL_SRT_PORT=8890
ENV SENTINEL_RTSP_PORT=8554

CMD ["npm", "start"]
