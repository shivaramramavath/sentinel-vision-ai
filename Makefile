.PHONY: up down logs reset test build lint smoke eval eval-plots load-test chaos map-perf

COMPOSE_FILE = infra/docker-compose.yml

up:
	docker compose -f $(COMPOSE_FILE) up -d

down:
	docker compose -f $(COMPOSE_FILE) down

logs:
	docker compose -f $(COMPOSE_FILE) logs -f

reset:
	docker compose -f $(COMPOSE_FILE) down -v --remove-orphans
	docker compose -f $(COMPOSE_FILE) up -d

test:
	pnpm test
	pytest apps/inference/tests

build:
	pnpm build

lint:
	pnpm lint

smoke:
	pnpm --filter @sentinel/infra-scripts smoke

eval:
	PYTHONPATH=apps/inference/src python apps/inference/scripts/run_experiments.py
	PYTHONPATH=apps/inference/src python apps/inference/scripts/generate_plots.py

eval-plots:
	PYTHONPATH=apps/inference/src python apps/inference/scripts/generate_plots.py

load-test:
	python infra/load-tests/produce_test_frames.py

chaos:
	python infra/chaos/test_chaos_recovery.py

map-perf:
	node infra/load-tests/map-performance-benchmark.js
	pnpm --filter @sentinel/web test src/__tests__/map-performance.test.tsx

