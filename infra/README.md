# Sentinel Vision AI — Infrastructure

## Local Development

```bash
# Start all services
docker compose -f infra/docker-compose.dev.yml up -d

# View logs
docker compose -f infra/docker-compose.dev.yml logs -f

# Stop
docker compose -f infra/docker-compose.dev.yml down
```

## Services

| Service | URL | Credentials |
|---|---|---|
| MongoDB | `mongodb://localhost:27017/sentinel_vision` | no auth (dev) |
| Redis | `redis://localhost:6379` | no auth (dev) |
| Kafka | `localhost:9092` | — |
| Kafka UI | http://localhost:8080 | — |
| MinIO Console | http://localhost:9001 | `minioadmin` / `minioadmin` |
| MinIO API | http://localhost:9000 | `minioadmin` / `minioadmin` |

## One-time Setup

```bash
# 1. Start infra
docker compose -f infra/docker-compose.dev.yml up -d

# 2. Create Kafka topics
cd infra/scripts && pnpm install && pnpm setup-kafka

# 3. Create Pinecone indexes (requires PINECONE_API_KEY in env)
PINECONE_API_KEY=xxx pnpm setup-pinecone
```
