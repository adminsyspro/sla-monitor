# prober — SLA Monitor probing service

Polls the Next.js web service for monitors that are due, runs HTTP / TCP / DNS / SSL checks, and posts results back.

## Local dev (without Docker)

```bash
cd prober
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

export PROBER_TOKEN=devtoken
export NEXT_INTERNAL_URL=http://localhost:3000
python -m prober
```

Set the same `PROBER_TOKEN` on the Next side so the Bearer auth matches.

## Tests

```bash
pytest -v
```

## Smoke test (Docker Compose)

From the repo root:

```bash
cp .env.example .env
echo "PROBER_TOKEN=$(openssl rand -hex 32)" > .env
echo "NEXTAUTH_SECRET=$(openssl rand -hex 32)" >> .env
docker compose up --build
```

In another terminal:

```bash
docker compose logs -f prober
```

You should see `poll.tick monitors_due=N` events every 5 seconds.

Open `http://localhost:3000`, log in, create an HTTP monitor (e.g. `https://example.com`, expected status 200, interval 60). Wait one minute — a fresh check should appear and `last_check_at` should be set.

## Configuration (env vars)

| Variable | Default | Description |
|---|---|---|
| `PROBER_TOKEN` | (required) | Shared secret with Next |
| `NEXT_INTERNAL_URL` | `http://web:3000` | Where to reach Next |
| `POLL_INTERVAL_SECONDS` | `5` | Polling cadence |
| `MAX_CONCURRENT_CHECKS` | `50` | Concurrency limit |
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
