from __future__ import annotations

import logging
from typing import Annotated, Optional

from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .config import settings
from .embedding import embedding_service
from .storage import manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Zvec Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    provider: str
    dimension: int
    collections: int


class DocumentPayload(BaseModel):
    title: str = Field(default="")
    content: str = Field(default="")
    type: str = Field(default="page")


class QueryPayload(BaseModel):
    query: str = Field(min_length=1)
    topk: int = Field(default=5, ge=1, le=50)


class EmbeddingPayload(BaseModel):
    text: str = Field(min_length=1)


class SearchHit(BaseModel):
    documentId: str
    title: str
    content: str
    type: str
    score: float


class SearchResponse(BaseModel):
    results: list[SearchHit]


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        provider=settings.embedding_provider,
        dimension=settings.embedding_dimension,
        collections=manager.count(),
    )


@app.post("/collections/{workspace_id}")
def ensure_collection(workspace_id: str) -> dict[str, bool]:
    manager.ensure(workspace_id)
    return {"ok": True}


@app.delete("/collections/{workspace_id}", status_code=status.HTTP_200_OK)
def destroy_collection(workspace_id: str) -> dict[str, bool]:
    manager.destroy(workspace_id)
    return {"ok": True}


@app.put("/collections/{workspace_id}/documents/{document_id}")
def upsert_document(workspace_id: str, document_id: str, payload: DocumentPayload) -> dict[str, object]:
    text = f"{payload.title}\n{payload.content}".strip()
    if not text:
        raise HTTPException(status_code=400, detail="document has no text to embed")
    try:
        embedding = embedding_service.embed(text)
        manager.upsert(
            workspace_id,
            document_id,
            embedding,
            payload.title,
            payload.content,
            payload.type,
        )
    except Exception as exc:
        logger.exception("Failed to upsert document %s in workspace %s", document_id, workspace_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"ok": True, "embedding": embedding}


@app.delete("/collections/{workspace_id}/documents/{document_id}")
def delete_document(workspace_id: str, document_id: str) -> dict[str, bool]:
    manager.delete(workspace_id, document_id)
    return {"ok": True}


@app.post("/collections/{workspace_id}/query", response_model=SearchResponse)
def query_collection(workspace_id: str, payload: QueryPayload) -> SearchResponse:
    try:
        embedding = embedding_service.embed(payload.query)
        hits = manager.query(workspace_id, embedding, payload.topk)
    except Exception as exc:
        logger.exception("Query failed for workspace %s", workspace_id)
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    results = []
    for hit in hits:
        fields = getattr(hit, "fields", {}) or {}
        document_id = getattr(hit, "id", "") or ""
        score = getattr(hit, "score", 0.0) or 0.0
        results.append(
            SearchHit(
                documentId=str(document_id),
                title=str(fields.get("title", "")),
                content=str(fields.get("content", "")),
                type=str(fields.get("doc_type", "")),
                score=float(score),
            )
        )
    return SearchResponse(results=results)


@app.post("/embeddings")
def embed_text(payload: EmbeddingPayload) -> dict[str, list[float]]:
    try:
        return {"embedding": embedding_service.embed(payload.text)}
    except Exception as exc:
        logger.exception("Embedding failed")
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> Response:
    logger.exception("Unhandled error", exc_info=exc)
    return JSONResponse(content={"detail": "internal error"}, status_code=500)
