# NotionClone

NotionClone is a Notion-inspired workspace with a Go/Gin/GORM API and a
Next.js frontend.

## Quick Start

Copy the example environment file and start all services:

```bash
cp .env.example .env
docker compose up -d --build
```

Open the web app at <http://localhost:3000>. The API runs at
<http://localhost:8080>.

PostgreSQL, Redis, and MinIO stay on the internal Docker network and do not
publish host ports. Only the API and web app are exposed.

## Local Development

```bash
# start infrastructure and the API in Docker
docker compose up -d --build postgres redis minio api

# run the web app with hot reload in another terminal
cd apps/web
npm install
npm run dev
```

## Verification

```bash
cd apps/api && go test ./...
cd apps/web && npm run lint && npm run build
docker compose config
```
