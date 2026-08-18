# Repository Guidelines

## Project Overview

Yestion is a web-based workspace inspired by Notion. It uses a block-first
data model, Yjs-based collaboration, and a Go API built with Gin and GORM
backed by PostgreSQL. Planning documents live under [`docs/`](docs/).

## Project Structure & Module Organization

```text
apps/web/          Next.js frontend and editor
apps/api/          Go API services using Gin and GORM
apps/services/zvec Python REST service wrapping Zvec (vector search)
docker-compose.yml PostgreSQL, Redis, and MinIO
docs/              Design and task-planning documents
```

Keep Go handlers in `apps/api/internal/handler`, business logic in
`apps/api/internal/service`, and models in `apps/api/internal/model`. Keep
reusable editor primitives in `apps/web/components/blocks/`. The Zvec service
is managed with `uv`; keep its code in `apps/services/zvec/src/zvec_service/`.

Vector search is a REST service: one Zvec collection per workspace, one
document per page block. Embeddings are also persisted to PostgreSQL
(`document_vectors`, pgvector). The Go API keeps both in sync on workspace and
block create/update/delete. AI chat (`POST /api/chat`) streams OpenAI-compatible
SSE. Conversations are user-scoped (not locked to a workspace). When
`useKnowledge` is set, the API searches the user's accessible workspaces'
Zvec collections (membership enforced server-side) and grounds the answer in
the retrieved documents, tagging each source with its workspace.

## Build, Test, and Development Commands

```bash
docker compose up -d --build                            # start everything
docker compose up -d --build postgres redis minio zvec api   # start backend + infra
cd apps/web && npm run dev                              # run frontend locally
cd apps/services/zvec && uv run zvec-service            # run the Zvec service locally
cd apps/web && npm run lint                             # lint frontend TypeScript files
cd apps/api && golangci-lint run                        # lint Go files
cd apps/api && go test ./...                            # run Go unit tests
```

Migrations (including the pgvector extension) run at API startup. Set
`DEEPSEEK_API_KEY` to enable chat; the Zvec service embeds with a local
sentence-transformers model by default (`ZVEC_EMBEDDING_PROVIDER=openai` to use
an OpenAI-compatible embedding API).

## Coding Style & Naming Conventions

- Use TypeScript in strict mode for the frontend and format with Prettier.
- Format Go files with `gofmt` and run `golangci-lint run` before committing.
- Name React components with `PascalCase.tsx` and hooks as `useCamelCase`.
- Name Go packages with short lowercase names and files in `snake_case`.
- Keep database column names in `snake_case` and API fields in `camelCase`.
- Use 2-space indentation in TypeScript; use tabs in Go.

## Testing Guidelines

No test suite exists yet. When added, use Go's standard `testing` package with
table-driven backend tests and Playwright for editor and database-view
end-to-end tests. Name Go tests `*_test.go` with `TestXxx` functions. Run
focused tests with `go test ./path/to/package`.

## Commit & Pull Request Guidelines

Use Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, and
`chore:`. Reference the task IDs in [`docs/04_任务清单.md`](docs/04_任务清单.md),
for example `feat: add database row API (T4.1)`. Keep PRs small, describe the
change, include screenshots for UI work, and verify the commands above still
pass.

## Agent-Specific Instructions

- Read [`docs/`](docs/) before implementing a feature.
- Follow the milestone order in the task plan.
- Never commit secrets; add local values to `.env.example`.
- Preserve Chinese planning documents, but write code and comments in English.
