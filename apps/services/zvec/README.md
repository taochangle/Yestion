# Zvec Service

RESTful wrapper around [Zvec](https://zvec.org), Alibaba's in-process vector
database. The service owns Zvec collections (one per workspace), computes
embeddings, and exposes a small HTTP API used by the Go backend.

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness + embedding configuration |
| `POST` | `/collections/{workspaceId}` | Ensure a collection exists (idempotent) |
| `DELETE` | `/collections/{workspaceId}` | Destroy a collection |
| `PUT` | `/collections/{workspaceId}/documents/{documentId}` | Embed and upsert a document |
| `DELETE` | `/collections/{workspaceId}/documents/{documentId}` | Delete a document |
| `POST` | `/collections/{workspaceId}/query` | Semantic search (top-k hits) |
| `POST` | `/embeddings` | Embed a single text |

## Development

```bash
uv sync
uv run zvec-service
```

The default embedding provider is a local sentence-transformers model
(`all-MiniLM-L6-v2`, 384 dimensions, ~80MB, downloaded on first use). Set
`ZVEC_EMBEDDING_PROVIDER=openai` with `OPENAI_API_KEY` / `OPENAI_BASE_URL` to
use any OpenAI-compatible embedding API instead. Collection dimension must
match `ZVEC_EMBEDDING_DIM`.
